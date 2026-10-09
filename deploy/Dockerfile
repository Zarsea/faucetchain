# The sequencer, as one always-on process with a disk.
#
# Deliberately NOT serverless. The app opens a SQLite file with 104 write
# statements, starts a background loop that sleeps an hour between epochs, and
# holds WebSocket connections. A function that dies when the response is sent
# cannot do any of the three.
#
#     docker build -f deploy/Dockerfile -t faucetchain-api .
#
# Build context is the repository root, not this directory, because the image
# needs the whole tree. `.dockerignore` keeps `.env`, the ledger and every
# keypair out of it.

FROM python:3.11-slim AS base

# ca-certificates for HTTPS to the Solana RPC. Nothing else, because nothing
# here needs compiling.
#
# Verified rather than assumed, on 9 October:
#
#     pip download --only-binary=:all: --platform manylinux2014_x86_64 \
#         --python-version 311 --implementation cp --abi cp311 \
#         -r requirements.txt -d /tmp/wheels
#
# resolves all 40 wheels. `--only-binary=:all:` fails loudly if any package
# would have to build from source, so a clean run is the proof. solders and
# bcrypt arrive through the stable ABI (`cp310-abi3`, `cp39-abi3`) rather than
# a cp311-specific wheel, which is why grepping the filenames for "cp311"
# wrongly suggests they are missing.
#
# Adding a dependency without a wheel means adding build-essential and a Rust
# toolchain here, and the image stops being 200 MB.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies first, so a code change does not reinstall them.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# `sentence-transformers` and `chromadb` are imported by VectorKnowledgeBase.py
# and are NOT in requirements.txt, on purpose. api_server catches the
# ImportError, prints "Knowledge base features disabled" and runs with
# `kb = None`. Installing them would pull torch and take the image from about
# 200 MB to roughly 3 GB, to power a semantic search the settlement flow never
# touches. If the assistant search is ever needed in production, add them here
# and expect the build and the cold start to change character.

COPY . .

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app

EXPOSE 8010

COPY deploy/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
