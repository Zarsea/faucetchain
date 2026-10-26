"""Uma campanha não entra no banco com um mint que a cadeia não reconhece.

Este arquivo existe por causa de uma conta medida em 25/10/2026. Das 28
campanhas registradas, **23 estavam aposentadas** por terem mint que não é
mint: 14 endereços sem conta nenhuma na devnet, e um que é o sysvar Clock. Os
motivos ficaram gravados no próprio banco, com estas palavras: "nao existe
conta nenhuma neste endereco" e "a conta existe mas pertence a Sysvar1111".

O registro só conferia se o endereço decodifica em base58. Então elas entraram,
acumularam recompensa, e tiveram lote fechado em cima: **3.400.210.048 unidades
creditadas contra campanhas que nunca existiram na cadeia.**

Esse valor não está congelado à espera de decisão. `publish_root` exige conta
Campaign e cofre que cubra o lote, e para essas não há nem conta, nem cofre,
nem mint. É impagável, e `reopen` não alcança -- ele devolve a recompensa para
`batch_id = NULL` e ela fica esperando uma raiz que não pode ser publicada.

O que este arquivo prende é o ponto onde isso ainda dava para evitar:

  - endereço sem conta na cadeia **não** registra;
  - conta que existe mas não é mint **não** registra (o caso do sysvar);
  - mint de Token-2022 **não** registra, porque `create_campaign` o recusa pelo
    `token_program` travado e ele nunca pagaria nada;
  - cadeia muda devolve **503, não sucesso** -- deixar passar "porque não deu
    para conferir" é exatamente como as 23 entraram;
  - e em toda recusa, **nada é escrito no banco.**

    .venv/Scripts/python.exe tests/test_campaign_mint_check.py
"""
import os
import sys
import tempfile
import types

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMP = tempfile.mkdtemp(prefix="faucetchain-mint-")
os.chdir(TMP)
sys.path.insert(0, ROOT)

os.environ.setdefault("PASSWORD_SALT", "test-salt")
os.environ["SETTLEMENT_OPERATOR_TOKEN"] = "token-de-teste"

import indexer_service  # noqa: E402

indexer_service.init_db()

import api_server as srv  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

srv.init_settlement_tables()

cliente = TestClient(srv.app)
CABECALHO = {"X-Operator-Token": "token-de-teste"}

SPL = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
TOKEN22 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
SYSVAR = "Sysvar1111111111111111111111111111111111111"

PATROCINADOR = "75vW4HnhtMVcLuHLh3Tm8S1BuFvLVBoLqYoRxQT3SDnE"
MINT_BOM = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"   # USDC devnet, real
MINT_RUIM = "9Phv8cbF9Uqrk4KvdiszjHo6gfkxpW7CsQtYXosnmUvk"  # um dos 14 inexistentes


def cadeia(valor, falhar=False):
    """`valor` é o que `getAccountInfo` devolve: None, ou o dict da conta."""
    m = types.ModuleType("solana_settlement")
    m.TOKEN_PROGRAM = SPL
    m.default_rpc_url = lambda: "http://fake"

    def rpc(url, metodo, params):
        if falhar:
            raise RuntimeError("devnet fora do ar")
        return {"value": valor}

    m.rpc = rpc
    return m


def conta(dono, tipo="mint", decimais=6):
    return {"owner": dono, "data": {"parsed": {"type": tipo,
                                               "info": {"decimals": decimais}}}}


def registrar(mint, valor, falhar=False, campaign_id=901):
    anterior = sys.modules.get("solana_settlement")
    sys.modules["solana_settlement"] = cadeia(valor, falhar)
    try:
        return cliente.post("/api/solana/campaign", headers=CABECALHO, json={
            "campaign_id": campaign_id, "sponsor": PATROCINADOR, "mint": mint})
    finally:
        if anterior is None:
            sys.modules.pop("solana_settlement", None)
        else:
            sys.modules["solana_settlement"] = anterior


def existe(campaign_id):
    conn = srv.get_db_connection()
    try:
        return bool(conn.execute(
            "SELECT 1 FROM settlement_campaigns WHERE campaign_id = ?",
            (campaign_id,)).fetchone())
    finally:
        conn.close()


