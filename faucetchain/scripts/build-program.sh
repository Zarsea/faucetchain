#!/usr/bin/env bash
#
# Builds target/deploy/faucetchain.so, which the integration tests load.
#
#     bash scripts/build-program.sh && cargo test --manifest-path programs/faucetchain/Cargo.toml
#
# The header of tests/settlement.rs has told people to run this script since the
# tests were written, and until 3 October the script was not in the repository:
# the instruction was right and the file was missing, so anyone cloning the
# project followed it and got "No such file or directory". That is worse than no
# instruction, because it reads like their mistake.
#
# What the tests actually need is the SBF binary. `cargo test` alone builds the
# host-side unit tests in src/ and passes, which is the trap: the integration
# tests then fail on a missing .so with no hint that a separate build step
# exists.
#
# cargo-build-sbf ships with the Solana toolchain and is usually on PATH after
# `agave-install`. On this machine it is installed but outside the login PATH,
# so the standard install directory is searched as a fallback rather than
# assuming either.
set -euo pipefail

raiz="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$raiz"

if command -v cargo-build-sbf >/dev/null 2>&1; then
    construtor=cargo-build-sbf
elif [ -x "$HOME/.local/share/solana/install/active_release/bin/cargo-build-sbf" ]; then
    construtor="$HOME/.local/share/solana/install/active_release/bin/cargo-build-sbf"
else
    cat >&2 <<'FIM'
cargo-build-sbf not found.

It comes with the Solana toolchain:

    sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"

Then reopen the shell, or add it to PATH for this one:

    export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

Without it the unit tests in programs/faucetchain/src/ still run under plain
`cargo test --lib`; only the integration tests in tests/ need this binary.
FIM
    exit 1
fi

echo "building with $construtor"

# By default cargo-build-sbf asks rustup for the Solana toolchain with a
# `+solana` override. On this machine that path is broken: it parses
# `rustup toolchain list -v`, whose lines are `name<TAB>path`, and hands the
# whole line back as the toolchain name --
#
#   invalid toolchain name '1.95.0-sbpf-solana-v1.57\t/root/.cache/...'
#
# which is a version mismatch between platform-tools and rustup, not a problem
# with this program. `--no-rustup-override` skips rustup, but then the Solana
# rustc has to be found some other way, so RUSTC is pointed at the one that
# ships with the platform-tools release this cargo-build-sbf reports.
#
# The plain invocation is tried first, so a machine with a working rustup is
# unaffected and this fallback stays dead code there.
if "$construtor" "$@"; then
    :
else
    versao="$("$construtor" --version 2>/dev/null | sed -n 's/^platform-tools //p')"
    rustc_solana="$HOME/.cache/solana/${versao}/platform-tools/rust/bin/rustc"
    if [ -z "$versao" ] || [ ! -x "$rustc_solana" ]; then
        echo "the build failed and no platform-tools rustc was found to retry with" >&2
        echo "looked for: $rustc_solana" >&2
        exit 1
    fi
    echo "retrying without the rustup override, RUSTC=$rustc_solana"
    RUSTC="$rustc_solana" "$construtor" --no-rustup-override "$@"
fi

so="$raiz/target/deploy/faucetchain.so"
if [ ! -f "$so" ]; then
    echo "the build reported success but $so is not there" >&2
    exit 1
fi

# The size is printed because an .so that builds and is near-empty has happened
# before in this ecosystem, and a path alone does not tell you which one you got.
echo "ok: $so ($(stat -c %s "$so") bytes)"
