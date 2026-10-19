"""Signing in through a platform, proved rather than announced.

This project already had a "Sign in with Google" button once. It minted an
identity in the browser and the server believed it, which is how a string that
was not an address got treated as an account. The button is gone and
`is_custodial_address` now refuses anything that is not a real address, but the
lesson is the one that matters here: **a provider name is not a proof.**

So every provider added to this module answers the same question before an
account is reached — can this server check, on its own, that the platform said
what the browser claims it said? Telegram can: it signs its payload with an
HMAC keyed on the bot token, so verification is arithmetic on data we already
hold, with no network call to make and nothing to trust in between.

Google answers it differently and still answers it. We never accept an ID
token handed over by the browser. The browser comes back carrying a one-time
code, and **this server** trades that code with Google's token endpoint over
TLS. What comes back came from Google, to us, on a channel we opened — so the
claims inside it were never in the browser's hands to edit.

That is also why the sign-in here is a redirect and not the popup button
everyone ships. The popup needs Google's script in our page and `connect-src`
opened to accounts.google.com, and with the session token still living in
localStorage, `connect-src 'self'` is the thing stopping an XSS from mailing
it anywhere. The redirect costs a page load and keeps that shut.

    python social_auth.py       # self-check, no network, no credentials needed
"""

import hashlib
import hmac
import os
import time

# How old a login payload may be. Telegram stamps `auth_date`; without a
# ceiling, one captured payload signs its holder in forever.
AUTH_MAX_AGE = int(os.environ.get("SOCIAL_AUTH_MAX_AGE", 300))


class SocialAuthError(Exception):
    """The payload did not prove what it claimed. Never say which part failed.

    A caller learning *why* learns how to get closer on the next try.
    """


def _bot_token():
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not token:
        raise SocialAuthError("Telegram sign-in is not configured on this server")
    return token


def telegram_check_string(payload):
    """Telegram's own canonical form: every field but `hash`, k=v, sorted, by \\n.

    Reproduced exactly, because the HMAC is over this string and any difference
    -- a missing field, a different order, a stringified number -- produces a
    different digest and an honest login is refused.
    """
    return "\n".join(
        f"{k}={payload[k]}" for k in sorted(payload) if k != "hash" and payload[k] is not None
    )


def verify_telegram(payload, bot_token=None, now=None):
    """The Telegram user id behind a Login Widget payload.

    Telegram keys the HMAC with SHA256 of the bot token, so holding the token
    is what lets this server check the signature. Raises SocialAuthError on
    anything that does not verify; returns the id as a string.
    """
    if not isinstance(payload, dict) or not payload.get("hash") or not payload.get("id"):
        raise SocialAuthError("That sign-in could not be verified")

    token = bot_token or _bot_token()
    secret = hashlib.sha256(token.encode("utf-8")).digest()
    expected = hmac.new(
        secret, telegram_check_string(payload).encode("utf-8"), hashlib.sha256
    ).hexdigest()

    # compare_digest, not ==: a byte-by-byte comparison that stops early leaks
    # how much of a forged hash was right.
    if not hmac.compare_digest(expected, str(payload["hash"])):
        raise SocialAuthError("That sign-in could not be verified")

    # A valid payload is valid forever unless it is also fresh. Telegram's
    # signature says the data is theirs, not that it is from this minute.
    try:
        issued = int(payload.get("auth_date") or 0)
    except (TypeError, ValueError):
        raise SocialAuthError("That sign-in could not be verified")
    if abs((now if now is not None else int(time.time())) - issued) > AUTH_MAX_AGE:
        raise SocialAuthError("That sign-in expired. Try again.")

    return str(payload["id"])


GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
# Os dois valores que o campo `iss` pode ter. Qualquer outro e um token que
# nao veio de quem dizemos que veio.
GOOGLE_ISSUERS = ("accounts.google.com", "https://accounts.google.com")


def google_configured():
    return bool(os.environ.get("GOOGLE_CLIENT_ID") and os.environ.get("GOOGLE_CLIENT_SECRET"))


def _google_credentials():
    cid = os.environ.get("GOOGLE_CLIENT_ID")
    secret = os.environ.get("GOOGLE_CLIENT_SECRET")
    if not cid or not secret:
        raise SocialAuthError("Google sign-in is not configured on this server")
    return cid, secret


def google_authorize_url(redirect_uri, state):
    """Para onde mandar o navegador.

    `state` volta intacto do Google e e conferido na volta: sem ele, qualquer
    um induz a vitima a completar um login que nao foi ela que comecou, e a
    conta da vitima termina ligada ao Google do atacante.

    `prompt=select_account` existe para quem tem mais de uma conta Google nao
    ser silenciosamente logado na errada -- que e como alguem cria conta aqui
    sem perceber e depois nao acha o saldo.
    """
    cid, _ = _google_credentials()
    from urllib.parse import urlencode

    return GOOGLE_AUTH_URL + "?" + urlencode({
        "client_id": cid,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email",
        "state": state,
        "prompt": "select_account",
    })