# ───────────────────────────────────────────────── as recusas, que é o ponto

def test_endereco_sem_conta_nao_registra():
    """Os 14 mints que não existem. É a maioria do caso real."""
    r = registrar(MINT_RUIM, None, campaign_id=911)
    assert r.status_code == 400, f"HTTP {r.status_code}: {r.text}"
    assert "does not exist" in r.json()["detail"] or "No account" in r.json()["detail"]
    assert not existe(911), "a campanha entrou no banco mesmo com mint inexistente"


def test_conta_que_nao_e_mint_nao_registra():
    """O sysvar Clock: a conta existe, e não é mint."""
    r = registrar(SYSVAR, conta(SYSVAR, tipo="unknown"), campaign_id=912)
    assert r.status_code == 400, f"HTTP {r.status_code}: {r.text}"
    assert "not a token mint" in r.json()["detail"]
    assert not existe(912)


def test_data_em_lista_recusa_em_vez_de_estourar():
    """A forma que a Solana devolve quando NÃO sabe interpretar a conta.

    Com `jsonParsed`, `data` só vem como dicionário para conta de programa
    conhecido. Para qualquer outra -- o sysvar Clock entre elas -- vem como
    lista `[base64, "base64"]`. A primeira versão desta checagem chamava
    `.get("parsed")` nela e estourava com 500, que não recusa nada: quem
    tomasse o 500 podia registrar de novo e seguir em frente.
    """
    bruta = {"owner": SYSVAR, "data": ["AQIDBA==", "base64"]}
    r = registrar(SYSVAR, bruta, campaign_id=918)
    assert r.status_code == 400, f"esperava recusa, veio HTTP {r.status_code}: {r.text}"
    assert "not a token mint" in r.json()["detail"]
    assert not existe(918)


def test_token_2022_nao_registra():
    """O programa recusaria depois; recusar aqui poupa o cofre e a confusão."""
    r = registrar(MINT_BOM, conta(TOKEN22), campaign_id=913)
    assert r.status_code == 400, f"HTTP {r.status_code}: {r.text}"
    detalhe = r.json()["detail"]
    assert "classic SPL" in detalhe
    assert not existe(913)


def test_cadeia_muda_devolve_503_e_nao_registra():
    """Silêncio não é ausência -- e aceitar sem conferir foi o erro original."""
    r = registrar(MINT_BOM, None, falhar=True, campaign_id=914)
    assert r.status_code == 503, f"HTTP {r.status_code}: {r.text}"
    assert not existe(914), "registrou sem conseguir conferir a cadeia"


# ───────────────────────────────────────────────── o caminho feliz

def test_mint_real_registra():
    r = registrar(MINT_BOM, conta(SPL), campaign_id=915)
    assert r.status_code == 200, f"HTTP {r.status_code}: {r.text}"
    assert existe(915)


def test_renomear_nao_exige_cadeia_diferente_mas_reconfere_o_mint():
    """Re-chamar para mudar o nome passa pela mesma porta.

    É de propósito: o upsert sobrescreve `mint`, então uma re-chamada é uma
    chance de trocar o mint por um quebrado, e ela merece a mesma checagem.
    """
    assert registrar(MINT_BOM, conta(SPL), campaign_id=916).status_code == 200
    r = registrar(MINT_RUIM, None, campaign_id=916)
    assert r.status_code == 400
    conn = srv.get_db_connection()
    try:
        mint = conn.execute("SELECT mint FROM settlement_campaigns WHERE campaign_id = 916"
                            ).fetchone()[0]
    finally:
        conn.close()
    assert mint == MINT_BOM, "a re-chamada recusada trocou o mint mesmo assim"


def test_sem_token_de_operador_nao_passa():
    anterior = sys.modules.get("solana_settlement")
    sys.modules["solana_settlement"] = cadeia(conta(SPL))
    try:
        r = cliente.post("/api/solana/campaign", json={
            "campaign_id": 917, "sponsor": PATROCINADOR, "mint": MINT_BOM})
    finally:
        if anterior is None:
            sys.modules.pop("solana_settlement", None)
        else:
            sys.modules["solana_settlement"] = anterior
    assert r.status_code == 401, f"HTTP {r.status_code}"
    assert not existe(917)


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
