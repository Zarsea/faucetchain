# -*- coding: utf-8 -*-
"""Poe o rendimento antigo do staking na conta do supply.

    python scripts/backfill_staking_yield.py [--dry-run] [--self-check]

Rodar DEPOIS do deploy, porque a tabela staking_rewards nasce no startup do
codigo novo.

Ate 20/10/2026 o unstake pagava deposito x taxa do tier e creditava o resultado
como uma transacao vinda do cofre. O yield era emissao, mas `get_total_minted`
somava so user_claims e mining_rewards, entao nada daquilo entrava na conta do
supply. O commit 11a38fc conserta o caminho: o rendimento passa a sair de um
pool, a ser gravado em staking_rewards e a ser contado.

Sobra o passado. Os valores ja pagos continuam em `transactions` e em
`staking_positions.yield_paid`, e nenhum dos dois e lido por get_total_minted.
Sem esta linha, o contador subestima o supply para sempre -- hoje em 184,5
$CLAIM, que e 0,0002% do maximo. Pequeno, e errado do mesmo jeito: um teto que
nao enxerga uma das fontes nao e um teto, e foi exatamente esse o defeito que
acabamos de consertar.

COMO AS DUAS ERAS SAO SEPARADAS

Posicao da era antiga: yield_paid > 0 e accrued_yield = 0, porque a coluna
accrued_yield nasceu zerada na migracao.
Posicao da era nova: yield_paid = accrued_yield, os dois > 0, e o valor ja esta
em staking_rewards -- somar aqui seria contar duas vezes.

Por isso o filtro e `yield_paid > 0 AND COALESCE(accrued_yield, 0) = 0`, e nao
uma data de corte: ele continua certo seja o script rodado logo apos o deploy ou
semanas depois, com posicoes novas ja fechadas no meio.

IDEMPOTENTE

A linha historica mora em epoch_id = 0, que a distribuicao normal nunca usa
(ela faz MAX(epoch_id) + 1, e comeca em 1). Rodar de novo nao soma outra vez:
o script escreve a DIFERENCA entre o que deveria estar la e o que ja esta, e
nao faz nada quando a diferenca e zero.
"""
import argparse
import os
import sqlite3
import sys
import time

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

MOTIVO_EPOCH = 0          # a era anterior ao pool
MOTIVO_TOKEN = 0          # nenhuma posicao em particular: o agregado
MOTIVO_CONTA = "historico-anterior-ao-pool"
EPSILON = 1e-9


def _tabela_existe(conn, nome):
    return conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
        (nome,)).fetchone() is not None


def medir(conn):
    """(devido, ja_registrado, total_minted) lidos do banco, sem cache."""
    devido = conn.execute(
        "SELECT COALESCE(SUM(yield_paid), 0) FROM staking_positions "
        "WHERE is_spent = 1 AND yield_paid > 0 AND COALESCE(accrued_yield, 0) = 0"
    ).fetchone()[0]

    ja = conn.execute(
        "SELECT COALESCE(SUM(reward_amount), 0) FROM staking_rewards WHERE epoch_id = ?",
        (MOTIVO_EPOCH,)).fetchone()[0]

    # A mesma soma que get_total_minted faz no servidor.
    total = 0.0
    for tabela, coluna in (("user_claims", "amount"),
                           ("mining_rewards", "reward_amount"),
                           ("staking_rewards", "reward_amount")):
        if _tabela_existe(conn, tabela):
            total += conn.execute(
                f"SELECT COALESCE(SUM({coluna}), 0) FROM {tabela}").fetchone()[0]
    return devido, ja, total


def aplicar(conn, falta):
    conn.execute(
        "INSERT INTO staking_rewards (epoch_id, token_id, staker_address, "
        "reward_amount, weight_share, distributed_at) VALUES (?, ?, ?, ?, 0, ?)",
        (MOTIVO_EPOCH, MOTIVO_TOKEN, MOTIVO_CONTA, falta, int(time.time())))
    conn.commit()


def executar(conn, dry_run=False, escrever=print):
    if not _tabela_existe(conn, "staking_rewards"):
        escrever("staking_rewards nao existe neste banco.")
        escrever("Ela nasce no startup do codigo novo: suba o deploy primeiro.")
        return 2

    devido, ja, antes = medir(conn)
    falta = round(devido - ja, 6)

    escrever(f"  rendimento da era antiga   {devido:>12.4f}")
    escrever(f"  ja registrado em epoch 0   {ja:>12.4f}")
    escrever(f"  diferenca a escrever       {falta:>12.4f}")
    escrever("")

    if abs(falta) < EPSILON:
        escrever("Nada a fazer: a conta ja fecha.")
        return 0
    if falta < 0:
        escrever("A linha historica e MAIOR que o devido. Isso nao deveria acontecer;")
        escrever("nao vou subtrair nada sozinho. Olhe a tabela antes de seguir.")
        return 1
    if dry_run:
        escrever(f"dry run: escreveria {falta:.4f} e o supply contado iria para "
                 f"{antes + falta:.4f}")
        return 0

    aplicar(conn, falta)

    # Reler em vez de confiar no que acabamos de escrever.
    devido2, ja2, depois = medir(conn)
    restou = round(devido2 - ja2, 6)
    escrever(f"  supply contado antes       {antes:>12.4f}")
    escrever(f"  supply contado depois      {depois:>12.4f}")
    escrever(f"  diferenca que restou       {restou:>12.4f}")
    if abs(restou) >= EPSILON:
        escrever("\nA conta nao fechou depois de escrever. Nada foi desfeito; confira.")
        return 1
    escrever("\nFechou.")
    return 0


