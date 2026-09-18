use anchor_lang::prelude::*;

/// A partner project's campaign: the budget sits in a vault on this network
/// and only leaves it against a reward root published by FaucetChain.
#[account]
#[derive(InitSpace)]
pub struct Campaign {
    /// Who funds it, by depositing into the vault.
    pub sponsor: Pubkey,
    /// Who publishes reward roots: the FaucetChain sequencer.
    pub operator: Pubkey,
    pub mint: Pubkey,
    pub campaign_id: u64,
    /// Everything ever deposited into the vault.
    pub funded: u64,
    /// Everything users have withdrawn.
    pub paid: u64,
    /// Sum of the totals of every published root.
    pub committed: u64,
    pub root_count: u32,
    pub closed: bool,
    pub bump: u8,
    pub vault_bump: u8,
    /// Most a single period may promise. Zero means no ceiling.
    ///
    /// This bounds what a compromised sequencer can do: without it, one root
    /// can promise everything the vault holds, and the reserve check passes
    /// because the vault does cover it. It is a backstop on the blast radius,
    /// not the distribution policy — the sequencer's own monthly cap is the
    /// tighter rule, and this must be set at or above it, rollover included, or
    /// an honest root gets refused.
    ///
    /// The sponsor sets it, because the sponsor is who put the money in.
    pub period_cap: u64,
    /// How long a period lasts, in seconds. Zero means no ceiling.
    ///
    /// A rolling window rather than a calendar month: the program has a clock,
    /// not a calendar, and date arithmetic on-chain would buy nothing a window
    /// does not already give.
    pub period_len: i64,
    pub period_start: i64,
    pub spent_period: u64,
}

impl Campaign {
    /// Accounts for `total_amount` against the period ceiling, rolling into a
    /// fresh period first if this one has run out. Returns false when the
    /// ceiling would be breached, which is the publication to refuse.
    pub fn fits_in_period(&mut self, total_amount: u64, now: i64) -> bool {
        if self.period_cap == 0 || self.period_len == 0 {
            return true; // no ceiling was asked for
        }
        let ends = self.period_start.saturating_add(self.period_len);
        if now >= ends {
            self.period_start = now;
            self.spent_period = 0;
        }
        match self.spent_period.checked_add(total_amount) {
            Some(spent) if spent <= self.period_cap => {
                self.spent_period = spent;
                true
            }
            _ => false,
        }
    }
}

/// A batch of rewards. FaucetChain closes the batch off-chain and publishes
/// only its root here; each user withdraws by proving their leaf is in it.
///
/// `claimed_bits` holds one bit per leaf, and a set bit is what stops a leaf
/// from being withdrawn twice. That job used to belong to one rent-paying
/// account per withdrawal, which costs 0.001118 SOL — on a network whose whole
/// premise is claims worth fractions of a cent, the record of a payment cost
/// more than the payment. A batch of ten thousand leaves needed 11.18 SOL in
/// rent; the same batch as a bitmap needs 0.0070.
///
/// It also shortens the withdrawal itself: one account fewer in the
/// transaction, and a sequencer that wants to know what is still owed reads one
/// account instead of one per leaf.
#[account]
pub struct RewardRoot {
    pub campaign: Pubkey,
    pub index: u32,
    pub root: [u8; 32],
    pub total_amount: u64,
    pub claimed: u64,
    pub leaf_count: u32,
    pub published_at: i64,
    /// One bit per leaf, least significant bit first. Sized from `leaf_count`
    /// when the root is published and never resized.
    pub claimed_bits: Vec<u8>,
}

impl RewardRoot {
    /// Every fixed field, plus the four bytes Borsh spends on the vector length.
    pub const FIXED: usize = 32 + 4 + 32 + 8 + 8 + 4 + 8 + 4;

    pub fn bitmap_len(leaf_count: u32) -> usize {
        (leaf_count as usize).div_ceil(8)
    }

    /// Discriminator, fixed fields, and one bit per leaf.
    pub fn space(leaf_count: u32) -> usize {
        8 + Self::FIXED + Self::bitmap_len(leaf_count)
    }

    pub fn is_claimed(&self, leaf_index: u32) -> bool {
        let (byte, bit) = Self::position(leaf_index);
        self.claimed_bits.get(byte).is_some_and(|b| b & bit != 0)
    }

    /// Sets the leaf's bit. Returns false if it was already set, which is the
    /// double-withdrawal the caller must refuse.
    pub fn mark_claimed(&mut self, leaf_index: u32) -> bool {
        let (byte, bit) = Self::position(leaf_index);
        match self.claimed_bits.get_mut(byte) {
            Some(cell) if *cell & bit == 0 => {
                *cell |= bit;
                true
            }
            _ => false,
        }
    }

