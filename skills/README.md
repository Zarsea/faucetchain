# Agent skills

Skills in this folder are written for **other people's coding agents**, not for
this repository's own work. A developer connecting their faucet to FaucetChain
points their agent at one of these, and the agent gets the integration, the
request shapes, and the handful of mistakes that cost real money — without
reading 900 lines of guide first.

## faucetchain

Connecting a faucet, rewards site or micro-payout app to this network: crediting
a claim, campaign rewards that settle on Solana, a shop that spends balance,
withdrawals, and webhooks.

**Install** — copy the folder into the agent's skills directory:

```bash
# Claude Code, per project
mkdir -p .claude/skills && cp -r path/to/faucetchain/skills/faucetchain .claude/skills/

# Claude Code, for every project
cp -r path/to/faucetchain/skills/faucetchain ~/.claude/skills/
```

Agents that read `SKILL.md` frontmatter will pick it up on the next session. For
anything else, hand the agent `skills/faucetchain/SKILL.md` directly.

**Check it before you trust it:**

```bash
python skills/faucetchain/check.py
```

Seventeen assertions against the running API: that the documented read routes
answer without a key, that the write routes refuse without one, that the balance
payload still carries the fields the skill tells an agent to read, and that
`min_withdraw` is still 10.0. It writes nothing, so it is safe against
production.

Run it before publishing a change to the skill. The guide this skill replaces
told developers to call `http://localhost:8000` for months after the API went
live, and nothing failed, because nothing checked.