# ─────────────────────────────────────────────────────────── auto-conferencia

def self_check():
    """Roda num banco de brinquedo: as duas eras misturadas, e duas execucoes.

    O que isto pega, e que um banco de producao nao perdoaria:
      - somar uma posicao da era nova, que ja esta em staking_rewards;
      - somar de novo numa segunda execucao.
    """
    conn = sqlite3.connect(":memory:")
    conn.executescript("""
        CREATE TABLE staking_positions (
            token_id INTEGER PRIMARY KEY AUTOINCREMENT,
            is_spent INTEGER DEFAULT 0, yield_paid REAL DEFAULT 0,
            accrued_yield REAL DEFAULT 0);
        CREATE TABLE staking_rewards (
            id INTEGER PRIMARY KEY AUTOINCREMENT, epoch_id INTEGER NOT NULL,
            token_id INTEGER NOT NULL, staker_address TEXT NOT NULL,
            reward_amount REAL NOT NULL, weight_share REAL NOT NULL,
            distributed_at INTEGER NOT NULL);
        CREATE TABLE user_claims (amount REAL);
        CREATE TABLE mining_rewards (reward_amount REAL);
    """)
    # era antiga: 124,5 + 60,0, como em producao
    conn.execute("INSERT INTO staking_positions (is_spent, yield_paid, accrued_yield) VALUES (1, 124.5, 0)")
    conn.execute("INSERT INTO staking_positions (is_spent, yield_paid, accrued_yield) VALUES (1, 60.0, 0)")
    # era nova: ja contada em staking_rewards, nao pode entrar
    conn.execute("INSERT INTO staking_positions (is_spent, yield_paid, accrued_yield) VALUES (1, 7.25, 7.25)")
    conn.execute("INSERT INTO staking_rewards (epoch_id, token_id, staker_address, "
                 "reward_amount, weight_share, distributed_at) VALUES (1, 3, 'x', 7.25, 100, 0)")
    # aberta, sem rendimento pago ainda
    conn.execute("INSERT INTO staking_positions (is_spent, yield_paid, accrued_yield) VALUES (0, 0, 2.0)")
    conn.execute("INSERT INTO user_claims (amount) VALUES (1000)")
    conn.commit()

    mudo = lambda *a, **k: None
    assert executar(conn, escrever=mudo) == 0, "primeira execucao falhou"
    total = conn.execute("SELECT SUM(reward_amount) FROM staking_rewards").fetchone()[0]
    assert abs(total - (184.5 + 7.25)) < 1e-9, f"somou errado: {total}"

    assert executar(conn, escrever=mudo) == 0, "segunda execucao falhou"
    de_novo = conn.execute("SELECT SUM(reward_amount) FROM staking_rewards").fetchone()[0]
    assert abs(de_novo - total) < 1e-9, f"contou duas vezes: {de_novo} contra {total}"

    linhas = conn.execute("SELECT COUNT(*) FROM staking_rewards WHERE epoch_id = 0").fetchone()[0]
    assert linhas == 1, f"{linhas} linhas historicas; deveria haver uma"

    proxima = conn.execute("SELECT COALESCE(MAX(epoch_id), 0) + 1 FROM staking_rewards").fetchone()[0]
    assert proxima > 1, "a linha historica atrapalhou a numeracao das epochs"

    conn.close()
    print("auto-conferencia: 5 checks ok")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(
        description="Conta o rendimento do staking anterior ao pool no supply")
    p.add_argument("--db", default=os.path.join(RAIZ, "blockchain.db"))
    p.add_argument("--dry-run", action="store_true", help="mostra e nao escreve")
    p.add_argument("--self-check", action="store_true",
                   help="roda num banco de brinquedo e nao toca no seu")
    args = p.parse_args()

    if args.self_check:
        return self_check()

    if not os.path.exists(args.db):
        print(f"banco nao encontrado: {args.db}")
        return 2

    print(f"banco: {args.db}\n")
    conn = sqlite3.connect(args.db)
    try:
        return executar(conn, dry_run=args.dry_run)
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
