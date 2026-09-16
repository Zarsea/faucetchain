#!/usr/bin/env bash
# Builds the Solana program the way the network accepts it.
#
# Agave 4.x no longer enables SBPF v0 execution, so a v0 build is refused at
# deploy time with "Detected sbpf_version required by the executable which are
# not enabled". Anchor's default (v3) is the target.
#
# The one workaround left: cargo-build-sbf breaks when it finds its SBF
# toolchain already linked - it passes the whole `rustup toolchain list -v`
# line, tab included, as a single argument. Unlinking first makes it relink.
#
# Usage:  bash scripts/build-program.sh
set -euo pipefail

SBF_TOOLCHAIN="${SBF_TOOLCHAIN:-1.95.0-sbpf-solana-v1.57}"

cd "$(dirname "$0")/../faucetchain"

rustup toolchain uninstall "$SBF_TOOLCHAIN" >/dev/null 2>&1 || true
anchor build

# The IDL is what every client encodes against, so it is kept in the tree
# rather than only under the ignored target/ directory. Copying it here on
# every build is what stops it drifting from the program that was compiled.
mkdir -p idl
cp target/idl/faucetchain.json idl/faucetchain.json

readelf -h target/deploy/faucetchain.so | grep -i flags
echo "built: target/deploy/faucetchain.so and idl/faucetchain.json"
