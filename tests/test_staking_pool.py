"""O rendimento do staking, que antes era emissão sem teto.

Em 20/10/2026 o cofre pagava uma taxa por posição: 0,5% em 1 hora, 2% em 24h,
10% em 7 dias. Isso não é recompensa, é emissão proporcional ao depósito. Quem
tivesse 400.000 $CLAIM presos emitia 2.000/hora sozinho — a emissão programada
da rede inteira — e nada olhava, porque o caminho do unstake nunca chamou
`record_epoch_mint` e `get_total_minted` não contava o yield. O docstring dela
afirmava que o staking "apenas move supply existente", e não movia.

Os tiers também estavam invertidos: 0,5%/1h são 0,5000%/h, 10%/7d são
0,0567%/h. Travar por uma semana era a pior escolha em qualquer cenário.

O que estes checks protegem, em ordem de quanto dói:

  - depositar mais não emite mais. É a propriedade que o modelo antigo violava,
    e a única que impede uma carteira grande de esvaziar o supply sozinha;
  - o rendimento conta no supply e na quota da hora, como a mineração já
    contava. Teto que não enxerga uma das fontes não é teto;
  - lock mais longo rende mais por $CLAIM preso, não menos.

    .venv/Scripts/python.exe tests/test_staking_pool.py
"""
import asyncio
import os
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMP = tempfile.mkdtemp(prefix="faucetchain-staking-")
os.chdir(TMP)
sys.path.insert(0, ROOT)

os.environ.setdefault("PASSWORD_SALT", "test-salt")

import indexer_service  # noqa: E402

indexer_service.init_db()

import api_server as srv  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

srv.init_staking_positions_table()
srv._migrar_staking()

POOL = srv.STAKING_EPOCH_POOL
_n = [0]


# ─────────────────────────────────────────────────────────────── utilidades

def limpar():
    """Cada teste começa com o cofre e a quota da hora zerados."""
    conn = srv.get_db_connection()
    for tabela in ("staking_positions", "staking_rewards", "hourly_epochs",
                   "mining_rewards", "user_claims"):
        try:
            conn.execute(f"DELETE FROM {tabela}")
        except Exception:
            pass
    conn.commit()
    conn.close()


def posicao(amount, tier=0, staker=None, idade=0):
    """Uma posição aberta. `idade` em segundos recua o depósito, para destravar."""
    _n[0] += 1
    staker = staker or ("0x" + ("%02x" % (_n[0] % 256)) * 20)
    conn = srv.get_db_connection()
    c = conn.cursor()
    c.execute(
        "INSERT INTO staking_positions (staker_address, deposit_amount, "
        "deposit_timestamp, lock_duration, yield_basis_points, tier) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (staker, amount, int(time.time()) - idade,
         srv.TIER_CONFIG[tier]["duration_seconds"],
         srv.TIER_CONFIG[tier]["yield_bp"], tier))
    token_id = c.lastrowid
    conn.commit()
    conn.close()
    return token_id, staker


def distribuir():
    return asyncio.run(srv._distribute_staking_epoch())


def emitido():
    conn = srv.get_db_connection()
    try:
        return srv.get_total_minted(conn.cursor())
    finally:
        conn.close()


def quota_gasta():
    conn = srv.get_db_connection()
    try:
        _, gasto, _ = srv.get_hourly_epoch_state(conn.cursor())
        return gasto
    finally:
        conn.close()


def acumulado(token_id):
    conn = srv.get_db_connection()
    try:
        linha = conn.execute(
            "SELECT accrued_yield FROM staking_positions WHERE token_id = ?",
            (token_id,)).fetchone()
        return linha["accrued_yield"] or 0.0
    finally:
        conn.close()


# ──────────────────────────────────────────── a propriedade que foi violada

def test_depositar_mais_nao_emite_mais():
    """A única coisa que impede uma carteira grande de esvaziar o supply.

    No modelo antigo a emissão era deposito x taxa: 10.000.000 presos emitiam
    50.000/h e 100.000.000 emitiam 500.000/h. Acima do ponto em que o pool
    aperta, dez vezes mais depósito emite exatamente o mesmo.
    """
    limpar()
    posicao(10_000_000)
    distribuir()
    grande = emitido()

    limpar()
    posicao(100_000_000)
    distribuir()
    maior = emitido()

    assert abs(grande - maior) < 1e-6, (
        f"10x o deposito emitiu {maior} contra {grande} — "
        "a emissao voltou a seguir o tamanho do deposito")
    assert maior <= POOL + 1e-6, f"{maior} passou do pool de {POOL}"


