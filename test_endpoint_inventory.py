"""No route may change state without a reason to trust its caller.

Fixing endpoints one at a time does not keep them fixed: the next one ships
open, and nothing notices until somebody audits again. So this walks every
route the app declares, works out what each one relies on, and fails on
anything that changes state and relies on nothing.

A route is allowed to be open only by being named in OPEN_BY_DESIGN below,
with the reason written next to it. That list is the argument; this file is
the enforcement. Adding a name is easy and deliberate, which is the point --
it has to be a decision somebody made in a diff, not an oversight.

The detector reads the handler's source. That is coarse, and coarse in the
safe direction would be to miss a guard and complain; the earlier hand triage
did exactly that on three routes, calling them open when they carry an internal
secret, a proof-of-work, or a per-address ceiling. Every form of guard the
codebase actually uses is listed in GUARDS, so a new one has to be added there
or its routes read as open.

    python test_endpoint_inventory.py
"""

import inspect
import os
import shutil
import sys
import tempfile

ROOT = os.path.dirname(os.path.abspath(__file__))

CHANGES_STATE = {"POST", "PUT", "PATCH", "DELETE"}

# What counts as a reason to trust the caller, and what it is called in source.
GUARDS = {
    "require_action_signature": "the acting wallet signs",
    "require_operator": "operator token",
    "require_node_token": "node token issued at registration",
    "x_api_key": "partner API key",
    "X-Internal-Secret": "internal secret",
    "INTERNAL_SECRET": "internal secret",
    "verify_claim_proof": "proof of work",
    "solve_poc": "proof of work",
    "claim_proof": "proof of work",
}

# Pacing is not authorisation. It is tracked separately because an open route
# with a ceiling is a different risk from an open route without one, and FC-08
# is about the second column, not the first.
PACERS = ("within_rate", "check_rate_limit")

OPEN_BY_DESIGN = {
    # These create the session. Requiring one would be circular.
    "POST /api/auth/register": "issues the session; cannot require one",
    "POST /api/auth/login": "issues the session; cannot require one",
    "POST /api/auth/guest": "issues the session; cannot require one",
    "POST /api/auth/solana": "issues the session; proves itself by wallet signature",
    # Registration creates the identity that later calls authenticate against.
    "POST /api/faucethub/register": "creates the faucet; returns its key once",
    "POST /api/mining/register": "creates the node; reconnecting to an existing "
                                 "node id needs that node's token",
    # The relayer only signs a withdrawal it built and verified itself, and that
    # withdrawal can only pay the leaf's own recipient. An unauthorised caller
    # cannot redirect a cent -- the most they can do is spend the relayer's SOL
    # on somebody else's legitimate withdrawal, which is what the per-address
    # ceiling is for.
    "POST /api/solana/relay/prepare": "cannot redirect funds; paced per address",
    "POST /api/solana/relay/submit": "cannot redirect funds; paced per address",
    # A shared public watchlist on the explorer, with no money attached. The
    # exposure is vandalism rather than theft, which a ceiling answers. A
    # per-account watchlist would be the real fix, and is a feature, not a patch.
    "POST /api/tracker/addresses": "public watchlist; nothing of value attached",
    "DELETE /api/tracker/addresses/{address}": "public watchlist; vandalism only",
    # POST because the query travels in the body. It reads and returns.
    "POST /api/vector-search": "read-only despite the verb",
}


def audit():
    """Every state-changing route, and what it relies on."""
    os.environ.setdefault("SETTLEMENT_OPERATOR_TOKEN", "x")
    import api_server

    found = []
    for route in api_server.app.routes:
        methods = (getattr(route, "methods", None) or set()) & CHANGES_STATE
        if not methods:
            continue
        handler = getattr(route, "endpoint", None)
        try:
            src = inspect.getsource(handler)
        except (OSError, TypeError):
            src = ""
        sig = str(inspect.signature(handler)) if handler else ""
        hay = src + sig
        guards = sorted({label for token, label in GUARDS.items() if token in hay})
        paced = [p for p in PACERS if p in hay]
        for method in sorted(methods):
            found.append({
                "name": f"{method} {route.path}",
                "guards": guards,
                "paced": paced,
            })
    found.sort(key=lambda r: r["name"])
    return found


def main() -> int:
    workdir = tempfile.mkdtemp(prefix="fcinv-")
    os.chdir(workdir)
    sys.path.insert(0, ROOT)

    routes = audit()
    open_routes = [r for r in routes if not r["guards"]]
    unexpected = [r for r in open_routes if r["name"] not in OPEN_BY_DESIGN]

    print(f"{len(routes)} state-changing routes, {len(open_routes)} open")

    if unexpected:
        print("\nOpen, and not on the list:")
        for r in unexpected:
            pace = f"  (paced by {', '.join(r['paced'])})" if r["paced"] else ""
            print(f"  {r['name']}{pace}")
        print(
            "\nEither give it a guard, or add it to OPEN_BY_DESIGN with the reason.\n"
            "Do the second only when the route genuinely cannot require one."
        )

    # A name that no longer matches a route is stale permission: it grants
    # nothing today, and grants everything the day that path comes back.
    live = {r["name"] for r in routes}
    stale = [name for name in OPEN_BY_DESIGN if name not in live]

    # Open routes carry an unsigned request all the way to the database, so a
    # ceiling is the only thing between them and a loop. FC-08.
    unpaced = [r["name"] for r in open_routes if not r["paced"]]

    os.chdir(ROOT)
    shutil.rmtree(workdir, ignore_errors=True)

    if stale:
        print(f"\nOPEN_BY_DESIGN names routes that do not exist: {stale}")
    if unpaced:
        print(f"\nOpen and unpaced, so a loop costs the caller nothing: {unpaced}")

    if unexpected or stale or unpaced:
        return 1
    print("every state-changing route is guarded, or open on purpose and paced")
    return 0


if __name__ == "__main__":
    sys.exit(main())
