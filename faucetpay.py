"""Identity against FaucetPay. No money moves through this module.

FaucetPay's `check-address` answers one question: does this address belong to
some registered account? It returns that account's user hash, which is the
join key this project wanted -- the same developer running three faucets comes
back as one hash, and until now nothing here could tell three faucets from
three people.

What it does NOT answer is who controls the account. Anyone can type anyone's
payout address, and a link built on that alone pays a stranger. So a linked
account starts out *named*, not *proved*, and becomes proved the only way the
API allows: a payment arrives from it. FaucetPay has no escrow and no
delegated authorisation, so an incoming payment is the sole thing a third
party cannot forge.

The amount is the whole trick. We hand out an amount nobody else has open, in
the smallest unit, and watch for it. That is the one-cent bank deposit, and it
works for the same reason.

    python faucetpay.py       # runs the self-check, touches no network
"""

import json as _json
import os
import random as _random
import urllib.request as _urlreq

API_V1 = "https://faucetpay.io/api/v1"

# The currency check-address is asked about. The hash it returns identifies the
# account, not the coin, so one currency is enough to establish identity.
IDENTITY_CURRENCY = os.environ.get("FAUCETPAY_IDENTITY_CURRENCY", "BTC")

# How long a dev has to send the proving payment, and the band the amount is
# drawn from. The band is in satoshi: wide enough that concurrent challenges
# rarely collide, small enough that proving costs almost nothing.
PROOF_WINDOW_SECONDS = int(os.environ.get("FAUCETPAY_PROOF_WINDOW", 24 * 3600))
PROOF_AMOUNT_MIN = int(os.environ.get("FAUCETPAY_PROOF_MIN", 100))
PROOF_AMOUNT_MAX = int(os.environ.get("FAUCETPAY_PROOF_MAX", 999))


class FaucetPayUnavailable(RuntimeError):
    """The API could not be reached, or no key is configured.

    Separate from "the address is not registered", which is an answer. This is
    the absence of one, and the caller must not record either outcome from it.
    """