def test_cofre_quase_vazio_nao_imprime():
    """O problema inverso: pool fixo com uma posição pequena dentro.

    Sem teto por posição, 3.000 presos levariam os 200/hora inteiros — 6,67%
    por hora. O que o pool não paga não é emitido.
    """
    limpar()
    posicao(3_000, tier=2)
    r = distribuir()
    teto = 3_000 * srv.TIER_CONFIG[2]["weight"] * srv.STAKING_MAX_RATE
    assert r["total_distributed"] <= teto + 1e-6, (r["total_distributed"], teto)
    assert r["total_distributed"] < POOL / 10, (
        f"uma posicao de 3.000 levou {r['total_distributed']} de um pool de {POOL}")


def test_o_que_o_pool_nao_paga_nao_vira_supply():
    """O resto do pool não é redistribuído nem guardado: não existe."""
    limpar()
    antes = emitido()
    posicao(1_000)
    r = distribuir()
    assert abs((emitido() - antes) - r["total_distributed"]) < 1e-6
    assert emitido() - antes < POOL, "emitiu o pool inteiro para uma posicao pequena"


def test_a_taxa_antiga_estouraria_este_teste():
    """Prova que o check acima pega o defeito, em vez de passar por sorte.

    Mesma conta que o `unstake` fazia antes, aplicada ao mesmo depósito.
    """
    deposito = 10_000_000
    antiga = deposito * srv.TIER_CONFIG[0]["yield_bp"] / 10000  # 0,5%
    assert antiga > POOL * 100, "a conta antiga não era tão grande assim?"

    limpar()
    posicao(deposito)
    distribuir()
    assert emitido() < antiga, (
        f"o modelo novo emitiu tanto quanto o antigo ({antiga}) — nada mudou")


def test_uma_baleia_nao_tira_dos_outros_mais_que_a_fatia():
    """Ela dilui, não saca. O pool é o pool."""
    limpar()
    _, _ = posicao(1_000)
    posicao(1_000_000)
    r = distribuir()
    assert r["total_distributed"] <= POOL + 1e-6, r


# ──────────────────────────────────────────── o teto volta a ser teto

def test_o_rendimento_conta_no_supply():
    """get_total_minted não via o yield, e por isso MAX_SUPPLY era um rótulo."""
    limpar()
    antes = emitido()
    posicao(5_000)
    r = distribuir()
    depois = emitido()
    assert abs((depois - antes) - r["total_distributed"]) < 1e-6, (
        f"emitiu {r['total_distributed']} mas o supply andou {depois - antes}")


def test_o_rendimento_conta_na_quota_da_hora():
    """record_epoch_mint nunca era chamado por este caminho."""
    limpar()
    posicao(5_000)
    r = distribuir()
    assert abs(quota_gasta() - r["total_distributed"]) < 1e-6, (
        f"quota gastou {quota_gasta()} para uma emissao de {r['total_distributed']}")


def test_a_quota_da_hora_limita_o_pool():
    """Numa hora quase esgotada, o staking cede — não fura."""
    limpar()
    conn = srv.get_db_connection()
    c = conn.cursor()
    eid, _, _ = srv.get_hourly_epoch_state(c)
    srv.record_epoch_mint(c, eid, srv.TOKENS_PER_HOUR - 50.0)
    conn.commit()
    conn.close()

    posicao(1_000_000)
    r = distribuir()
    assert r["total_distributed"] <= 50.0 + 1e-6, r
    assert quota_gasta() <= srv.TOKENS_PER_HOUR + 1e-6, quota_gasta()


def test_quota_esgotada_nao_distribui():
    limpar()
    conn = srv.get_db_connection()
    c = conn.cursor()
    eid, _, _ = srv.get_hourly_epoch_state(c)
    srv.record_epoch_mint(c, eid, srv.TOKENS_PER_HOUR)
    conn.commit()
    conn.close()

    posicao(1_000)
    r = distribuir()
    assert r["status"] == "hourly_quota_depleted", r
    assert r["distributed"] == 0, r


