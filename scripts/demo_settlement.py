"""
FaucetChain — the whole payout, end to end, against a running program.

This is the demo, and it is also the strongest test the project has: it drives
the real chain and the real sequencer, and the only thing connecting them is a
32-byte root.

    1. a partner opens a campaign and funds its vault;
    2. two users link the Solana wallet that will receive the payout;
    3. the operator credits rewards and closes a batch;
    4. the root of that batch goes on-chain, through publish_root.py;
    5. each user withdraws with the proof the sequencer serves — holding no SOL
       of their own, with a relayer paying the fee and the rent;
    6. the partner takes back the surplus that was never promised.

Nothing here is mocked. If the tree the backend builds were not the tree the
program verifies, step 5 would fail.

    solana-test-validator --reset            # in another terminal
    solana program deploy .../faucetchain.so
    SETTLEMENT_OPERATOR_TOKEN=... python api_server.py
    python scripts/demo_settlement.py --rpc http://127.0.0.1:8899

Against devnet, pass --rpc and expect the airdrops to be rate limited.
"""

import argparse
import base64
import calendar
import json
import os
import subprocess
import sys
import tempfile
import time

if sys.platform == "win32":  # the demo gets screen-recorded; cp1252 mangles it
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import requests
from eth_account import Account
from eth_account.messages import encode_defunct
from solders.instruction import AccountMeta, Instruction
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.transaction import Transaction

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

import settlement  # noqa: E402
import distribution  # noqa: E402
import solana_settlement as chain  # noqa: E402

MINT_LEN = 82
TOKEN_ACCOUNT_LEN = 165
DECIMALS = 6
UNIT = 10**DECIMALS
# What a click should be worth on screen. The budget is derived from this,
# not the other way round, so the demo reads the same in any month.
PER_CLICK_TARGET = 25 * 10**DECIMALS
LAMPORT = 10**9


# --------------------------------------------------------------------------
# The few SPL and system instructions the demo needs to set a stage
# --------------------------------------------------------------------------


def create_account_ix(payer: Pubkey, new: Pubkey, lamports: int, space: int, owner: Pubkey):
    data = (
        (0).to_bytes(4, "little")
        + lamports.to_bytes(8, "little")
        + space.to_bytes(8, "little")
        + bytes(owner)
    )
    return Instruction(
        chain.SYSTEM_PROGRAM, data, [AccountMeta(payer, True, True), AccountMeta(new, True, True)]
    )


def transfer_ix(payer: Pubkey, to: Pubkey, lamports: int):
    """System transfer. On devnet the faucet is rate limited, so the actors are
    funded from one wallet that already holds SOL instead of begging for it."""
    data = (2).to_bytes(4, "little") + lamports.to_bytes(8, "little")
    return Instruction(
        chain.SYSTEM_PROGRAM, data, [AccountMeta(payer, True, True), AccountMeta(to, False, True)]
    )


def initialize_mint_ix(mint: Pubkey, authority: Pubkey, decimals: int):
    # InitializeMint2: tag 20, decimals, mint authority, then the freeze
    # authority as an option — 0 alone when there is none.
    data = bytes([20, decimals]) + bytes(authority) + bytes([0])
    return Instruction(chain.TOKEN_PROGRAM, data, [AccountMeta(mint, False, True)])


def initialize_token_account_ix(account: Pubkey, mint: Pubkey, owner: Pubkey):
    data = bytes([18]) + bytes(owner)  # InitializeAccount3
    return Instruction(
        chain.TOKEN_PROGRAM, data, [AccountMeta(account, False, True), AccountMeta(mint, False, False)]
    )


def mint_to_ix(mint: Pubkey, account: Pubkey, authority: Pubkey, amount: int):
    data = bytes([7]) + amount.to_bytes(8, "little")  # MintTo
    return Instruction(
        chain.TOKEN_PROGRAM,
        data,
        [
            AccountMeta(mint, False, True),
            AccountMeta(account, False, True),
            AccountMeta(authority, True, False),
        ],
    )


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------


def airdrop(rpc_url: str, who: Pubkey, sol: int) -> None:
    chain.rpc(rpc_url, "requestAirdrop", [str(who), sol * LAMPORT])
    for _ in range(30):
        balance = chain.rpc(rpc_url, "getBalance", [str(who), {"commitment": "confirmed"}])["value"]
        if balance > 0:
            return
        time.sleep(1)
    raise SystemExit(f"Airdrop to {who} never landed — rate limited?")


