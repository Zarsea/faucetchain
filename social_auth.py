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

    python social_auth.py       # self-check, no network, no bot token needed
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

    # An address, and the provider keeps identities apart.
    addr = account_for("telegram", "42")
    assert addr.startswith("0x") and len(addr) == 42, addr
    assert account_for("telegram", "42") == addr, "derivation must be stable"
    assert account_for("google", "42") != addr, "providers must not collide"

    print("social_auth.py OK")


if __name__ == "__main__":
    _self_check()
