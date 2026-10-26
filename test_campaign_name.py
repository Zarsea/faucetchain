# -*- coding: utf-8 -*-
"""Uma campanha pode ter nome proprio, e o rotulo nunca sai vazio.

Antes disto uma campanha era um numero e herdava o nome do token que paga, o
que confunde duas coisas: dois patrocinadores podem pagar no mesmo token, e um
patrocinador pode rodar varias campanhas no mesmo token. O token diz em QUE se
paga; o nome diz QUAL campanha e.

Tres decisoes sao prendidas aqui, e as tres se desfazem sem ninguem notar:

  **A cadeia de fallback, inteira.** nome proprio -> nome do token -> simbolo
  -> `#numero`. O ultimo degrau usa cerquilha e nao a palavra "Campanha" porque
  a interface fala tres idiomas e um rotulo sem palavra nao precisa de traducao.

  **Nome em branco nao e nome.** String vazia ou so espaco vira None. Sem isso
  um nome em branco passaria pelo fallback como se fosse legitimo e a tela
  ficaria sem rotulo nenhum -- pior que o numero, que ao menos identifica.

  **Omitir o nome preserva o que existe.** O registro e um upsert que tambem
  corrige patrocinador e mint. Sem o COALESCE, re-registrar para trocar o mint
  levaria o nome embora junto, e ninguem ligaria uma coisa na outra.

    python test_campaign_name.py
"""

import os
import shutil
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.abspath(__file__))
SOL_A = "EL5HubafFFn3XLmzXatb6vrEcwXnAPZGjpPAvpkmjLzA"
SOL_B = "So11111111111111111111111111111111111111112"
USER = "0x" + "a7" * 20


def main() -> int:
    workdir = tempfile.mkdtemp(prefix="fcnome-")
    os.chdir(workdir)
    sys.path.insert(0, ROOT)

    os.environ["SETTLEMENT_OPERATOR_TOKEN"] = "op-teste"
    import api_server
    import importlib
    importlib.reload(api_server)
    from fastapi.testclient import TestClient

    api_server.init_settlement_tables()

    # Este arquivo mede o NOME da campanha, nao o mint. O registro passou a
    # conferir o mint na cadeia em 25/10, entao sem isto todo `registra()`
    # abaixo viraria 503 por falta de rede. A checagem de verdade tem o seu
    # proprio arquivo: tests/test_campaign_mint_check.py.
    api_server.conferir_mint_na_cadeia = lambda mint: {"decimals": 6, "owner": "stub"}

    client = TestClient(api_server.app)
    op = {"X-Operator-Token": "op-teste"}

    def registra(cid, **extra):
        corpo = {"campaign_id": cid, "sponsor": SOL_A, "mint": SOL_B}
        corpo.update(extra)
        return client.post("/api/solana/campaign", json=corpo, headers=op)

    def nome_no_banco(cid):
        conn = api_server.get_db_connection()
        linha = conn.execute(
            "SELECT name FROM settlement_campaigns WHERE campaign_id = ?", (cid,)
        ).fetchone()
        conn.close()
        return linha[0]

    # --- o padrao e nulo: nenhuma campanha existente muda ---------------
    r = registra(7001)
    assert r.status_code == 200, r.text
    assert nome_no_banco(7001) is None, "sem nome na chamada, a coluna tem de ficar nula"

    # --- um nome e guardado, com espaco colapsado -----------------------
    r = registra(7002, name="  Airdrop   de   Inverno  ")
    assert r.status_code == 200, r.text
    assert nome_no_banco(7002) == "Airdrop de Inverno", nome_no_banco(7002)
    assert r.json()["name"] == "Airdrop de Inverno", r.text

    # --- branco nao e nome ----------------------------------------------
    for branco in ("", "   ", "\t\n "):
        r = registra(7003, name=branco)
        assert r.status_code == 200, r.text
        assert nome_no_banco(7003) is None, (
            "%r foi guardado como nome; o rotulo da tela ficaria vazio" % branco)

    # --- rotulo e rotulo: ha um teto ------------------------------------
    r = registra(7004, name="x" * (api_server.CAMPAIGN_NAME_MAX + 1))
    assert r.status_code == 400, r.text
    assert "label" in r.text, r.text
    r = registra(7004, name="x" * api_server.CAMPAIGN_NAME_MAX)
    assert r.status_code == 200, "o limite exato tem de passar: %s" % r.text

    # --- omitir o nome preserva; este e o COALESCE ----------------------
    r = registra(7005, name="Campanha de Lancamento")
    assert r.status_code == 200, r.text
    # Re-registro para corrigir o mint, sem mandar nome.
    r = client.post("/api/solana/campaign",
                    json={"campaign_id": 7005, "sponsor": SOL_A, "mint": SOL_A},
                    headers=op)
    assert r.status_code == 200, r.text
    assert nome_no_banco(7005) == "Campanha de Lancamento", (
        "corrigir o mint apagou o nome: %r" % nome_no_banco(7005))

    # --- a cadeia de fallback, degrau por degrau -------------------------
    L = api_server.campaign_label
    assert L("Airdrop de Inverno", "FaucetHunter Rewards", "FHR", 652608) == "Airdrop de Inverno"
    assert L(None, "FaucetHunter Rewards", "FHR", 652608) == "FaucetHunter Rewards"
    assert L(None, None, "FHR", 652608) == "FHR"
    assert L(None, None, None, 652608) == "#652608"
    # Branco em qualquer degrau nao conta como preenchido.
    assert L("   ", "  ", "", 652608) == "#652608"
    # E o ultimo degrau nao tem palavra, porque a tela fala tres idiomas.
    assert "ampanha" not in L(None, None, None, 1) and "ampaign" not in L(None, None, None, 1)

    # --- a tela recebe o rotulo pronto ----------------------------------
    now = int(time.time())
    conn = api_server.get_db_connection()
    conn.execute("INSERT INTO solana_links (user_address, solana_address, linked_at) "
                 "VALUES (?, ?, ?)", (USER, SOL_A, now))
    conn.execute("INSERT INTO settlement_rewards (campaign_id, user_address, amount, created_at) "
                 "VALUES (?, ?, ?, ?)", (7002, USER, 1234, now))
    conn.commit()
    conn.close()

    r = client.get(f"/api/solana/holdings/{USER}")
    assert r.status_code == 200, r.text
    tokens = r.json()["tokens"]
    assert len(tokens) == 1, r.text
    camp = tokens[0]["campaigns"]
    assert isinstance(camp, list) and isinstance(camp[0], dict), (
        "a tela espera objetos com label, nao numeros crus: %r" % camp)
    assert camp[0]["id"] == 7002, camp
    assert camp[0]["label"] == "Airdrop de Inverno", camp

    client.close()
    os.chdir(ROOT)
    shutil.rmtree(workdir, ignore_errors=True)
    print("test_campaign_name.py OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