def link_wallet(api: str, account, wallet: Keypair) -> None:
    """Links a FaucetChain account to a Solana wallet, with both signatures.

    The user's own key says which wallet they chose; the wallet's key says they
    hold it. In the browser these are two prompts, one per wallet.
    """
    timestamp = int(time.time())
    user = account.address.lower()
    solana_address = str(wallet.pubkey())
    message = settlement.link_message(user, solana_address, "7777", timestamp)
    proof = settlement.wallet_proof_message(user, solana_address, "7777", timestamp)
    solana_signature = base64.b64encode(
        bytes(wallet.sign_message(proof.encode("utf-8")))
    ).decode()
    signature = Account.sign_message(
        encode_defunct(text=message), private_key=account.key
    ).signature.hex()
    if not signature.startswith("0x"):
        signature = "0x" + signature
    response = requests.post(
        f"{api}/api/solana/link",
        json={
            "address": user,
            "solana_address": solana_address,
            "signature": signature,
            "sig_timestamp": timestamp,
            "solana_signature": solana_signature,
            "solana_sig_timestamp": timestamp,
        },
        timeout=30,
    )
    response.raise_for_status()


def step(number: int, text: str) -> None:
    print(f"\n[{number}] {text}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the full settlement flow")
    parser.add_argument("--rpc", default="http://127.0.0.1:8899")
    parser.add_argument("--api", default=os.getenv("FAUCETCHAIN_API", "http://localhost:8000"))
    parser.add_argument("--campaign-id", type=int, default=int(time.time()) % 1_000_000)
    parser.add_argument(
        "--funder",
        help="keypair that pays the actors instead of an airdrop; required on devnet, "
             "where requestAirdrop is rate limited",
    )
    parser.add_argument(
        "--fund-sol",
        type=float,
        default=0.3,
        help="SOL given to each of the three actors when --funder is used",
    )
    parser.add_argument(
        "--relayer-keypair",
        default="relayer.json",
        help="the keypair the API was started with as SETTLEMENT_RELAYER_KEYPAIR",
    )
    args = parser.parse_args()

    api = args.api.rstrip("/")
    rpc_url = args.rpc
    token = os.getenv("SETTLEMENT_OPERATOR_TOKEN")
    if not token:
        raise SystemExit("SETTLEMENT_OPERATOR_TOKEN must match the one the API was started with")

    idl = chain.load_idl()
    pid = chain.program_id(idl)
    if not chain.rpc(rpc_url, "getAccountInfo", [str(pid), {"commitment": "confirmed"}])["value"]:
        raise SystemExit(f"Program {pid} is not deployed on {rpc_url}")

    sponsor, operator = Keypair(), Keypair()
    # The relayer is the one key the API needs too, so it comes from a file
    # both sides read.
    if os.path.exists(args.relayer_keypair):
        with open(args.relayer_keypair, encoding="utf-8") as handle:
            relayer = Keypair.from_bytes(bytes(json.load(handle)))
    else:
        relayer = Keypair()
        with open(args.relayer_keypair, "w", encoding="utf-8") as handle:
            json.dump(list(bytes(relayer)), handle)
        print(f"    wrote a new relayer keypair to {args.relayer_keypair};"
              " restart the API with SETTLEMENT_RELAYER_KEYPAIR pointing at it")
    alice_sol, bob_sol = Keypair(), Keypair()
    alice_eth, bob_eth = Account.create(), Account.create()

    step(1, "Funding the partner, the operator and the relayer")
    if args.funder:
        funder = chain.load_keypair(args.funder)
        lamports = int(args.fund_sol * LAMPORT)
        chain.send_and_confirm(
            rpc_url,
            [transfer_ix(funder.pubkey(), who.pubkey(), lamports)
             for who in (sponsor, operator, relayer)],
            funder,
            [funder],
        )
        print(f"    paid {args.fund_sol} SOL each from {funder.pubkey()}")
    else:
        for who in (sponsor, operator, relayer):
            airdrop(rpc_url, who.pubkey(), 5)
    print(f"    partner  {sponsor.pubkey()}")
    print(f"    operator {operator.pubkey()}")
    print(f"    relayer  {relayer.pubkey()}")
    print(f"    users hold no SOL: {alice_sol.pubkey()} / {bob_sol.pubkey()}")

    step(2, "Creating the campaign token and the partner's balance")
    mint, sponsor_tokens = Keypair(), Keypair()
    mint_rent = chain.rpc(rpc_url, "getMinimumBalanceForRentExemption", [MINT_LEN])
    account_rent = chain.rpc(rpc_url, "getMinimumBalanceForRentExemption", [TOKEN_ACCOUNT_LEN])
    chain.send_and_confirm(
        rpc_url,
        [
            create_account_ix(sponsor.pubkey(), mint.pubkey(), mint_rent, MINT_LEN, chain.TOKEN_PROGRAM),
            initialize_mint_ix(mint.pubkey(), sponsor.pubkey(), DECIMALS),
            create_account_ix(
                sponsor.pubkey(), sponsor_tokens.pubkey(), account_rent,
                TOKEN_ACCOUNT_LEN, chain.TOKEN_PROGRAM,
            ),
            initialize_token_account_ix(sponsor_tokens.pubkey(), mint.pubkey(), sponsor.pubkey()),
            mint_to_ix(mint.pubkey(), sponsor_tokens.pubkey(), sponsor.pubkey(), 1_000 * UNIT),
        ],
        sponsor,
        [sponsor, mint, sponsor_tokens],
    )
    print(f"    mint {mint.pubkey()} — 1000 tokens with the partner")

    step(3, "Opening the campaign and funding the vault with 500")
    campaign = chain.campaign_pda(pid, sponsor.pubkey(), args.campaign_id)
    vault = chain.vault_pda(pid, campaign)
    chain.send_and_confirm(
        rpc_url,
        [
            chain.create_campaign(
                idl, sponsor.pubkey(), mint.pubkey(), args.campaign_id, operator.pubkey(),
                # The sponsor's ceiling on pace. The reserve check proves the vault
                # can pay; this bounds how fast it may be promised away.
                period_cap=400 * 10 ** 6,
                period_len=chain.PERIOD_30_DAYS,
            ),
            chain.fund_campaign(
                idl, sponsor.pubkey(), mint.pubkey(), sponsor_tokens.pubkey(),
                args.campaign_id, 500 * UNIT,
            ),
        ],
        sponsor,
        [sponsor],
    )
    requests.post(
        f"{api}/api/solana/campaign",
        json={
            "campaign_id": args.campaign_id,
            "sponsor": str(sponsor.pubkey()),
            "mint": str(mint.pubkey()),
        },
        headers={"x-operator-token": token},
        timeout=30,
    ).raise_for_status()
    print(f"    campaign {campaign}")
    print(f"    vault    {vault} holds {chain.token_balance(rpc_url, vault) / UNIT:.2f}")

    step(4, "Users link the wallet that will receive the payout")
    link_wallet(api, alice_eth, alice_sol)
    link_wallet(api, bob_eth, bob_sol)
    print(f"    {alice_eth.address.lower()} -> {alice_sol.pubkey()}")
    print(f"    {bob_eth.address.lower()} -> {bob_sol.pubkey()}")

    step(5, "A partner faucet joins, and two people click it")
    # The join, and the reason this is one story instead of two. What the batch
    # below carries is not inserted by an operator: it is what the network
    # computed a click to be worth, at a rate nobody typed in.
    faucet = Account.create().address.lower()
    api_key = requests.post(
        f"{api}/api/faucethub/register",
        json={"name": "Demo Partner Faucet", "wallet_address": faucet},
        timeout=30,
    ).json()["api_key"]

    # Size the campaign so a click is worth something legible today. The rate is
    # budget over days over expected claims, so this asks the engine what budget
    # puts a click near the target, instead of a number that only reads well in
    # the month somebody typed it.
    now = time.gmtime()
    days_left = calendar.monthrange(now.tm_year, now.tm_mon)[1] - now.tm_mday + 1
    expected = (distribution.FLOOR_USERS * distribution.CLAIMS_PER_USER_DAY
                * distribution.DEFAULT_PARTICIPATION)
    monthly_cap = int(PER_CLICK_TARGET * expected * max(days_left, 1))

    for path, body in (
        ("budget", {"total_budget": monthly_cap * 12, "monthly_cap": monthly_cap,
                    "funding": "vault"}),
        ("faucets", {"faucets": [faucet]}),
    ):
        requests.post(
            f"{api}/api/solana/campaign/{args.campaign_id}/{path}",
            json=body, headers={"x-operator-token": token}, timeout=30,
        ).raise_for_status()
    print(f"    faucet {faucet}")
    print(f"    the campaign commits {monthly_cap / UNIT:,.0f} a month and names this faucet")

    gross = to_users = 0
    for who, account in (("alice", alice_eth), ("bob", bob_eth)):
        drip = requests.post(
            f"{api}/api/faucethub/microclaim",
            json={"user_wallet": account.address.lower(), "amount": 1.0},
            headers={"X-Api-Key": api_key},
            timeout=30,
        ).json()["campaigns"][0]
        gross += drip["amount"] + drip["treasury"]
        to_users += drip["amount"]
        print(f"    {who} clicked once and earned {drip['amount'] / UNIT:,.2f}"
              f"  ({drip['treasury'] / UNIT:,.2f} to the treasury)")
    print(f"    {gross / UNIT:,.2f} drawn from the budget, at a rate nobody typed in")

    step(6, "The sequencer closes the batch")
    batch = requests.post(
        f"{api}/api/solana/batch",
        json={"campaign_id": args.campaign_id},
        headers={"x-operator-token": token},
        timeout=30,
    ).json()
    print(f"    batch {batch['batch_id']} root {batch['root']}")
    print(f"    {batch['leaf_count']} leaves, {batch['total_amount'] / UNIT:.2f} promised")

    step(7, "Publishing the root on-chain with publish_root.py")
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as handle:
        json.dump(list(bytes(operator)), handle)
        operator_path = handle.name
    try:
        environment = dict(
            os.environ,
            SOLANA_RPC_URL=rpc_url,
            FAUCETCHAIN_API=api,
            SETTLEMENT_OPERATOR_KEYPAIR=operator_path,
            SETTLEMENT_CAMPAIGN_SPONSOR=str(sponsor.pubkey()),
            SETTLEMENT_OPERATOR_TOKEN=token,
        )
        published = subprocess.run(
            [sys.executable, os.path.join(ROOT, "publish_root.py"),
             "--campaign", str(args.campaign_id), "--batch", str(batch["batch_id"])],
            env=environment, capture_output=True, text=True, cwd=ROOT,
        )
        print("    " + "\n    ".join(published.stdout.strip().splitlines()[-2:]))
        if published.returncode != 0:
            raise SystemExit(published.stderr.strip() or "publish_root.py failed")
    finally:
        os.unlink(operator_path)

    step(8, "Users withdraw through the relayer, signing but paying nothing")
    for eth_account, sol_keypair, name in (
        (alice_eth, alice_sol, "alice"),
        (bob_eth, bob_sol, "bob"),
    ):
        served = requests.get(
            f"{api}/api/solana/proof/{eth_account.address.lower()}", timeout=30
        ).json()
        proof = served["proofs"][0]

        prepared = requests.post(
            f"{api}/api/solana/relay/prepare",
            json={"address": eth_account.address.lower(), "batch_id": proof["batch_id"]},
            timeout=30,
        )
        if prepared.status_code == 503:
            raise SystemExit(
                "The API has no relayer configured. Restart it with "
                f"SETTLEMENT_RELAYER_KEYPAIR={os.path.abspath(args.relayer_keypair)}"
            )
        prepared.raise_for_status()
        unsigned = prepared.json()["transaction"]

        # The user signs the withdrawal and nothing else: the fee payer slot
        # already belongs to the relayer.
        transaction = Transaction.from_bytes(base64.b64decode(unsigned))
        transaction.partial_sign([sol_keypair], transaction.message.recent_blockhash)
        submitted = requests.post(
            f"{api}/api/solana/relay/submit",
            json={
                "address": eth_account.address.lower(),
                "batch_id": proof["batch_id"],
                "transaction": base64.b64encode(bytes(transaction)).decode(),
            },
            timeout=60,
        )
        submitted.raise_for_status()
        signature = submitted.json()["signature"]
        for _ in range(30):
            status = chain.rpc(
                rpc_url, "getSignatureStatuses", [[signature], {"searchTransactionHistory": True}]
            )["value"][0]
            if status and status.get("confirmationStatus") in ("confirmed", "finalized"):
                break
            time.sleep(1)
        else:
            raise SystemExit(f"Withdrawal {signature} never confirmed")
        received = chain.token_balance(
            rpc_url, chain.associated_token_address(sol_keypair.pubkey(), mint.pubkey())
        )
        balance = chain.rpc(rpc_url, "getBalance", [str(sol_keypair.pubkey()), {"commitment": "confirmed"}])["value"]
        print(f"    {name}: received {received / UNIT:.2f} tokens holding {balance} lamports")
        assert received == proof["amount"], (received, proof["amount"])
        assert balance == 0, balance

        # Asking again is refused before anything is signed: the receipt for
        # that leaf is on-chain now, so paying to be rejected is avoidable.
        again = requests.post(
            f"{api}/api/solana/relay/prepare",
            json={"address": eth_account.address.lower(), "batch_id": proof["batch_id"]},
            timeout=30,
        )
        assert again.status_code == 409, (again.status_code, again.text)
        listed = requests.get(
            f"{api}/api/solana/proof/{eth_account.address.lower()}", timeout=30
        ).json()["proofs"][0]
        assert listed["claimed"] is True, listed
        print(f"    {name}: a second withdrawal is refused, and the reward reads as collected")

    step(9, "The partner takes back what was never promised")
    # Not the whole vault. The treasury leaf in this batch has not been
    # collected, and what a published root still owes is not the partner's to
    # take back -- the program refuses it, which is the point of the reserve.
    on_chain = requests.get(
        f"{api}/api/solana/ledger/{args.campaign_id}", timeout=30).json()["on_chain"]
    outstanding = on_chain["committed"] - on_chain["paid"]
    before = chain.token_balance(rpc_url, sponsor_tokens.pubkey())
    held = chain.token_balance(rpc_url, vault)
    surplus = held - outstanding
    chain.send_and_confirm(
        rpc_url,
        [chain.withdraw_surplus(
            idl, sponsor.pubkey(), mint.pubkey(), sponsor_tokens.pubkey(),
            args.campaign_id, surplus,
        )],
        sponsor,
        [sponsor],
    )
    after = chain.token_balance(rpc_url, sponsor_tokens.pubkey())
    print(f"    vault returned {surplus / UNIT:.2f}; partner now holds {after / UNIT:.2f}")
    print(f"    {outstanding / UNIT:.2f} stays behind: the treasury's leaf is promised"
          f" and not yet collected")
    assert after == before + surplus
    # And the program refuses to give back a lamport of what is still owed.
    if outstanding:
        try:
            chain.send_and_confirm(
                rpc_url,
                [chain.withdraw_surplus(
                    idl, sponsor.pubkey(), mint.pubkey(), sponsor_tokens.pubkey(),
                    args.campaign_id, 1,
                )],
                sponsor,
                [sponsor],
            )
            raise SystemExit("the vault gave back money it still owed")
        except chain.ChainError:
            print("    and one unit more is refused, because that money is spoken for")
    assert chain.token_balance(rpc_url, vault) == outstanding

    step(10, "The ledger, read from Solana rather than from this script")
    ledger = requests.get(f"{api}/api/solana/ledger/{args.campaign_id}", timeout=30).json()
    chain_state = ledger["on_chain"]
    assert chain_state is not None, "the sequencer could not read the chain"
    root_state = ledger["batches"][0]["on_chain"]
    print(f"    funded {chain_state['funded'] / UNIT:.2f} - promised "
          f"{chain_state['committed'] / UNIT:.2f} - paid {chain_state['paid'] / UNIT:.2f} - "
          f"vault {chain_state['vault_amount'] / UNIT:.2f}")
    print(f"    root {root_state['index']}: {root_state['claimed'] / UNIT:.2f} of "
          f"{root_state['total_amount'] / UNIT:.2f} collected across "
          f"{root_state['leaf_count']} leaves")
    # Relationships, not round numbers: the rate is computed per click, so the
    # totals are whatever the network decided a click was worth today. What has
    # to hold is that the chain agrees with the clicks.
    assert chain_state["funded"] == 500 * UNIT, chain_state
    assert chain_state["committed"] == gross, (chain_state["committed"], gross)
    assert chain_state["paid"] == to_users, (chain_state["paid"], to_users)
    assert chain_state["vault_amount"] == gross - to_users, chain_state
    assert root_state["total_amount"] == gross, root_state
    assert root_state["claimed"] == to_users, root_state
    assert root_state["root"] == batch["root"], (root_state["root"], batch["root"])

    print("\nDone. Two clicks on a partner faucet became one root on Solana,")
    print(f"{to_users / UNIT:.2f} tokens reached them, and neither held a lamport.")


if __name__ == "__main__":
    # From a terminal a failed RPC should read as one line, not a traceback.
    # solana_settlement raises ChainError rather than SystemExit so that a server
    # importing it can catch the thing with an ordinary `except Exception`.
    try:
        main()
    except chain.ChainError as error:
        raise SystemExit(str(error))
    except requests.exceptions.RequestException as error:
        # Nothing is listening. The likeliest way to run this is without the
        # validator up, and a stack trace is a poor way to say so.
        raise SystemExit(f"Cannot reach the node: {error}")
