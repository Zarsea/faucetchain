# Before mainnet

A **gate**: the numbers below are deliberately generous because this is a
simulator on devnet. Every one of them is wrong for real money, and none of
them will announce itself.

Decided 2 October, with the exposure measured rather than estimated.

- [ ] **What happens when the 99M cap is reached.** Today: nothing graceful.
      `distribute_epoch_rewards` returns `max_supply_reached` and uptime
      rewards simply stop. At the current constant pool of 1,695 $CLAIM an hour
      that is 14,848,200 a year, so the cap arrives in about 6.7 years and the
      network falls off a cliff on an ordinary Tuesday.

      This is the question the halving was trying to answer, and the halving
      was never built — it only existed as a chart in `Tokenomics.tsx`, three
      contradictory numbers in `i18n.ts`, `KnowledgeBase.ts` and
      `Whitepaper.tsx`, and nowhere in the server. All of that was removed on
      8 October rather than implemented, because an emission schedule changed in a
      hurry is a worse idea than admitting there isn't one.

      The real options: a decay on the hourly ceiling
      so emission asymptotes instead of stopping; or fees and treasury yield
      taking over as the subsidy falls, which is what the whitepaper already
      implies by funding rewards from staking rather than from issuance. The
      second fits what is already built. Neither is decided.

- [ ] **`FLOOR_USERS`, now 30, back to 100 or higher.** The rate is divided by
      whichever is larger, the real number of active users or this floor. At 30
      a nearly empty campaign pays 0.6173 per click instead of 0.1852.
- [ ] **`PARTICIPATION_FLOOR`, now 0.01, raised toward
      `DEFAULT_PARTICIPATION`.** This one is the trap. Participation is
      measured, and it sits in the *divisor*, so thin traffic does not lower
      the rate — it multiplies it. On 2 October the previous day held one click
      by one user, participation measured 0.0035, clamped to 0.01, and the rate
      came out **ten times** the figure the default would have given. The
      measurement is honest; the floor is what turns an unmeasurable sample
      into a tenfold multiplier.
- [ ] **The monthly caps, now 40,000 FHR on 652608 and 10,000 on 479079.**
      Raised on 2 October for the demonstration. Note that `month_budget`
      adds the rollover on top: 652608 carries 19,993 unspent from September,
      so the allowance in force is 59,993, not 40,000.
- [ ] **`min_withdraw`, 5,000,000 on both campaigns, re-priced.** Five units at
      six decimals is a guess at a token with no market. Delivery costs
      1,488,440 lamports of rent the first time a person touches a token; the
      minimum has to clear that in whatever the token is actually worth.

- [ ] **The Merkle tree has no domain separation between a leaf and an internal
      node.** Found 3 October by the Trail of Bits Solana scanner's sweep, as an
      observation outside its six patterns. Nothing prefixes a leaf with `0x00`
      and a node with `0x01`, so `verify_proof` on its own accepts an internal
      node handed in as a leaf — demonstrated, and now pinned by
      `an_internal_node_passes_as_a_leaf` in `merkle.rs`.

      **It is not exploitable today**, and the reason matters more than the
      fact: `claim_reward` computes the leaf from the signer, the amount and the
      index rather than accepting one, so forging a claim needs a 44-byte keccak
      preimage matching a 32-byte node. The safety lives in
      [claim_reward.rs](faucetchain/programs/faucetchain/src/instructions/claim_reward.rs),
      not in the tree — which means any future instruction that takes a leaf as
      an argument reopens it in full, and no constraint elsewhere would catch
      that.

      Why it is a mainnet gate and not a fix: a prefix changes every root,
      including every one already published. On 3 October that was 19, and campaign
      479079 had 347,221 units sitting in a published root that a real wallet can withdraw today; change
      the hash and that proof stops verifying. On devnet the roots are
      disposable, so the right moment is the migration, with the appchain's
      `leaf_hash` in settlement.py moving in the same commit and a version field
      on `RewardRoot` if old roots must stay claimable.

**What the three multiply to, today.** One person, clicking the maximum 288
times, on a campaign with nobody else in it and traffic thin enough to hold
participation at its floor, takes **2.67 times the entire day's allowance** —
`distribution.py` pins that figure in `_self_check`, so it fails loudly if
either floor moves. At the 100-user floor and the default participation the
same person takes 10%. The floor exists to stop one visitor walking off with a
fifth of the month; at these settings it no longer does, and that is a choice
that makes sense on devnet and nowhere else.

---
