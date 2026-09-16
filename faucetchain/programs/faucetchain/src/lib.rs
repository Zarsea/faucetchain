//! FaucetChain — the settlement layer on Solana.
//!
//! The appchain keeps doing the distributing: proof of claim, the hourly quota,
//! Sentinel and micro-claims. This program holds what needs a public guarantee:
//!
//! 1. the partner's budget sits in a per-campaign vault;
//! 2. FaucetChain publishes the Merkle root of each reward batch;
//! 3. the user withdraws by proving their leaf is in that root.
//!
//! Partner funds never cross a bridge. They enter here and leave here.
pub mod constants;
pub mod error;
pub mod instructions;
pub mod merkle;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("64LW8DZcrttzaZ5RTTxAytfCGdb3QvDeTq5pUY7WBqSm");

#[program]
pub mod faucetchain {
    use super::*;

    /// Opens a campaign and the vault that holds its budget.
    pub fn create_campaign(
        ctx: Context<CreateCampaign>,
        campaign_id: u64,
        operator: Pubkey,
    ) -> Result<()> {
        instructions::create_campaign::handle_create_campaign(ctx, campaign_id, operator)
    }

    /// The partner deposits tokens into the campaign vault.
    pub fn fund_campaign(ctx: Context<FundCampaign>, amount: u64) -> Result<()> {
        instructions::fund_campaign::handle_fund_campaign(ctx, amount)
    }

    /// FaucetChain publishes the root of a reward batch. It only goes through if
    /// the vault covers everything already promised and not yet withdrawn.
    pub fn publish_root(
        ctx: Context<PublishRoot>,
        index: u32,
        root: [u8; 32],
        total_amount: u64,
        leaf_count: u32,
    ) -> Result<()> {
        instructions::publish_root::handle_publish_root(ctx, index, root, total_amount, leaf_count)
    }

    /// Returns to the partner whatever the vault holds above what is owed.
    pub fn withdraw_surplus(ctx: Context<WithdrawSurplus>, amount: u64) -> Result<()> {
        instructions::withdraw_surplus::handle_withdraw_surplus(ctx, amount)
    }

    /// Closes the campaign: no new roots, but what was promised stays withdrawable.
    pub fn close_campaign(ctx: Context<CloseCampaign>) -> Result<()> {
        instructions::close_campaign::handle_close_campaign(ctx)
    }

    /// The user withdraws their reward with an inclusion proof for the published root.
    pub fn claim_reward(
        ctx: Context<ClaimReward>,
        leaf_index: u32,
        amount: u64,
        proof: Vec<[u8; 32]>,
    ) -> Result<()> {
        instructions::claim_reward::handle_claim_reward(ctx, leaf_index, amount, proof)
    }
}
