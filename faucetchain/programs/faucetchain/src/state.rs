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
}

/// A batch of rewards. FaucetChain closes the batch off-chain and publishes
/// only its root here; each user withdraws by proving their leaf is in it.
#[account]
#[derive(InitSpace)]
pub struct RewardRoot {
    pub campaign: Pubkey,
    pub index: u32,
    pub root: [u8; 32],
    pub total_amount: u64,
    pub claimed: u64,
    pub leaf_count: u32,
    pub published_at: i64,
}

/// Marks a leaf as spent. This account existing is what stops the same reward
/// from being withdrawn twice.
#[account]
#[derive(InitSpace)]
pub struct ClaimReceipt {
    pub root: Pubkey,
    pub recipient: Pubkey,
    pub leaf_index: u32,
    pub amount: u64,
    pub claimed_at: i64,
}
