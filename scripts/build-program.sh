#!/usr/bin/env bash
# Compila o programa da Solana do jeito que os testes esperam.
#
# Dois detalhes do toolchain que mordem quem roda `anchor build` direto:
#
#   1. o Anchor 1.2 passa `--arch v3` por padrão, e o runtime da LiteSVM usada
#      nos testes não carrega esse ELF — v0 é o alvo padrão do cargo-build-sbf
#      e o mais compatível para deploy;
#   2. o cargo-build-sbf quebra ao reencontrar a toolchain SBF já linkada
#      (passa a linha inteira de `rustup toolchain list -v` como um argumento
#      só), então desfazemos o link antes: ele relinka sozinho.
#
# Uso:  bash scripts/build-program.sh
set -euo pipefail

SBF_TOOLCHAIN="${SBF_TOOLCHAIN:-1.95.0-sbpf-solana-v1.57}"

cd "$(dirname "$0")/../faucetchain"

rustup toolchain uninstall "$SBF_TOOLCHAIN" >/dev/null 2>&1 || true
anchor build --arch v0

readelf -h target/deploy/faucetchain.so | grep -i flags
echo "pronto: target/deploy/faucetchain.so"
