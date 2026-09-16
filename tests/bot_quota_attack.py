"""Quanto custa a um bot esvaziar a quota horária da FaucetChain?

Mede a taxa de keccak desta máquina, estima o tempo por prova em cada nível de
dificuldade e compara com a quota da hora. Serve de evidência para o vídeo
técnico: a prova do clique encarece o clique, mas sozinha não segura uma fazenda
de carteiras — por isso existem a dificuldade progressiva e o teto por IP.

    .venv/Scripts/python.exe tests/bot_quota_attack.py
"""
import os
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

import api_server as srv  # noqa: E402

CLAIM_REWARD = 10.0  # valor máximo por claim (decai com o total já explorado)
MEASURE_PROOFS = 12


def measure_hash_rate(bits=12):
    """Resolve provas fáceis e devolve (hashes por segundo, hashes medidos)."""
    hashes = 0
    start = time.perf_counter()
    for i in range(MEASURE_PROOFS):
        nonce = 0
        while True:
            msg = srv.poc_message(495000 + i, "0x" + "ab" * 32, "0x" + f"{i:040x}", nonce)
            digest = srv.keccak256(msg.encode())
            hashes += 1
            nonce += 1
            if int.from_bytes(digest, "big") >> (256 - bits) == 0:
                break
    return hashes / (time.perf_counter() - start), hashes


def main():
    rate, hashes = measure_hash_rate()
    cores = os.cpu_count() or 1
    claims_to_drain = srv.TOKENS_PER_HOUR / CLAIM_REWARD

    print(f"Máquina: {cores} núcleos · {rate:,.0f} hashes/s por núcleo (Python, {hashes:,} hashes medidos)")
    print(f"Quota: {srv.TOKENS_PER_HOUR:,.0f} $CLAIM por hora = {claims_to_drain:,.0f} claims de {CLAIM_REWARD:g}")
    print(f"Teto por IP: {srv.CLAIM_IP_HOURLY_WALLETS} carteiras novas por hora\n")

    print(f"{'bits':>5} {'hashes/prova':>14} {'s/prova':>9} {'claims/h 1 núcleo':>18} {'% da quota':>11} {'IPs necessários':>16}")
    base = srv.CLAIM_PROOF_DIFFICULTY_BITS
    for bits in range(base, base + srv.CLAIM_PROOF_MAX_EXTRA_BITS + 1):
        expected = 2 ** bits
        seconds = expected / rate
        per_hour = 3600 / seconds
        pct = per_hour / claims_to_drain * 100
        ips = claims_to_drain / srv.CLAIM_IP_HOURLY_WALLETS
        print(f"{bits:>5} {expected:>14,} {seconds:>9.2f} {per_hour:>18,.0f} {pct:>10.0f}% {ips:>16,.0f}")

    worst = 2 ** base / rate
    print(f"\nUm núcleo sozinho, na dificuldade base, sustenta ~{3600 / worst:,.0f} claims por hora,")
    print(f"ou {3600 / worst / claims_to_drain:,.1f}x o necessário para esvaziar a hora inteira.")
    print(f"Com {cores} núcleos, {cores * 3600 / worst / claims_to_drain:,.1f}x.")
    print("Código nativo (Rust/C) é mais rápido que Python: trate estes números como piso, não teto.")
    print("\nPor isso a prova não trabalha sozinha:")
    print("  1. a dificuldade sobe 1 bit (o dobro de trabalho) a cada 25% da quota consumida;")
    print(f"  2. cada IP só registra {srv.CLAIM_IP_HOURLY_WALLETS} carteiras novas por hora;")
    print("  3. o Sentinel barra padrões de Sybil no /api/claim.")


if __name__ == "__main__":
    main()