def test_supply_esgotado_nao_distribui():
    limpar()
    conn = srv.get_db_connection()
    conn.execute(
        "INSERT INTO mining_rewards (epoch_id, wallet_address, node_id, "
        "reward_amount, uptime_share, distributed_at) VALUES (1, 'x', 'x', ?, 100, ?)",
        (srv.MAX_SUPPLY, int(time.time())))
    conn.commit()
    conn.close()

    posicao(1_000)
    assert distribuir()["status"] == "max_supply_reached"


def test_a_soma_das_fatias_nunca_passa_do_pool():
    """Arredondamento para baixo, como na mineração: 37 posições desiguais."""
    limpar()
    for i in range(1, 38):
        posicao(i * 137.77, tier=i % 3)
    r = distribuir()
    assert r["total_distributed"] <= POOL + 1e-6, r

    conn = srv.get_db_connection()
    soma = conn.execute("SELECT COALESCE(SUM(reward_amount), 0) FROM staking_rewards").fetchone()[0]
    conn.close()
    assert abs(soma - r["total_distributed"]) < 1e-6, (soma, r["total_distributed"])


# ──────────────────────────────────────────── a inversão dos tiers

def test_lock_mais_longo_rende_mais_por_claim():
    """Era ao contrário: 1 hora pagava 8,8x mais por hora que 7 dias."""
    limpar()
    curto, _ = posicao(1_000, tier=0)
    longo, _ = posicao(1_000, tier=2)
    distribuir()
    assert acumulado(longo) > acumulado(curto), (
        f"7 dias rendeu {acumulado(longo)} e 1 hora {acumulado(curto)} — "
        "a inversao voltou")


def test_os_pesos_sobem_com_o_lock():
    pesos = [srv.TIER_CONFIG[k]["weight"] for k in sorted(srv.TIER_CONFIG)]
    assert pesos == sorted(pesos) and len(set(pesos)) == len(pesos), pesos


def test_a_fatia_segue_o_peso():
    """Mesmo depósito, tier 0 (peso 1) e tier 2 (peso 8): 1 para 8."""
    limpar()
    curto, _ = posicao(1_000, tier=0)
    longo, _ = posicao(1_000, tier=2)
    distribuir()
    razao = acumulado(longo) / acumulado(curto)
    esperado = srv.TIER_CONFIG[2]["weight"] / srv.TIER_CONFIG[0]["weight"]
    assert abs(razao - esperado) < 0.01, (razao, esperado)


# ──────────────────────────────────────────── o pagamento

def test_o_acumulado_soma_entre_epochs():
    limpar()
    tid, _ = posicao(1_000)
    distribuir()
    uma = acumulado(tid)
    distribuir()
    assert acumulado(tid) > uma, "a segunda epoch nao somou"


def test_posicao_gasta_nao_recebe_mais():
    limpar()
    tid, _ = posicao(1_000)
    conn = srv.get_db_connection()
    conn.execute("UPDATE staking_positions SET is_spent = 1 WHERE token_id = ?", (tid,))
    conn.commit()
    conn.close()
    assert distribuir()["status"] == "no_open_positions"


def test_sem_posicao_aberta_nao_emite():
    limpar()
    antes = emitido()
    distribuir()
    assert abs(emitido() - antes) < 1e-9, "emitiu com o cofre vazio"


def test_o_unstake_paga_o_acumulado_e_nao_a_taxa(client):
    """100 no tier de 7 dias: a taxa antiga pagaria 10,0. Agora paga o rateado."""
    limpar()
    conn = srv.get_db_connection()
    conta = "0xbb" + "cc" * 19
    conn.execute("INSERT OR IGNORE INTO users (email, password_hash, wallet_address, "
                 "created_at) VALUES (?, ?, ?, ?)",
                 ("staker@local", "hash", conta, int(time.time())))
    conn.commit()
    conn.close()
    token = srv.issue_session(conta)["session_token"]

    # destravada: depositada ha mais tempo que o lock
    tid, _ = posicao(100, tier=2, staker=conta,
                     idade=srv.TIER_CONFIG[2]["duration_seconds"] + 60)
    distribuir()
    esperado = acumulado(tid)
    assert esperado > 0, "nao acumulou nada para conferir"

    r = client.post("/api/staking/unstake",
                    json={"staker_address": conta, "token_id": tid},
                    headers={"X-Session-Token": token})
    assert r.status_code == 200, r.text
    corpo = r.json()
    assert abs(corpo["yield_paid"] - esperado) < 1e-6, (corpo["yield_paid"], esperado)
    assert abs(corpo["total_payout"] - (100 + esperado)) < 1e-6, corpo
    taxa_antiga = 100 * srv.TIER_CONFIG[2]["yield_bp"] / 10000
    assert abs(corpo["yield_paid"] - taxa_antiga) > 1e-6, (
        "pagou exatamente a taxa antiga; o caminho velho continua vivo")