def _decode_jwt_claims(token):
    """As afirmacoes dentro de um JWT, sem conferir a assinatura.

    Sem conferir de proposito, e so aqui: este token nao veio do navegador.
    Ele chegou da resposta do token endpoint do Google, por TLS, numa conexao
    que este servidor abriu. A assinatura protege um token que atravessou
    terceiros; este nao atravessou nenhum, e e a propria documentacao do Google
    que dispensa a verificacao neste caso.

    Esta funcao nao pode ser usada para token vindo de fora. Se um dia alguem
    aceitar id_token no corpo de um request, a assinatura passa a ser
    obrigatoria e esta funcao e a errada para a tarefa.
    """
    import base64
    import json

    partes = str(token).split(".")
    if len(partes) != 3:
        raise SocialAuthError("That sign-in could not be verified")
    corpo = partes[1]
    corpo += "=" * (-len(corpo) % 4)        # base64url sem padding
    try:
        return json.loads(base64.urlsafe_b64decode(corpo))
    except Exception:
        raise SocialAuthError("That sign-in could not be verified")


def verify_google_code(code, redirect_uri, now=None, _post=None):
    """Troca o codigo com o Google e devolve (sub, email).

    `sub` e a identidade, nunca o e-mail: o e-mail de uma conta Google muda, e
    quem herdasse um endereco reciclado herdaria a conta junto. `sub` nao muda
    e nao se repete.
    """
    cid, secret = _google_credentials()
    enviar = _post or _post_form

    try:
        resposta = enviar(GOOGLE_TOKEN_URL, {
            "code": code,
            "client_id": cid,
            "client_secret": secret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        })
    except Exception:
        raise SocialAuthError("Google did not answer. Try again.")

    id_token = (resposta or {}).get("id_token")
    if not id_token:
        # Codigo ja usado, expirado, ou de outro cliente. O motivo exato fica
        # no log do Google, nao na tela de quem tentou.
        raise SocialAuthError("That sign-in could not be verified")

    c = _decode_jwt_claims(id_token)

    if c.get("iss") not in GOOGLE_ISSUERS:
        raise SocialAuthError("That sign-in could not be verified")
    # `aud` amarra o token a ESTE cliente. Sem esta linha, um token emitido
    # para qualquer outro aplicativo Google entraria aqui como se fosse nosso.
    if c.get("aud") != cid:
        raise SocialAuthError("That sign-in could not be verified")
    agora = now if now is not None else int(time.time())
    try:
        if int(c.get("exp") or 0) <= agora:
            raise SocialAuthError("That sign-in expired. Try again.")
    except (TypeError, ValueError):
        raise SocialAuthError("That sign-in could not be verified")
    sub = c.get("sub")
    if not sub:
        raise SocialAuthError("That sign-in could not be verified")

    # O e-mail e so rotulo, e so vai junto quando o proprio Google diz que o
    # verificou. Nao verificado, nao e identidade nem endereco de contato.
    email = c.get("email") if c.get("email_verified") else None
    return str(sub), email


def _post_form(url, campos):
    import requests

    r = requests.post(url, data=campos, timeout=10)
    r.raise_for_status()
    return r.json()


def account_for(provider, provider_id):
    """The FaucetChain address that belongs to a platform identity.

    Derived, not stored, for the same reason a Solana wallet's account is: the
    same Telegram account reaches the same address on any machine, with no
    password to lose. The provider name is part of the input, so Telegram user
    1 and a future Google subject 1 never collide.
    """
    from Crypto.Hash import keccak as _keccak

    digest = _keccak.new(digest_bits=256)
    digest.update(f"{provider}:{provider_id}".encode("utf-8"))
    return "0x" + digest.hexdigest()[-40:]


