"""Proves the browser and the server build the same signed sentences.

A wallet signs bytes. If `utils/actionMessage.ts` and `settlement.py` disagree
about a single space, the signature verifies against a different sentence and
the server answers "invalid signature" — which sends you looking at keys and
encodings instead of at a typo. Nothing else in the test suite can catch that,
because each side is self-consistent.

So this runs the real TypeScript, transpiled by the esbuild that already ships
with the frontend, against the real Python, and compares byte for byte.

    python scripts/check_messages.py
"""

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

import settlement  # noqa: E402

TS = os.path.join(ROOT, "utils", "actionMessage.ts")
ESBUILD = os.path.join(ROOT, "node_modules", ".bin", "esbuild.cmd" if os.name == "nt" else "esbuild")

# One fixed input per sentence. The values are arbitrary but frozen, so a
# failure points at the format rather than at whatever the caller passed.
TS_FIXED = 1789618329
USER = "0x7dda72ad9ad56ce3d031ee6a62b5b94dd40c6ef3"
WALLET = "75vW4HnhtMVcLuHLh3Tm8S1BuFvLVBoLqYoRxQT3SDnE"
FAUCET = "0x1b021998f6297936986bcc34f6fdc1cd5c82af06"
POSITION = "utxo-42"

CASES = {
    "claim": (settlement.claim_message(USER, "7777", TS_FIXED), f"claimMessage({USER!r}, {TS_FIXED})"),
    "withdraw": (
        settlement.withdraw_message(USER, FAUCET, "7777", TS_FIXED),
        f"withdrawMessage({USER!r}, {FAUCET!r}, {TS_FIXED})",
    ),
    "stake": (
        settlement.stake_message(USER, 1.5, "GOLD", "7777", TS_FIXED),
        f"stakeMessage({USER!r}, 1.5, 'GOLD', {TS_FIXED})",
    ),
    "unstake": (
        settlement.unstake_message(USER, POSITION, "7777", TS_FIXED),
        f"unstakeMessage({USER!r}, {POSITION!r}, {TS_FIXED})",
    ),
    "link": (
        settlement.link_message(USER, WALLET, "7777", TS_FIXED),
        f"linkMessage({USER!r}, {WALLET!r}, {TS_FIXED})",
    ),
    "wallet_proof": (
        settlement.wallet_proof_message(USER, WALLET, "7777", TS_FIXED),
        f"walletProofMessage({USER!r}, {WALLET!r}, {TS_FIXED})",
    ),
}


def run_typescript() -> dict:
    if not os.path.exists(ESBUILD):
        raise SystemExit("esbuild is missing — run npm install first")

    with tempfile.TemporaryDirectory() as tmp:
        bundle = os.path.join(tmp, "messages.mjs")
        subprocess.run(
            [ESBUILD, TS, "--bundle", "--format=esm", f"--outfile={bundle}"],
            check=True,
            capture_output=True,
        )
        calls = ",\n".join(f"  {name!r}: {expr}" for name, (_, expr) in CASES.items())
        driver = os.path.join(tmp, "driver.mjs")
        with open(driver, "w", encoding="utf-8") as fh:
            fh.write(
                # node needs a file:// URL, not a bare Windows path
                f"import * as m from {json.dumps(Path(bundle).as_uri())};\n"
                f"const {{ {', '.join(sorted({e.split('(')[0] for _, e in CASES.values()}))} }} = m;\n"
                "process.stdout.write(JSON.stringify({\n" + calls + "\n}));\n"
            )
        out = subprocess.run(
            ["node", driver], capture_output=True, text=True, encoding="utf-8"
        )
        if out.returncode != 0:
            raise SystemExit("node failed:\n" + (out.stderr or "").strip())
        return json.loads(out.stdout)


def main() -> None:
    from_ts = run_typescript()
    failures = 0
    for name, (expected, _) in CASES.items():
        actual = from_ts[name]
        if actual == expected:
            print(f"OK    {name}")
        else:
            failures += 1
            print(f"FAIL  {name}")
            print("      python:", repr(expected))
            print("      typescript:", repr(actual))
    print(f"\n{len(CASES) - failures}/{len(CASES)} sentences identical on both sides")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