def _post(path: str, payload: dict, transport=None) -> dict:
    """One POST. `transport` exists so the callers above can be tested."""
    if transport is not None:
        return transport(path, payload)

    api_key = os.environ.get("FAUCETPAY_API_KEY")
    if not api_key:
        raise FaucetPayUnavailable(
            "FAUCETPAY_API_KEY is not set. Identity linking is off until it is."
        )
    body = _json.dumps({**payload, "api_key": api_key}).encode("utf-8")
    req = _urlreq.Request(
        f"{API_V1}/{path}",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with _urlreq.urlopen(req, timeout=8) as resp:
            return _json.loads(resp.read().decode("utf-8"))
    except Exception as exc:  # network, timeout, malformed body
        raise FaucetPayUnavailable(str(exc)) from exc


def check_address(address: str, currency: str = None, transport=None):
    """The user hash behind a payout address, or None if it belongs to nobody.

    None is an answer, not a failure: the address is simply not registered at
    FaucetPay. A failure raises, so the caller never writes a link because the
    network was down.
    """
    address = (address or "").strip()
    if not address:
        return None
    data = _post(
        "checkaddress",
        {"address": address, "currency": (currency or IDENTITY_CURRENCY).upper()},
        transport,
    )
    if not data.get("success"):
        return None
    # v1 nests the hash one level down; v2 returns it flat. Accept both rather
    # than pin a shape we cannot test against the live service yet.
    inner = data.get("data") if isinstance(data.get("data"), dict) else data
    for key in ("payout_user_hash", "user_hash", "hash"):
        value = inner.get(key)
        if value:
            return str(value)
    return None


def open_challenge(taken, rng=None) -> int:
    """An amount, in satoshi, that no other open challenge is waiting on.

    Uniqueness only has to hold among challenges open at the same time, which
    is why `taken` is passed in rather than read from anywhere: the caller
    knows which ones those are, and this stays a function.
    """
    taken = set(taken or ())
    span = PROOF_AMOUNT_MAX - PROOF_AMOUNT_MIN + 1
    if len(taken) >= span:
        raise FaucetPayUnavailable(
            "Every proof amount is already spoken for. Widen FAUCETPAY_PROOF_MIN"
            " and FAUCETPAY_PROOF_MAX, or expire the stale challenges."
        )
    rng = rng or _random
    while True:
        amount = rng.randint(PROOF_AMOUNT_MIN, PROOF_AMOUNT_MAX)
        if amount not in taken:
            return amount


def match_proof(payments, user_hash: str, amount: int, opened_at: int,
                window: int = None):
    """The payment that proves the account, or None.

    Every condition here is load-bearing, and dropping any one of them turns
    the proof into a formality:

    - same user hash, or somebody else's payment proves your account
    - exact amount, or one payment satisfies every open challenge at once
    - inside the window, or a payment made years ago for another reason counts

    `payments` is a sequence of dicts with `user_hash`, `amount` and
    `timestamp`; normalising FaucetPay's payload into that shape is the
    caller's job, and the one seam here that has not been run against the live
    service.
    """
    window = PROOF_WINDOW_SECONDS if window is None else window
    deadline = int(opened_at) + int(window)
    for payment in payments or ():
        if str(payment.get("user_hash") or "") != str(user_hash):
            continue
        if int(payment.get("amount") or 0) != int(amount):
            continue
        ts = int(payment.get("timestamp") or 0)
        if ts < int(opened_at) or ts > deadline:
            continue
        return payment
    return None


def _self_check() -> None:
    # check_address reads both payload shapes, and tells "not registered"
    # apart from "could not ask".
    v1 = lambda p, d: {"success": True, "data": {"payout_user_hash": "hash-v1"}}
    v2 = lambda p, d: {"success": True, "payout_user_hash": "hash-v2"}
    nope = lambda p, d: {"success": False, "message": "Invalid address"}
    assert check_address("1Boat", transport=v1) == "hash-v1"
    assert check_address("1Boat", transport=v2) == "hash-v2"
    assert check_address("1Boat", transport=nope) is None
    assert check_address("   ", transport=v1) is None

    def dead(path, payload):
        raise FaucetPayUnavailable("connection refused")

    try:
        check_address("1Boat", transport=dead)
        raise AssertionError("an unreachable API must raise, never return None")
    except FaucetPayUnavailable:
        pass

    # The amount never collides with one already open.
    taken = set(range(PROOF_AMOUNT_MIN, PROOF_AMOUNT_MAX))  # all but the last
    assert open_challenge(taken) == PROOF_AMOUNT_MAX

    # The four ways a proof must fail, and the one way it passes.
    OPENED, HASH, AMOUNT = 1_700_000_000, "dev-hash", 137
    good = {"user_hash": HASH, "amount": AMOUNT, "timestamp": OPENED + 60}
    assert match_proof([good], HASH, AMOUNT, OPENED) is good

    assert match_proof([{**good, "user_hash": "someone-else"}], HASH, AMOUNT, OPENED) is None
    assert match_proof([{**good, "amount": AMOUNT + 1}], HASH, AMOUNT, OPENED) is None
    assert match_proof([{**good, "timestamp": OPENED - 1}], HASH, AMOUNT, OPENED) is None
    assert match_proof([{**good, "timestamp": OPENED + PROOF_WINDOW_SECONDS + 1}],
                       HASH, AMOUNT, OPENED) is None
    assert match_proof([], HASH, AMOUNT, OPENED) is None

    # Both edges of the window are inside it.
    for ts in (OPENED, OPENED + PROOF_WINDOW_SECONDS):
        assert match_proof([{**good, "timestamp": ts}], HASH, AMOUNT, OPENED) is not None, ts

    # The right payment is found even when wrong ones come first.
    noise = [{**good, "amount": AMOUNT + 5}, {**good, "user_hash": "x"}, good]
    assert match_proof(noise, HASH, AMOUNT, OPENED) is good

    print("faucetpay.py OK")


if __name__ == "__main__":
    _self_check()