def _self_check() -> None:
    TOKEN = "123456:TEST-not-a-real-bot-token"
    now = 1_700_000_000

    def signed(**fields):
        body = {"id": 42, "first_name": "Ada", "auth_date": now, **fields}
        secret = hashlib.sha256(TOKEN.encode()).digest()
        body["hash"] = hmac.new(
            secret, telegram_check_string(body).encode(), hashlib.sha256
        ).hexdigest()
        return body

    # A payload Telegram would have signed verifies, and yields its id.
    assert verify_telegram(signed(), TOKEN, now) == "42"

    # Optional fields join the check string, so one added after signing breaks
    # it -- which is the point: the signature covers everything, not a subset.
    tampered = signed()
    tampered["username"] = "ada"
    for bad, why in (
        (tampered, "a field added after signing"),
        ({**signed(), "id": 43}, "somebody else's id"),
        ({**signed(), "hash": "0" * 64}, "a forged hash"),
        ({"id": 42, "auth_date": now}, "no hash at all"),
        ({"hash": "abc", "auth_date": now}, "no id at all"),
    ):
        try:
            verify_telegram(bad, TOKEN, now)
            raise AssertionError(f"accepted {why}")
        except SocialAuthError:
            pass

    # Fresh enough, and not.
    verify_telegram(signed(auth_date=now - AUTH_MAX_AGE), TOKEN, now)
    for stale in (now - AUTH_MAX_AGE - 1, now + AUTH_MAX_AGE + 1):
        try:
            verify_telegram(signed(auth_date=stale), TOKEN, now)
            raise AssertionError(f"accepted auth_date {stale - now:+d}s away")
        except SocialAuthError:
            pass

    # Unconfigured is refused, not waved through.
    saved = os.environ.pop("TELEGRAM_BOT_TOKEN", None)
    try:
        verify_telegram(signed(), None, now)
        raise AssertionError("signed in with no bot token configured")
    except SocialAuthError:
        pass
    finally:
        if saved is not None:
            os.environ["TELEGRAM_BOT_TOKEN"] = saved

    # ---- Google, sem rede: o token endpoint e substituido por uma funcao ----
    CID = "cliente-de-teste.apps.googleusercontent.com"
    os.environ["GOOGLE_CLIENT_ID"] = CID
    os.environ["GOOGLE_CLIENT_SECRET"] = "segredo-de-teste"

    def jwt_de(claims):
        import base64, json
        cabeca = base64.urlsafe_b64encode(b'{"alg":"RS256"}').decode().rstrip("=")
        corpo = base64.urlsafe_b64encode(json.dumps(claims).encode()).decode().rstrip("=")
        return f"{cabeca}.{corpo}.assinatura-que-nao-conferimos"

    def google_responde(claims):
        return lambda url, campos: {"id_token": jwt_de(claims)}

    bom = {"iss": "https://accounts.google.com", "aud": CID, "sub": "1089",
           "exp": now + 600, "email": "ada@example.com", "email_verified": True}

    sub, email = verify_google_code("cod", "https://x/cb", now, google_responde(bom))
    assert sub == "1089", sub
    assert email == "ada@example.com", email

    # O e-mail so acompanha quando o proprio Google diz que o verificou.
    _, email2 = verify_google_code("cod", "https://x/cb", now,
                                   google_responde({**bom, "email_verified": False}))
    assert email2 is None, email2

    for ruim, porque in (
        ({**bom, "aud": "outro-cliente.apps.googleusercontent.com"}, "token de outro cliente"),
        ({**bom, "iss": "https://accounts.evil.test"}, "emissor trocado"),
        ({**bom, "exp": now - 1}, "token expirado"),
        ({k: v for k, v in bom.items() if k != "sub"}, "sem sub"),
    ):
        try:
            verify_google_code("cod", "https://x/cb", now, google_responde(ruim))
            raise AssertionError(f"aceitou {porque}")
        except SocialAuthError:
            pass

    # Resposta sem id_token -- codigo ja usado, por exemplo -- nao vira conta.
    try:
        verify_google_code("cod", "https://x/cb", now, lambda u, c: {"error": "invalid_grant"})
        raise AssertionError("aceitou resposta sem id_token")
    except SocialAuthError:
        pass

    # Sem credencial, recusa em vez de seguir.
    guardado = (os.environ.pop("GOOGLE_CLIENT_ID"), os.environ.pop("GOOGLE_CLIENT_SECRET"))
    assert not google_configured()
    try:
        verify_google_code("cod", "https://x/cb", now, google_responde(bom))
        raise AssertionError("entrou sem credencial configurada")
    except SocialAuthError:
        pass
    os.environ["GOOGLE_CLIENT_ID"], os.environ["GOOGLE_CLIENT_SECRET"] = guardado
    assert google_configured()

    # A URL de ida leva o state e pede escolha de conta.
    url = google_authorize_url("https://x/cb", "estado-123")
    for pedaco in ("state=estado-123", "response_type=code", "prompt=select_account",
                   "scope=openid+email"):
        assert pedaco in url, (pedaco, url)
    del os.environ["GOOGLE_CLIENT_ID"]
    del os.environ["GOOGLE_CLIENT_SECRET"]

    # An address, and the provider keeps identities apart.
    addr = account_for("telegram", "42")
    assert addr.startswith("0x") and len(addr) == 42, addr
    assert account_for("telegram", "42") == addr, "derivation must be stable"
    assert account_for("google", "42") != addr, "providers must not collide"

    print("social_auth.py OK")


if __name__ == "__main__":
    _self_check()