    fn position(leaf_index: u32) -> (usize, u8) {
        ((leaf_index / 8) as usize, 1u8 << (leaf_index % 8))
    }
}

#[cfg(test)]
mod tests {
    use super::{Campaign, RewardRoot};

    fn campaign(period_cap: u64, period_len: i64) -> Campaign {
        Campaign {
            sponsor: Default::default(),
            operator: Default::default(),
            mint: Default::default(),
            campaign_id: 1,
            funded: 0,
            paid: 0,
            committed: 0,
            root_count: 0,
            closed: false,
            bump: 0,
            vault_bump: 0,
            period_cap,
            period_len,
            period_start: 1_000,
            spent_period: 0,
        }
    }

    const DAY: i64 = 86_400;

    #[test]
    fn a_period_stops_at_its_ceiling() {
        let mut c = campaign(1_000, 30 * DAY);
        assert!(c.fits_in_period(600, 1_000));
        assert!(c.fits_in_period(400, 1_000));
        // The thousandth unit was the last one this period had.
        assert!(!c.fits_in_period(1, 1_000));
        assert_eq!(c.spent_period, 1_000);
    }

    #[test]
    fn the_next_period_starts_clean() {
        let mut c = campaign(1_000, 30 * DAY);
        assert!(c.fits_in_period(1_000, 1_000));
        assert!(!c.fits_in_period(1, 1_000 + 30 * DAY - 1), "the window had not closed");
        assert!(c.fits_in_period(1_000, 1_000 + 30 * DAY));
        assert_eq!(c.spent_period, 1_000);
        assert_eq!(c.period_start, 1_000 + 30 * DAY);
    }

    #[test]
    fn a_campaign_without_a_ceiling_is_not_bounded_by_one() {
        let mut c = campaign(0, 30 * DAY);
        assert!(c.fits_in_period(u64::MAX, 1_000));
        // A cap with no window is no cap either: both have to be set.
        let mut c = campaign(1_000, 0);
        assert!(c.fits_in_period(u64::MAX, 1_000));
    }

    #[test]
    fn an_amount_that_would_overflow_the_period_is_refused() {
        let mut c = campaign(u64::MAX, 30 * DAY);
        assert!(c.fits_in_period(u64::MAX, 1_000));
        assert!(!c.fits_in_period(1, 1_000));
    }

    #[test]
    fn a_period_that_would_overflow_the_clock_still_rolls() {
        let mut c = campaign(1_000, i64::MAX);
        c.period_start = i64::MAX - 1;
        // saturating_add keeps the window from wrapping into the past, which
        // would reset the ceiling on every publication.
        assert!(c.fits_in_period(1_000, 1_000));
        assert!(!c.fits_in_period(1, 1_000));
    }

    fn root(leaf_count: u32) -> RewardRoot {
        RewardRoot {
            campaign: Default::default(),
            index: 0,
            root: [0u8; 32],
            total_amount: 0,
            claimed: 0,
            leaf_count,
            published_at: 0,
            claimed_bits: vec![0u8; RewardRoot::bitmap_len(leaf_count)],
        }
    }

    #[test]
    fn a_leaf_is_marked_once_and_only_once() {
        let mut r = root(20);
        assert!(!r.is_claimed(7));
        assert!(r.mark_claimed(7));
        assert!(r.is_claimed(7));
        // The second attempt is the double withdrawal the program refuses.
        assert!(!r.mark_claimed(7));
    }

    #[test]
    fn neighbouring_leaves_do_not_share_a_bit() {
        let mut r = root(20);
        assert!(r.mark_claimed(8));
        // 8 and 9 live in the same byte; 0 and 16 in others.
        for other in [0, 7, 9, 15, 16, 19] {
            assert!(!r.is_claimed(other), "leaf {other} moved with leaf 8");
        }
    }

    #[test]
    fn a_leaf_past_the_bitmap_cannot_be_marked() {
        let mut r = root(8);
        assert!(!r.mark_claimed(8), "leaf 8 is outside a batch of 8");
        assert!(!r.is_claimed(8));
        assert!(!r.mark_claimed(u32::MAX));
    }

    #[test]
    fn the_bitmap_rounds_up_to_whole_bytes() {
        assert_eq!(RewardRoot::bitmap_len(0), 0);
        assert_eq!(RewardRoot::bitmap_len(1), 1);
        assert_eq!(RewardRoot::bitmap_len(8), 1);
        assert_eq!(RewardRoot::bitmap_len(9), 2);
        assert_eq!(RewardRoot::bitmap_len(8192), 1024);
        // Every leaf in a full batch has a bit to sit in.
        let mut r = root(8192);
        assert!(r.mark_claimed(8191));
        assert!(!r.mark_claimed(8192));
    }
}
