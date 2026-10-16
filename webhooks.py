"""Webhooks da FaucetChain para a torneira parceira.

A parceira precisa saber de tres coisas que acontecem aqui e que ela nao tem
como ver: um saque liquidou, um saque falhou, e a reserva da torneira deixou
(ou voltou) a cobrir o que ela deve aos usuarios dela. Sem isso ela so descobre
pelo suporte, depois do usuario reclamar.

Tres decisoes carregam o resto do arquivo.

**Os bytes assinados sao os bytes enviados.** O JSON e serializado uma vez,
guardado como bytes, e e esse mesmo blob que viaja e que entra no HMAC. Assinar
um dicionario e serializar de novo na hora do envio parece igual e nao e: a
ordem das chaves e o espacamento podem mudar entre as duas serializacoes, e o
outro lado recusa com 401 sem ninguem entender por que.

**A fila mora no banco, nao na memoria.** A ultima reentrega e 12 horas depois
da primeira tentativa, e nenhum processo fica 12 horas de pe sem reiniciar. Fila
em memoria perde exatamente os eventos que mais importam -- os que falharam.

**Nada aqui pode derrubar um saque.** Enfileirar e um INSERT; o envio acontece
no laco de fundo, depois, e quem chama nunca espera por rede.

Configuracao, toda por ambiente. Sem o segredo o modulo e inerte: nao grava,
nao envia, nao reclama em todo request.

    FAUCETHUNTER_WEBHOOK_SECRET   segredo compartilhado (sem ele, desligado)
    FAUCETHUNTER_WEBHOOK_URL      destino
    FAUCETHUNTER_FAUCET_WALLET    de qual torneira se avisa (so dela)

Para um teste de ponta a ponta:

    python webhooks.py ping
"""
import hashlib
import hmac
import json
import logging
import os
import time
import uuid

LOG = logging.getLogger("faucetchain.webhook")

URL_PADRAO = "https://faucethunter.net/api/faucetchain_webhook.php"

# 1 min, 5 min, 30 min, 2 h, 12 h -- cinco reentregas depois da primeira
# tentativa. Esgotadas, o evento e abandonado e fica no banco com o motivo:
# apagar a prova de que nao chegou seria a pior forma de desistir.
ESPERAS = (60, 300, 1800, 7200, 43200)

TIMEOUT = 10        # segundos por tentativa
LOTE = 20           # eventos por rodada do laco


# ---------------------------------------------------------------- configuracao
# Lidos a cada chamada, e nao uma vez no import: assim um teste pode ligar e
# desligar o modulo sem reimportar o servidor inteiro.

def segredo() -> str:
    return (os.getenv("FAUCETHUNTER_WEBHOOK_SECRET") or "").strip()


def url() -> str:
    return (os.getenv("FAUCETHUNTER_WEBHOOK_URL") or URL_PADRAO).strip()


def torneira() -> str:
    return (os.getenv("FAUCETHUNTER_FAUCET_WALLET") or "").strip().lower()


def configurado() -> bool:
    return bool(segredo())


# ---------------------------------------------------------------------- tabelas

def criar_tabelas(conn):
    conn.execute('''
        CREATE TABLE IF NOT EXISTS webhook_queue (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id        TEXT NOT NULL UNIQUE,
            event_type      TEXT NOT NULL,
            -- os bytes exatos que serao assinados e enviados, inclusive nas
            -- reentregas: so o timestamp e a assinatura mudam entre elas
            body            BLOB NOT NULL,
            attempts        INTEGER NOT NULL DEFAULT 0,
            next_attempt_at INTEGER NOT NULL,
            last_status     TEXT,
            created_at      INTEGER NOT NULL,
            delivered_at    INTEGER,
            abandoned_at    INTEGER
        )
    ''')
    conn.execute('''
        CREATE INDEX IF NOT EXISTS idx_webhook_pendentes
        ON webhook_queue (next_attempt_at)
        WHERE delivered_at IS NULL AND abandoned_at IS NULL
    ''')
    # O ultimo estado que a parceira recebeu. Existe para so avisar na mudanca:
    # mandar reserve_low a cada verificacao faria ela pausar e despausar o
    # credito dela o dia inteiro.
    conn.execute('''
        CREATE TABLE IF NOT EXISTS faucet_reserve_state (
            faucet_wallet TEXT PRIMARY KEY,
            state         TEXT NOT NULL,
            changed_at    INTEGER NOT NULL
        )
    ''')


# ------------------------------------------------------------------ assinatura

def assinar(ts: str, corpo: bytes) -> str:
    """sha256=<hex do HMAC sobre "{timestamp}.{corpo}">."""
    return "sha256=" + hmac.new(segredo().encode(), ts.encode() + b"." + corpo,
                                hashlib.sha256).hexdigest()


