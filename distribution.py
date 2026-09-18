"""
FaucetChain — how much one click is worth.

A partner project funds a campaign and the budget is dripped through the
faucets on the network instead of dropped at once. This module decides the
size of each drip. It is pure arithmetic: no database, no network, no clock
beyond what the caller passes in, so it can be reasoned about and tested.

Three rules carry the design.

**The floor.** The rate is computed against at least FLOOR_USERS, however few
people are actually there. Without it a new faucet with five users would hand
each of them a fifth of the month's budget -- ruinous for the partner, and a
magnet for anyone farming an empty faucet. With it, the first arrivals get an
ordinary rate and the rest of the budget waits.

**The rollover.** Whatever a month does not spend is added to the next one.
A budget that expires pushes an operator to inflate clicks on the last day;
a budget that accumulates does not.

**The ceiling is checked when the reward is credited, not when it is paid.**
The Solana program refuses a root the vault does not cover, and a refused root
pays nobody -- including everyone who clicked honestly. So `credit` never
returns more than the budget still holds.

Amounts are integers in the token's smallest unit. Money is never a float.
"""

FLOOR_USERS = 100          # the rate is never computed against fewer than this
CLAIM_INTERVAL_MIN = 5     # one claim per user per five minutes, as faucets do
MINUTES_PER_DAY = 24 * 60
CLAIMS_PER_USER_DAY = MINUTES_PER_DAY // CLAIM_INTERVAL_MIN   # 288

USER_SHARE = 80            # percent of every drip that reaches the user
TREASURY_SHARE = 20        # the rest funds continuity; it is staked, not sold

# Until a campaign has a day of traffic behind it there is nothing to measure,
# so the first day runs on this and corrects itself from then on. Deliberately
# low: guessing high overspends the month in its first week.
DEFAULT_PARTICIPATION = 0.10


def participation(claims_observed: int, users_observed: int) -> float:
    """What fraction of the possible claims people actually made.

    Measured, not assumed — a campaign whose users claim twice a day and one
    whose users claim hourly cannot share a constant. Falls back to
    DEFAULT_PARTICIPATION only when there is no traffic to look at yet.
    """
    if users_observed <= 0:
        return DEFAULT_PARTICIPATION
    possible = users_observed * CLAIMS_PER_USER_DAY
    if possible <= 0:
        return DEFAULT_PARTICIPATION
    seen = claims_observed / possible
    # Clamp: a burst or an outage should not throw the whole month's rate.
    return min(max(seen, 0.01), 1.0)


def per_click(budget_remaining: int, days_remaining: int, active_users: int,
              participation_rate: float = DEFAULT_PARTICIPATION) -> int:
    """The gross value of one claim, in the token's smallest unit.

    Gross: the user receives USER_SHARE of it. See `split`.
    """
    if budget_remaining <= 0:
        return 0
    days = max(days_remaining, 1)
    daily = budget_remaining / days

    effective_users = max(active_users, FLOOR_USERS)
    expected = effective_users * CLAIMS_PER_USER_DAY * participation_rate
    if expected <= 0:
        return 0
    return int(daily / expected)


def split(gross: int) -> tuple:
    """(to the user, to the treasury). The treasury's cut funds continuity and
    is staked rather than liquidated, so distributing a partner's token never
    means selling it."""
    to_user = gross * USER_SHARE // 100
    return to_user, gross - to_user


def credit(gross: int, budget_remaining: int) -> int:
    """Never promise past the budget.

    Publishing a root the vault does not cover is refused on-chain, and that
    refusal costs everyone in the batch — not only whoever tipped it over.
    """
    return max(0, min(gross, budget_remaining))


def month_budget(total_remaining: int, monthly_cap: int, rolled_over: int = 0) -> int:
    """What a month may spend: its cap plus whatever earlier months left behind,
    and never more than the campaign still holds."""
    return min(total_remaining, monthly_cap + max(rolled_over, 0))


def _self_check() -> None:
    U = 1_000_000          # six decimals, as the campaigns use

    # The published simulation, pinned. These are the numbers in the design
    # document; if the engine drifts from them, one of the two is wrong.
    cap = 10_000 * U
    p = DEFAULT_PARTICIPATION

    # Month 1 — five users, so the floor decides the rate
    rate1 = per_click(cap, 30, active_users=5, participation_rate=p)
    assert abs(rate1 / U - 0.11574) < 0.0001, rate1 / U
    spent1 = int(5 * CLAIMS_PER_USER_DAY * p) * rate1 * 30
    left1 = cap - spent1
    assert abs(left1 / U - 9_500) < 20, left1 / U      # ~9.5k rolls over

    # Month 2 — 300 users, with the rollover added
    avail2 = month_budget(120_000 * U, cap, left1)
    assert abs(avail2 / U - 19_500) < 20, avail2 / U
    rate2 = per_click(avail2, 30, active_users=300, participation_rate=p)
    assert abs(rate2 / U - 0.07523) < 0.0001, rate2 / U

    # Month 3 — a thousand users, no rollover left
    rate3 = per_click(cap, 30, active_users=1000, participation_rate=p)
    assert abs(rate3 / U - 0.01157) < 0.0001, rate3 / U

    # The floor holds: below it the rate does not move, however few arrive.
    assert per_click(cap, 30, 1, p) == per_click(cap, 30, 99, p) == per_click(cap, 30, 100, p)
    # Above it, more people means a smaller share each.
    assert per_click(cap, 30, 200, p) < per_click(cap, 30, 100, p)

    # The split
    user, treasury = split(1000)
    assert (user, treasury) == (800, 200), (user, treasury)

    # The ceiling
    assert credit(500, 200) == 200          # never past the budget
    assert credit(500, 0) == 0              # an empty vault pays nothing
    assert per_click(0, 30, 500, p) == 0

    # Participation is measured when there is traffic to measure
    assert participation(0, 0) == DEFAULT_PARTICIPATION
    assert abs(participation(288, 10) - 0.1) < 1e-9     # 288 of 2880 possible
    assert participation(10**9, 10) == 1.0              # clamped

    print("distribution.py OK")


if __name__ == "__main__":
    _self_check()