def test_as_stats_dizem_estimativa_e_nao_promessa(client):
    limpar()
    posicao(1_000, tier=1)
    d = client.get("/api/staking/stats").json()
    assert d["epochPool"] == POOL, d
    assert d["totalWeight"] > 0, d
    assert "estimatedPerEpochPer1000" in d, d
    for k, v in d["tiers"].items():
        assert "weight" in v, (k, v)


def test_a_estimativa_cai_quando_o_cofre_enche():
    """É o comportamento honesto de um pool fixo, e a tela precisa mostrar."""
    limpar()
    conn = srv.get_db_connection()
    vazio = srv._estimativa(conn.cursor(), 10_000_000.0, 0)[0]
    conn.close()

    posicao(100_000_000)
    conn = srv.get_db_connection()
    cheio = srv._estimativa(conn.cursor(), 10_000_000.0, 0)[0]
    conn.close()
    assert cheio < vazio, (cheio, vazio)


# ──────────────────────────────────────────── o APY que a tela mostra

def apy():
    conn = srv.get_db_connection()
    try:
        return srv._apy_do_cofre(conn.cursor())
    finally:
        conn.close()


def test_cofre_vazio_nao_tem_apy():
    """Antes a rota devolvia 14,5% com o cofre vazio. Nao existe APY de nada."""
    limpar()
    assert apy() == 0.0, apy()


def test_apy_cai_quando_entra_mais_gente():
    """O comportamento honesto de um pool fixo, e o motivo de nao ser constante."""
    limpar()
    posicao(1_000_000, tier=0)
    pouco = apy()
    posicao(100_000_000, tier=0)
    muito = apy()
    assert muito < pouco, (muito, pouco)


def test_com_cofre_pequeno_manda_o_teto_por_posicao():
    """Uma posicao sozinha nao leva o pool inteiro, entao o APY e o teto do tier."""
    limpar()
    posicao(1_000, tier=0)
    esperado = srv.TIER_CONFIG[0]["weight"] * srv.STAKING_MAX_RATE * (365 * 24) * 100
    assert abs(apy() - esperado) < 0.01, (apy(), esperado)


def test_com_cofre_grande_manda_o_pool():
    """Passado o ponto em que o pool aperta, o APY e so pool/deposito."""
    limpar()
    deposito = 500_000_000
    posicao(deposito, tier=0)
    esperado = POOL * (365 * 24) / deposito * 100
    assert abs(apy() - esperado) < 1e-6, (apy(), esperado)


def test_a_formula_antiga_nao_bate_com_nada():
    """min(45, max(5, (100000 / travado) * 10)) nao descrevia pagamento nenhum.

    Com 1.000 travados ela dava os 45% do teto; o cofre paga outra coisa.
    """
    limpar()
    posicao(1_000, tier=0)
    antiga = min(45.0, max(5.0, (100000 / 1_000) * 10))
    assert abs(apy() - antiga) > 1.0, (apy(), antiga)


if __name__ == "__main__":
    import inspect

    testes = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    falhas = 0
    with TestClient(srv.app) as client:
        for teste in testes:
            try:
                teste(client) if inspect.signature(teste).parameters else teste()
                print("OK    %s" % teste.__name__)
            except AssertionError as e:
                falhas += 1
                print("FAIL  %s: %s" % (teste.__name__, e))
            except Exception as e:
                falhas += 1
                print("ERRO  %s: %r" % (teste.__name__, e))
    print("\n%d/%d passed (banco temporario em %s)" % (len(testes) - falhas, len(testes), TMP))
    sys.exit(1 if falhas else 0)
