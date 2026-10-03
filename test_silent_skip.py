# -*- coding: utf-8 -*-
"""Uma campanha que nao paga tem de dizer por que nao pagou.

O laco das campanhas tinha seis saidas silenciosas e todas as seis devolvem
`campaigns: []`. Do lado do parceiro isso e identico a "esta torneira nao esta
inscrita em nada", e foi por isso que o caso da taxa arredondada para zero
passou setembro inteiro sem ser visto: o teste do contrato passava todo dia e
falhou em 1 de outubro pela data, nao por uma mudanca de codigo.

O que este teste prende nao e o calculo -- e o fato de a resposta explicar.
Tres asserções, na ordem em que elas importam:

  **A lista continua lista.** `campaigns` tem o mesmo formato de sempre, porque
  a FaucetHunter le ela em producao. A explicacao entra ao lado, nunca no lugar.

  **Cada pulo nomeia a si mesmo.** Com `reason` legivel por maquina e `detail`
  legivel por pessoa, porque quem recebe isso e um patrocinador decidindo se
  aumenta a cota, e "nada aconteceu" nao e uma decisao que da para tomar.

  **Zero continua nao debitando.** A unica misericordia do bug original era que
  o `continue` acontece antes da escrita. Se uma correcao de mensagem passar a
  debitar, o dinheiro sai sem ninguem receber.

O orcamento aqui e calculado a partir do dia de hoje, de proposito. Numero fixo
foi exatamente o que fez o outro teste depender do calendario.

    python test_silent_skip.py
"""

import os
import shutil
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.abspath(__file__))
SOLANA_WALLET = "EL5HubafFFn3XLmzXatb6vrEcwXnAPZGjpPAvpkmjLzA"


def main() -> int:
    workdir = tempfile.mkdtemp(prefix="fcskip-")
    os.environ["SETTLEMENT_OPERATOR_TOKEN"] = "operator-test-token"
    os.chdir(workdir)
    sys.path.insert(0, ROOT)

    import api_server
    import distribution
    from fastapi.testclient import TestClient

    api_server.init_users_table()
    api_server.init_settlement_tables()
    api_server.init_faucet_registry_table()
    api_server.init_faucet_api_keys_table()
    api_server.init_microclaims_tables()
    client = TestClient(api_server.app)
    op = {"X-Operator-Token": "operator-test-token"}

    r = client.post("/api/faucethub/register", json={
        "name": "FaucetHunter", "wallet_address": "0x" + "11" * 20})
    assert r.status_code == 200, r.text
    api_key = r.json()["api_key"]
    faucet = "0x" + "11" * 20

    def inscreve(campaign_id, budget=None):
        r = client.post("/api/solana/campaign", json={
            "campaign_id": campaign_id, "sponsor": SOLANA_WALLET,
            "mint": "So11111111111111111111111111111111111111112"}, headers=op)
        assert r.status_code == 200, r.text
        if budget:
            r = client.post(f"/api/solana/campaign/{campaign_id}/budget",
                            json=budget, headers=op)
            assert r.status_code == 200, r.text
        r = client.post(f"/api/solana/campaign/{campaign_id}/faucets",
                        json={"faucets": [faucet]}, headers=op)
        assert r.status_code == 200, r.text

    def clique(user):
        r = client.post("/api/faucethub/microclaim",
                        json={"user_wallet": user, "amount": 1.0},
                        headers={"X-Api-Key": api_key})
        assert r.status_code == 200, r.text
        b = r.json()
        # O contrato do parceiro nao muda de forma: ele itera nesta lista.
        assert isinstance(b["campaigns"], list), b
        assert isinstance(b.get("campaigns_skipped"), list), (
            "a resposta precisa trazer os pulos: %r" % sorted(b))
        return b

    # --- o orcamento que produz cada caso, medido hoje ------------------
    dias = api_server._days_left_in_month(int(time.time()))
    P = distribution.DEFAULT_PARTICIPATION

    # O bruto e truncado para inteiro, e o divisor e um float -- entao o valor
    # que produz exatamente 1 e procurado, nao deduzido. Deduzi-lo daria
    # 30*288*0.10 = 864.0000000000001, e o teste cairia no caso errado.
    alvo1 = dias * 864
    while distribution.per_click(alvo1, dias, 0, P) < 1:
        alvo1 += 1
    assert distribution.per_click(alvo1, dias, 0, P) == 1, dias

    alvo0 = dias * 100
    assert distribution.per_click(alvo0, dias, 0, P) == 0, dias

    # --- as quatro campanhas, inscritas antes de qualquer clique --------
    # Um clique so, de proposito: e o que o parceiro realmente recebe, e o
    # cooldown de cinco minutos por usuario torna qualquer outro arranjo uma
    # ficcao. As quatro saem na mesma resposta.
    inscreve(990101)                                             # sem orcamento
    inscreve(990102, {"total_budget": alvo0 * 10, "monthly_cap": alvo0,
                      "funding": "vault"})                       # bruto 0
    inscreve(990103, {"total_budget": alvo1 * 10, "monthly_cap": alvo1,
                      "funding": "vault"})                       # bruto 1, usuario 0
    inscreve(990104, {"total_budget": 100_000_000, "monthly_cap": 10_000_000,
                      "funding": "vault"})                       # paga

    b = clique(SOLANA_WALLET)
    pagas = {p["campaign_id"]: p for p in b["campaigns"]}
    pulos = {p["campaign_id"]: p for p in b["campaigns_skipped"]}

    # --- cada pulo nomeia a si mesmo ------------------------------------
    assert pulos[990101]["reason"] == "no_budget", pulos
    assert pulos[990101]["detail"], "reason sem detail nao ajuda ninguem"
    assert pulos[990102]["reason"] == "rate_rounds_to_zero", pulos

    # O caso de 1 de outubro, o que o checklist registrou.
    assert pulos[990103]["reason"] == "user_share_rounds_to_zero", pulos
    assert str(distribution.USER_SHARE) in pulos[990103]["detail"], (
        "o detalhe precisa dizer qual split comeu o valor: %r" % pulos[990103])

    # --- e a que paga nao aparece entre os pulos ------------------------
    assert 990104 in pagas and pagas[990104]["amount"] > 0, b
    assert 990104 not in pulos, "uma campanha nao pode pagar e ser pulada"
    assert set(pagas) == {990104}, (
        "so a campanha com orcamento de verdade devia pagar: %r" % sorted(pagas))

    # --- nada foi debitado das campanhas que nao pagaram ----------------
    conn = api_server.get_db_connection()
    for cid in (990102, 990103):
        g = tuple(conn.execute(
            "SELECT spent_total, spent_month, treasury_owed FROM campaign_budget "
            "WHERE campaign_id = ?", (cid,)).fetchone())
        assert g == (0, 0, 0), (
            "a campanha %d nao pagou ninguem e teve o orcamento debitado: %r" % (cid, g))
    n = conn.execute(
        "SELECT COUNT(*) FROM settlement_rewards WHERE campaign_id IN (990101,990102,990103)"
    ).fetchone()[0]
    conn.close()
    assert n == 0, "pulo que escreve recompensa paga dinheiro que ninguem recebe"

    client.close()
    os.chdir(ROOT)
    shutil.rmtree(workdir, ignore_errors=True)
    print("test_silent_skip.py OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