def serializar(tipo: str, dados: dict) -> bytes:
    """O corpo, uma vez so. Separadores fixos para nao depender do padrao."""
    return json.dumps({"type": tipo, "data": dados}, separators=(",", ":")).encode()


# ------------------------------------------------------------------------ fila

def enfileirar(conn, tipo: str, dados: dict):
    """Grava o evento para entrega. Nao envia e nao faz commit.

    Devolve o event_id, ou None quando o modulo esta desligado.
    """
    if not configurado():
        return None
    agora = int(time.time())
    eid = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO webhook_queue (event_id, event_type, body, attempts, "
        "next_attempt_at, created_at) VALUES (?, ?, ?, 0, ?, ?)",
        (eid, tipo, serializar(tipo, dados), agora, agora))
    return eid


def pendentes(conn, agora: int = None):
    agora = agora or int(time.time())
    return conn.execute(
        "SELECT * FROM webhook_queue WHERE delivered_at IS NULL AND abandoned_at IS NULL "
        "AND next_attempt_at <= ? ORDER BY id LIMIT ?", (agora, LOTE)).fetchall()


def cabecalhos(event_id: str, corpo: bytes, agora: int = None) -> dict:
    ts = str(agora or int(time.time()))
    return {
        "Content-Type": "application/json",
        "X-FaucetChain-Event-Id": event_id,
        "X-FaucetChain-Timestamp": ts,
        "X-FaucetChain-Signature": assinar(ts, corpo),
    }


def registrar_resultado(conn, linha, ok: bool, estado: str, agora: int = None):
    """Marca entregue, reagenda, ou abandona quando as esperas acabaram."""
    agora = agora or int(time.time())
    tentativas = linha["attempts"] + 1
    if ok:
        conn.execute("UPDATE webhook_queue SET delivered_at = ?, attempts = ?, "
                     "last_status = ? WHERE id = ?",
                     (agora, tentativas, estado, linha["id"]))
    elif tentativas > len(ESPERAS):
        conn.execute("UPDATE webhook_queue SET abandoned_at = ?, attempts = ?, "
                     "last_status = ? WHERE id = ?",
                     (agora, tentativas, estado, linha["id"]))
        LOG.error("Webhook %s (%s) abandonado apos %d tentativas: %s",
                  linha["event_id"], linha["event_type"], tentativas, estado)
    else:
        conn.execute("UPDATE webhook_queue SET attempts = ?, next_attempt_at = ?, "
                     "last_status = ? WHERE id = ?",
                     (tentativas, agora + ESPERAS[tentativas - 1], estado, linha["id"]))
    conn.commit()


async def drenar(conn, cliente, agora: int = None):
    """Tenta entregar o que esta vencido. Devolve (entregues, falhas)."""
    agora = agora or int(time.time())
    entregues = falhas = 0
    for linha in pendentes(conn, agora):
        corpo = bytes(linha["body"])
        try:
            r = await cliente.post(url(), content=corpo,
                                   headers=cabecalhos(linha["event_id"], corpo),
                                   timeout=TIMEOUT)
            ok, estado = 200 <= r.status_code < 300, str(r.status_code)
        except Exception as e:
            ok, estado = False, repr(e)[:120]
        registrar_resultado(conn, linha, ok, estado, agora)
        entregues += 1 if ok else 0
        falhas += 0 if ok else 1
    return entregues, falhas


if __name__ == "__main__":
    import asyncio
    import sys

    import httpx

    if not configurado():
        print("FAUCETHUNTER_WEBHOOK_SECRET nao esta no ambiente. Nada a fazer.")
        sys.exit(1)

    tipo = sys.argv[1] if len(sys.argv) > 1 else "ping"
    corpo = serializar(tipo, {})
    eid = str(uuid.uuid4())

    async def principal():
        async with httpx.AsyncClient() as cliente:
            for rotulo, ident in (("envio", eid), ("reenvio do mesmo id", eid)):
                r = await cliente.post(url(), content=corpo,
                                       headers=cabecalhos(ident, corpo), timeout=TIMEOUT)
                print(f"{rotulo:22} -> {r.status_code} {r.text[:120]}")
            # Assinatura errada tem que ser recusada; se passar, o outro lado
            # nao esta conferindo nada.
            maus = cabecalhos(str(uuid.uuid4()), corpo)
            maus["X-FaucetChain-Signature"] = "sha256=" + "0" * 64
            r = await cliente.post(url(), content=corpo, headers=maus, timeout=TIMEOUT)
            print(f"{'assinatura errada':22} -> {r.status_code} (esperado 401)")

    asyncio.run(principal())
