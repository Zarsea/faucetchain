"""A varredura que dá data a um saque que não tem nenhuma.

O bit de um leaf na conta da raiz diz QUE alguém sacou e nunca QUANDO. Para
quem sacou pelo nosso relayer a data existe em `relayer_spend`; para quem
pagou a própria taxa não existe em lugar nenhum, porque a transação não passa
por este servidor.

`varrer_saques` olha a cadeia de tempos em tempos e anota o que ainda não
estava anotado. O carimbo é `first_seen_at`, e o nome é literal: é quando ESTE
servidor viu, não quando a Solana executou. A diferença é o intervalo da
varredura. Chamar de `claimed_at` seria prometer precisão que o dado não tem.

O que estes checks protegem:

  - um saque novo entra, com data, mesmo sem assinatura nossa;
  - rodar de novo não duplica nem reescreve a data. Uma varredura que move o
    carimbo a cada passagem destrói justamente o dado que ela existe para
    criar;
  - lote não publicado não entra, e falha de rede não apaga o que já havia.

    .venv/Scripts/python.exe tests/test_collection_scan.py
"""
import os
import sys
import tempfile
import time
import types

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMP = tempfile.mkdtemp(prefix="faucetchain-scan-")
os.chdir(TMP)
sys.path.insert(0, ROOT)

os.environ.setdefault("PASSWORD_SALT", "test-salt")

import indexer_service  # noqa: E402

indexer_service.init_db()

import api_server as srv  # noqa: E402

srv.init_settlement_tables()

ANA = "AnaWXv2zweyi4ksi9svMV5xpJYtRhmpFbs7HCMsY1HP"
BENTO = "BentoRsha1wxNDUxvy6Pk2nGgykSxoczgr4eqZL8VwP"
PATROCINADOR = "75vW4HnhtMVcLuHLh3Tm8S1BuFvLVBoLqYoRxQT3SDnE"


# ─────────────────────────────────────────────────────────────── a cadeia falsa

def cadeia_falsa(sacados, falhar=False):
    """Um `solana_settlement` que responde do dicionario em vez da devnet.

    `sacados` mapeia root_index -> conjunto de leaf_index ligados.
    """
    m = types.ModuleType("solana_settlement")
    m.load_idl = lambda: {"idl": True}
    m.program_id = lambda idl: "prog"
    m.campaign_pda = lambda pid, sponsor, campaign_id: f"camp{campaign_id}"
    m.root_pda = lambda pid, campaign, root_index: f"root{root_index}"
    m.default_rpc_url = lambda: "http://fake"

    def fetch_accounts(url, enderecos):
        if falhar:
            raise RuntimeError("devnet fora do ar")
        return [e for e in enderecos]          # o proprio nome vira o "dado"

    m.fetch_accounts = fetch_accounts
    m.leaf_claimed = lambda data, idx: idx in sacados.get(int(str(data)[4:]), set())
    return m


def montar(lotes, pagamentos=()):
    """`lotes`: lista de (batch_id, root_index, publicado, [(dono, valor, leaf)])."""
    conn = srv.get_db_connection()
    c = conn.cursor()
    try:
        # `relayer_spend` nasce noutro init; aqui ela so precisa existir para o
        # check da assinatura. A varredura tem de funcionar sem ela, e um dos
        # checks abaixo prova isso derrubando a rede, nao a tabela.
        c.execute("""CREATE TABLE IF NOT EXISTS relayer_spend (
                        signature TEXT PRIMARY KEY, batch_id INTEGER, recipient TEXT,
                        mint TEXT, amount INTEGER, base_fee INTEGER, priority_fee INTEGER,
                        rent_lamports INTEGER, created_at INTEGER)""")
        for t in ("settlement_collections", "settlement_batches",
                  "settlement_campaigns", "relayer_spend"):
            try:
                c.execute(f"DELETE FROM {t}")
            except Exception:
                pass
        agora = int(time.time())
        c.execute(
            "INSERT INTO settlement_campaigns (campaign_id, sponsor, mint, registered_at) "
            "VALUES (479079, ?, 'M', ?)", (PATROCINADOR, agora))
        for batch_id, root_index, publicado, _folhas in lotes:
            c.execute(
                """INSERT INTO settlement_batches
                   (id, campaign_id, root_index, root, total_amount, leaf_count,
                    created_at, published_signature)
                   VALUES (?, 479079, ?, ?, 0, 0, ?, ?)""",
                (batch_id, root_index, f"0x{batch_id:064x}", agora,
                 f"sig{batch_id}" if publicado else None))
        for assinatura, batch_id, dono in pagamentos:
            c.execute(
                """INSERT INTO relayer_spend
                   (signature, batch_id, recipient, mint, amount, created_at)
                   VALUES (?, ?, ?, 'M', 0, ?)""",
                (assinatura, batch_id, dono, agora))
        conn.commit()
    finally:
        conn.close()


