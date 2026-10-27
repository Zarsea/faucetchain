"""O contrato entre quem monta a prova e quem a resolve na cadeia.

Em 26/10/2026 a carteira inteira de um usuário sumiu da tela. Não sumiu nada:
`GET /api/solana/holdings/{address}` respondia **500**, e o painel mostrava
zero tokens de campanha porque a rota que os lista estava quebrada.

A causa foi uma chave ausente num dicionário. `_batches_claimed` montava a
prova com `batch_id`, `campaign_id` e `leaf_index`, e `_mark_claimed` deriva o
endereço da raiz a partir de **`root_index`**, que ninguém pôs ali. O outro
chamador, `/api/solana/proof/`, inclui o campo porque o SELECT dele o busca --
então os dois caminhos divergiam e só um estava certo.

**Por que a suíte não pegou.** `_mark_claimed` desiste cedo quando
`chain.load_idl()` levanta, e os testes de holdings rodam num diretório
temporário onde o IDL não resolve. O caminho inteiro era pulado: o teste
afirmava sobre `collected` sem nunca chegar na linha que estourava.

Por isso este arquivo **injeta uma cadeia falsa que carrega**, para que o
caminho real execute. Prende duas coisas:

  - toda prova que sai de `_batches_claimed` carrega `root_index`;
  - prova sem `root_index` vira "não sei" e **não derruba o endpoint**, porque
    uma prova ruim entre várias não pode apagar a carteira inteira.

    .venv/Scripts/python.exe tests/test_claimed_contract.py
"""
import os
import sys
import tempfile
import time
import types

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMP = tempfile.mkdtemp(prefix="faucetchain-claimed-")
os.chdir(TMP)
sys.path.insert(0, ROOT)

os.environ.setdefault("PASSWORD_SALT", "test-salt")
os.environ["SETTLEMENT_OPERATOR_TOKEN"] = "token-de-teste"

import indexer_service  # noqa: E402

indexer_service.init_db()

import api_server as srv  # noqa: E402

srv.init_settlement_tables()

CAMPANHA = 770001
PATROCINADOR = "75vW4HnhtMVcLuHLh3Tm8S1BuFvLVBoLqYoRxQT3SDnE"
CARTEIRA = "AnaWXv2zweyi4ksi9svMV5xpJYtRhmpFbs7HCMsY1HP"


def cadeia(bits_setados=()):
    """Cadeia falsa cujo `load_idl` FUNCIONA -- é isso que faz o caminho rodar."""
    m = types.ModuleType("solana_settlement")
    m.load_idl = lambda: {"ok": True}
    m.program_id = lambda idl: "prog"
    m.campaign_pda = lambda pid, sponsor, cid: f"camp{cid}"
    m.root_pda = lambda pid, campaign, idx: f"{campaign}:raiz{idx}"
    m.default_rpc_url = lambda: "http://fake"
    m.fetch_accounts = lambda url, enderecos: [b"x" for _ in enderecos]
    m.leaf_claimed = lambda data, leaf_index: leaf_index in bits_setados

    # `_root_bitmaps` chama `rpc(url, "getMultipleAccounts", ...)` e espera
    # `{"value": [...]}` com `data` em base64. Sem isto ele devolve None e o
    # teste passa sem olhar bitmap nenhum -- que e exatamente o modo de falhar
    # que este arquivo existe para impedir.
    def rpc(url, metodo, params):
        enderecos = params[0]
        return {"value": [{"data": ["eA==", "base64"]} for _ in enderecos]}

    m.rpc = rpc
    return m


def com_cadeia(fn, bits=()):
    anterior = sys.modules.get("solana_settlement")
    sys.modules["solana_settlement"] = cadeia(bits)
    try:
        return fn()
    finally:
        if anterior is None:
            sys.modules.pop("solana_settlement", None)
        else:
            sys.modules["solana_settlement"] = anterior


def semear(batch_id, root_index):
    conn = srv.get_db_connection()
    try:
        c = conn.cursor()
        agora = int(time.time())
        c.execute("DELETE FROM settlement_campaigns WHERE campaign_id = ?", (CAMPANHA,))
        c.execute("INSERT INTO settlement_campaigns (campaign_id, sponsor, mint, registered_at) "
                  "VALUES (?, ?, 'M', ?)", (CAMPANHA, PATROCINADOR, agora))
        c.execute("DELETE FROM settlement_batches WHERE id = ?", (batch_id,))
        c.execute("""INSERT INTO settlement_batches
                     (id, campaign_id, root_index, root, total_amount, leaf_count,
                      created_at, published_signature)
                     VALUES (?, ?, ?, ?, 100, 1, ?, 'assinado')""",
                  (batch_id, CAMPANHA, root_index, f"0x{batch_id:064x}", agora))
        # Sem recompensa na linha, `_batch_tree` nao reconstroi arvore nenhuma
        # e `_batches_claimed` sai antes de montar a prova.
        c.execute("DELETE FROM settlement_rewards WHERE batch_id = ?", (batch_id,))
        c.execute("""INSERT INTO settlement_rewards
                     (campaign_id, user_address, amount, created_at, batch_id, solana_address)
                     VALUES (?, ?, 100, ?, ?, ?)""",
                  (CAMPANHA, "0x" + "cd" * 20, agora, batch_id, CARTEIRA))
        conn.commit()
    finally:
        conn.close()


