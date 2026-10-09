#!/bin/sh
# Two things the app needs that a container does not give it for free.
set -eu

# 1. The keypairs arrive as strings and the code wants paths.
#
# `solana_settlement.load_keypair(path)` opens a file and parses it as a JSON
# array of bytes. Every secret store hands out environment variables instead,
# so the two keys are written to a file here, at boot, and the variables the
# app reads are pointed at them.
#
# /run is tmpfs: this never reaches the mounted volume, never reaches a
# snapshot, and is gone when the machine stops. umask 077 before writing, so
# the file is never briefly world-readable.
umask 077
mkdir -p /run/keys

if [ -n "${OPERATOR_KEYPAIR_JSON:-}" ]; then
  printf '%s' "$OPERATOR_KEYPAIR_JSON" > /run/keys/operator.json
  SETTLEMENT_OPERATOR_KEYPAIR=/run/keys/operator.json
  export SETTLEMENT_OPERATOR_KEYPAIR
fi

if [ -n "${RELAYER_KEYPAIR_JSON:-}" ]; then
  printf '%s' "$RELAYER_KEYPAIR_JSON" > /run/keys/relayer.json
  SETTLEMENT_RELAYER_KEYPAIR=/run/keys/relayer.json
  export SETTLEMENT_RELAYER_KEYPAIR
fi

# 2. The database path is relative, so the working directory decides where it
# lives.
#
# `get_db_connection()` calls `sqlite3.connect('blockchain.db')` — relative to
# the process's working directory, not to the code. Running from the volume is
# what puts the ledger on the disk that survives a restart. The code stays in
# /app and is importable through PYTHONPATH.
#
# Get this wrong and the server starts cleanly on an empty database, serves
# zero campaigns, and loses every write on the next deploy. It will not error.
DATA_DIR="${DATA_DIR:-/data}"
cd "$DATA_DIR"

if [ ! -f blockchain.db ]; then
  echo "WARNING: $DATA_DIR/blockchain.db does not exist."
  echo "         The server will create an empty ledger and serve nothing."
  echo "         Upload the real one before trusting what this instance says."
fi

# --proxy-headers is not optional behind a proxy: without it every visitor
# arrives as the proxy's own address and shares one rate-limit bucket, which
# turns the limit into an amplifier instead of a defence. This was a HIGH
# finding in the September audit. Trusting '*' is correct only because nothing
# reaches this port except the platform's proxy; if that ever stops being true,
# name the proxy's address here instead.
exec uvicorn api_server:app \
  --host 0.0.0.0 \
  --port "${PORT:-8010}" \
  --proxy-headers \
  --forwarded-allow-ips '*'
