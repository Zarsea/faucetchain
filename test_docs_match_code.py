"""The documentation may not name a route the server does not serve.

Docs rot quietly. Code moves, the markdown stays, and the first person to
notice is somebody following the guide — who gets a 404 or a 401 and concludes
the integration is broken rather than the page. That happened here: the partner
guide described `GET /api/faucethub/my-key` as returning the API key months
after it stopped, and told operators to rotate a key with an unsigned call that
now answers 401.

So every `/api/...` path written in the maintained documents is checked against
the routes the app actually declares. A path that matches nothing fails this
test, and the message names the file so the fix is obvious.

A path named without its parameter is accepted: a document writing
"GET /api/faucethub/my-key" for a route served at `.../my-key/{wallet}` is
prose, not an error. A path in RETIRED is accepted too, because a change log
has to be able to name what it removed.

This checks that a route EXISTS, not that the surrounding prose is true. It
would not have caught the `my-key` error on its own — that path still exists,
it just stopped returning the key. It catches renames, removals and typos,
which is the bulk of how docs rot, and the rest stays a reading job.

`legacy/` is skipped on purpose: those files are the archived record of a
system that no longer exists, and their own README says so.

    python test_docs_match_code.py
"""

import os
import re
import shutil
import sys
import tempfile

ROOT = os.path.dirname(os.path.abspath(__file__))

# Written in prose as a placeholder, resolved at call time, or simply not a
# route: a path containing any of these is not something to look up.
PLACEHOLDERS = ("...", "<", "{{")

# A parameter's name is the doc's choice; the route's shape is what matters.
PARAM = re.compile(r"\{[^}/]+\}")


# Routes the documents may still name because they are explaining why something
# was removed. A retired path belongs here with its reason, not deleted from the
# prose -- a change log that cannot name what changed is not a change log.
RETIRED = {
    "/api/defi/stake": "removed 2026-09-20; never debited a balance",
    "/api/defi/unstake": "removed 2026-09-20; never debited a balance",
}


def normalise(path):
    return PARAM.sub("{}", path.rstrip("/`.,;:)"))


def documented():
    """Every /api/... path each maintained document mentions."""
    found = {}
    for name in sorted(os.listdir(ROOT)):
        if not name.endswith(".md"):
            continue
        with open(os.path.join(ROOT, name), encoding="utf-8") as fh:
            text = fh.read()
        for raw in re.findall(r"/api/[A-Za-z0-9/_{}.-]+", text):
            if any(bad in raw for bad in PLACEHOLDERS):
                continue
            found.setdefault(normalise(raw), set()).add(name)
    return found


def served():
    """Every path the app declares, in the same normalised shape."""
    os.environ.setdefault("SETTLEMENT_OPERATOR_TOKEN", "x")
    import api_server

    return {normalise(r.path) for r in api_server.app.routes if getattr(r, "path", "")}


def main() -> int:
    workdir = tempfile.mkdtemp(prefix="fcdocs-")
    os.chdir(workdir)
    sys.path.insert(0, ROOT)

    live = served()
    docs = documented()

    def known(path):
        if path in live or path in RETIRED:
            return True
        # A document may name a route without its parameter -- "GET
        # /api/faucethub/my-key" for a route served at ".../my-key/{wallet}".
        # That is prose, not an error.
        return any(r.startswith(path + "/") for r in live)

    missing = {path: files for path, files in docs.items() if not known(path)}

    os.chdir(ROOT)
    shutil.rmtree(workdir, ignore_errors=True)

    print(f"{len(docs)} routes named across the maintained documents")

    if missing:
        print("\nNamed in a document, not served by the app:")
        for path in sorted(missing):
            print(f"  {path:<50} {', '.join(sorted(missing[path]))}")
        print(
            "\nEither the route came back under another name, or the document is\n"
            "describing a server that no longer exists. Fix whichever is wrong."
        )
        return 1

    print("every documented route exists")
    return 0


if __name__ == "__main__":
    sys.exit(main())