# ──────────────────────────────── o contrato: a prova sai com root_index

def test_a_prova_carrega_root_index():
    """Sem isto, `_mark_claimed` levanta KeyError e o endpoint devolve 500."""
    semear(7701, root_index=3)
    vistas = []
    real_mark, real_tree = srv._mark_claimed, srv._batch_tree

    def espiao(c, proofs):
        vistas.extend(proofs)
        return real_mark(c, proofs)

    # A arvore e estubada de proposito: o que esta sendo medido e o CONTRATO
    # entre as duas funcoes, nao a matematica do Merkle, que tem os seus
    # proprios vetores fixos em settlement.py. Sem o estubo, o teste dependeria
    # de semear uma raiz valida e falharia por um motivo que nao e este.
    srv._batch_tree = lambda c, batch_id, root: {
        "claims": [{"recipient": CARTEIRA, "leaf_index": 0, "amount": 100}]}
    srv._mark_claimed = espiao
    try:
        conn = srv.get_db_connection()
        try:
            com_cadeia(lambda: srv._batches_claimed(
                conn.cursor(), {7701: (CAMPANHA, f"0x{7701:064x}", CARTEIRA)}))
        finally:
            conn.close()
    finally:
        srv._mark_claimed, srv._batch_tree = real_mark, real_tree

    assert vistas, "_batches_claimed nao chamou _mark_claimed com prova nenhuma"
    for p in vistas:
        assert "root_index" in p, (
            f"prova do lote {p.get('batch_id')} saiu sem root_index: "
            "e esta exata ausencia que respondeu 500 e apagou a carteira da tela")
        assert p["root_index"] == 3, f"root_index errado: {p['root_index']}"


# ──────────────────────────────── a defesa: prova ruim nao derruba o resto

def test_prova_sem_root_index_vira_nao_sei_em_vez_de_excecao():
    semear(7702, root_index=0)
    provas = [
        {"batch_id": 7702, "campaign_id": CAMPANHA, "root_index": None,
         "leaf_index": 0, "claimed": None},
    ]
    conn = srv.get_db_connection()
    try:
        com_cadeia(lambda: srv._mark_claimed(conn.cursor(), provas))
    finally:
        conn.close()
    assert provas[0]["claimed"] is None, "deveria ficar como nao sabido"


def test_uma_prova_ruim_nao_apaga_as_boas():
    """O ponto todo: a carteira some quando uma linha ruim derruba a resposta."""
    semear(7703, root_index=1)
    provas = [
        {"batch_id": 9999, "campaign_id": CAMPANHA, "root_index": None,
         "leaf_index": 0, "claimed": None},
        {"batch_id": 7703, "campaign_id": CAMPANHA, "root_index": 1,
         "leaf_index": 0, "claimed": None},
    ]
    conn = srv.get_db_connection()
    try:
        com_cadeia(lambda: srv._mark_claimed(conn.cursor(), provas), bits=(0,))
    finally:
        conn.close()
    assert provas[0]["claimed"] is None, "a ruim deveria seguir nao sabida"
    assert provas[1]["claimed"] is True, (
        "a prova boa nao foi resolvida: uma linha ruim contaminou as outras")


# ──────────────────────────────── e a cadeia falsa precisa mesmo rodar

def test_o_caminho_executa_de_verdade():
    """Guarda contra o motivo pelo qual a suite antiga nao pegou o defeito.

    Se `load_idl` levantar, `_mark_claimed` desiste cedo e todo assert acima
    passa sem exercitar nada. Este teste falha se isso voltar a acontecer.
    """
    semear(7704, root_index=2)
    provas = [{"batch_id": 7704, "campaign_id": CAMPANHA, "root_index": 2,
               "leaf_index": 0, "claimed": None}]
    conn = srv.get_db_connection()
    try:
        com_cadeia(lambda: srv._mark_claimed(conn.cursor(), provas), bits=(0,))
    finally:
        conn.close()
    assert provas[0]["claimed"] is True, (
        "a cadeia falsa nao foi exercitada: _mark_claimed desistiu antes de olhar o bitmap")


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
