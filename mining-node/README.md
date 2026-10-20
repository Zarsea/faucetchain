# FaucetChain Mining Node

A node earns $CLAIM by being present. There is no hashing and no GPU: the
network pays for uptime, measured by a heartbeat every 30 seconds, and the
hourly pool is split between the nodes that were online.

Any machine that can keep a terminal open qualifies. A laptop works.

## What you need

- **Node.js 18 or newer.** Check with `node --version`. Nothing else: no Python,
  no Solana CLI, no SOL.
- **A wallet address** to be paid to. Your FaucetChain address (the one the app
  shows when you sign in) or a Solana address you control.

## Setup

```bash
cd mining-node
npm install
cp .env.example .env
```

Open `.env` and set three values:

```ini
WALLET_ADDRESS=0x...            # where the rewards are credited
API_URL=https://www.faucetchain.com.br
NODE_NAME=rafael-laptop         # shows up on the leaderboard
```

`API_URL` matters. The example file ships with `localhost`, which only works if
you are running the server yourself. Pointing at localhost is the most common
reason a node never connects.

Then:

```bash
npm start
```

## What you should see

```
⛏️  FaucetChain Mining Node v1.0.0
[02:41:10] ✓ Registrado na rede! Node ID: a3f9c2e1b7d04856
  ● MINING │ Uptime: 00:04:30 │ Epoch: 00:04:30 │ Earned: 0.0000 CLAIM │ CPU: 2%
```

The counter updates every 30 seconds. `Earned` stays at zero until the first
epoch closes, which happens on the hour. That is normal, and it is not a sign
that anything is wrong.

Leave the terminal open. Closing it, sleeping the machine, or losing the network
for more than 90 seconds marks the node offline, and offline time earns nothing.

## Two files you must not lose, and must not share

The first run writes `.node_id` and `.node_token` next to the miner.

- **`.node_id`** names your node. It is not a secret.
- **`.node_token`** proves the node is yours. It is a secret, and it is shown
  once, at registration.

Reconnecting to a node id requires its token. Lose the token and you lose that
node id: you start over under a new one, and the uptime does not come with you.
Share the token and whoever holds it can repoint your node's payouts at their
own wallet.

Both files are in `.gitignore` already. Do not paste them into chat, do not put
them in a screenshot, do not copy the folder to another machine expecting two
nodes — see the last section for that.

## The limits, and why they exist

| Limit | Value | Why |
|---|---|---|
| Nodes per wallet | 3 | Running 50 nodes on one wallet would not be more presence, just more processes |
| New registrations per IP | 8 per hour | Mass registration from one point is the cheap attack; reconnecting is not limited |
| Heartbeat | every 30s | Faster is refused, and earns nothing extra |
| Offline after | 90s without a heartbeat | |
| Epoch | 1 hour | The pool is split and credited when it closes |

Changing `WALLET_ADDRESS` on a node that already exists resets that node's
epoch uptime to zero. The epoch pays for presence, and that presence was earned
by the previous address. Change it between epochs, not in the middle of one.

## What the reward actually is

The pool is **1,695 $CLAIM per hour**, split by each node's share of the total
uptime of all online nodes. It is also capped by the network's hourly emission
quota and by the remaining supply, so a busy hour of claims can leave the pool
smaller than 1,695.

With 3 nodes online, a node that stayed up the whole hour gets about 565.
**With 10 nodes it gets about 170.** The pool is fixed, so inviting more people
means each node earns less. Nobody is being cheated when the number drops.

Current numbers, no account needed:

```
https://www.faucetchain.com.br/api/mining/stats
https://www.faucetchain.com.br/api/mining/node/{your-wallet}
https://www.faucetchain.com.br/api/mining/rewards/{your-wallet}
```

Two things to be clear about, because the word "mining" promises more than this
does:

1. **This is devnet.** The network is a public testnet and the treasury is a
   test treasury.
2. **Mined $CLAIM is a balance on FaucetChain.** It shows in the explorer, in
   the leaderboard and in your network balance. There is no withdrawal path for
   it to Solana today — the only thing that settles to Solana is a campaign
   reward earned at a faucet, which is a different balance. If you mine
   expecting a token to arrive in Phantom, it will not.

## When it does not work

**`Connection refused`** — `API_URL` is still `localhost`. Set it to
`https://www.faucetchain.com.br`.

**`That node id is taken`** — you have a `.node_id` whose `.node_token` is
missing or does not match. Usually this is a copied folder. Delete both files
and start again to get a fresh id, or restore the token you had.

**`Too many calls from this node this hour`** — you are running an old copy of
the miner. The version in this folder makes 240 calls an hour, under the
ceiling. An older one explored every 5 seconds, which is 840, and got refused
for working too hard. Pull the current `mining-node/` folder.

**`A wallet may run at most 3 nodes`** — self-explanatory, and the three
already registered may include ones you forgot. Check
`/api/mining/node/{your-wallet}`.

**Earned stays at 0.0000 past the hour** — look at `/api/mining/stats` and check
`lastEpochId` moved. If it did and you got nothing, your node was marked offline
during the epoch. If it did not move, the problem is on our side, not yours.

## Two nodes on one machine

They cannot share the id files. Give each its own pair:

```bash
NODE_ID_FILE=.node_id.2 NODE_TOKEN_FILE=.node_token.2 npm start
```

Both variables travel together. Keeping one without the other locks the miner
out of its own node.