def varrer(lotes, sacados, falhar=False):
    arvores = {b: {"claims": [{"recipient": d, "amount": v, "leaf_index": l}
                              for d, v, l in folhas]}
               for b, _ri, _pub, folhas in lotes}
    orig_tree, orig_mod = srv._batch_tree, sys.modules.get("solana_settlement")
    srv._batch_tree = lambda c, batch_id, root: arvores.get(batch_id)
    sys.modules["solana_settlement"] = cadeia_falsa(sacados, falhar)
    try:
        return srv.varrer_saques()
    finally:
        srv._batch_tree = orig_tree
        if orig_mod is None:
            sys.modules.pop("solana_settlement", None)
        else:
            sys.modules["solana_settlement"] = orig_mod


def anotados():
    conn = srv.get_db_connection()
    try:
        return list(conn.execute(
            "SELECT campaign_id, root_index, leaf_index, recipient, amount, "
            "first_seen_at, signature FROM settlement_collections ORDER BY leaf_index"))
    finally:
        conn.close()


# ─────────────────────────────────────── o check que faltava

def test_saque_sem_assinatura_ganha_data():
    """O caso inteiro: a cadeia sabe que saiu, e so a varredura sabe quando."""
    lotes = [(1, 0, True, [(ANA, 350, 0)])]
    montar(lotes)
    assert varrer(lotes, {0: {0}}) == 1
    linhas = anotados()
    assert len(linhas) == 1
    assert linhas[0][3] == ANA
    assert linhas[0][4] == 350
    assert linhas[0][5] > 0, "first_seen_at vazio e um saque sem data, que e o problema"
    assert linhas[0][6] is None, "nao ha assinatura nossa, e inventar uma seria pior"


def test_assinatura_do_relayer_e_anexada():
    lotes = [(1, 0, True, [(ANA, 10, 0)])]
    montar(lotes, pagamentos=[("2jck", 1, ANA)])
    varrer(lotes, {0: {0}})
    assert anotados()[0][6] == "2jck"


def test_leaf_nao_sacado_nao_entra():
    lotes = [(1, 0, True, [(ANA, 10, 0), (BENTO, 20, 1)])]
    montar(lotes)
    assert varrer(lotes, {0: {1}}) == 1
    assert [l[3] for l in anotados()] == [BENTO]


def test_lote_nao_publicado_e_ignorado():
    lotes = [(1, 0, False, [(ANA, 10, 0)])]
    montar(lotes)
    assert varrer(lotes, {0: {0}}) == 0
    assert anotados() == []


# ─────────────────────────────────────── a data nao pode andar

def test_varrer_de_novo_nao_duplica_nem_move_a_data():
    """Carimbo que se reescreve a cada passagem nao e carimbo."""
    lotes = [(1, 0, True, [(ANA, 10, 0)])]
    montar(lotes)
    assert varrer(lotes, {0: {0}}) == 1
    antes = anotados()[0][5]
    time.sleep(1.1)
    assert varrer(lotes, {0: {0}}) == 0, "a segunda varredura gravou de novo"
    linhas = anotados()
    assert len(linhas) == 1, "duplicou"
    assert linhas[0][5] == antes, "a data andou; o carimbo era do primeiro avistamento"


def test_saque_novo_entra_sem_mexer_no_antigo():
    lotes = [(1, 0, True, [(ANA, 10, 0), (BENTO, 20, 1)])]
    montar(lotes)
    varrer(lotes, {0: {0}})
    primeiro = anotados()[0][5]
    time.sleep(1.1)
    assert varrer(lotes, {0: {0, 1}}) == 1
    linhas = anotados()
    assert len(linhas) == 2
    assert linhas[0][5] == primeiro, "o avistamento antigo foi reescrito"
    assert linhas[1][5] >= primeiro


# ─────────────────────────────────────── falha nao apaga

def test_falha_de_rede_nao_apaga_o_que_ja_havia():
    lotes = [(1, 0, True, [(ANA, 10, 0)])]
    montar(lotes)
    varrer(lotes, {0: {0}})
    assert len(anotados()) == 1
    assert varrer(lotes, {0: {0}}, falhar=True) == 0
    assert len(anotados()) == 1, "a varredura que falhou levou o historico junto"


def test_sem_lote_publicado_a_varredura_nao_quebra():
    montar([])
    assert varrer([], {}) == 0


if __name__ == "__main__":
    testes = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    falhas = 0
    for teste in testes:
        try:
            teste()
            print("OK    %s" % teste.__name__)
        except AssertionError as e:
            falhas += 1
            print("FAIL  %s: %s" % (teste.__name__, e))
        except Exception as e:
            falhas += 1
            print("ERRO  %s: %r" % (teste.__name__, e))
    print("\n%d/%d passed" % (len(testes) - falhas, len(testes)))
    sys.exit(1 if falhas else 0)
