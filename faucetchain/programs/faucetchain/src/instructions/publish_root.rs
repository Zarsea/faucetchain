use anchor_lang::prelude::*;
use anchor_spl::token_interface::TokenAccount;

use crate::{constants::*, error::ErrorCode, state::{Campaign, RewardRoot}};

#[derive(Accounts)]
#[instruction(index: u32)]
pub struct PublishRoot<'info> {
    #[account(mut)]
    pub operator: Signer<'info>,

    #[account(
        mut,
        seeds = [CAMPAIGN_SEED, campaign.sponsor.as_ref(), &campaign.campaign_id.to_le_bytes()],
        bump = campaign.bump
    )]
    pub campaign: Account<'info, Campaign>,

    #[account(
        init,
        payer = operator,
        space = 8 + RewardRoot::INIT_SPACE,
        seeds = [ROOT_SEED, campaign.key().as_ref(), &index.to_le_bytes()],
        bump
    )]
    pub reward_root: Account<'info, RewardRoot>,

    #[account(
        seeds = [VAULT_SEED, campaign.key().as_ref()],
        bump = campaign.vault_bump
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
}

pub fn handle_publish_root(
    ctx: Context<PublishRoot>,
    index: u32,
    root: [u8; 32],
    total_amount: u64,
    leaf_count: u32,
) -> Result<()> {
    let campaign = &mut ctx.accounts.campaign;
    require_keys_eq!(
        campaign.operator,
        ctx.accounts.operator.key(),
        ErrorCode::Unauthorized
    );
    require!(!campaign.closed, ErrorCode::CampaignClosed);
    require!(total_amount > 0 && leaf_count > 0, ErrorCode::AmountZero);

    // Proof of reserve inside the instruction itself: a campaign cannot promise
    // more than the vault covers, counting everything published and not yet paid.
    let outstanding = campaign
        .committed
        .checked_sub(campaign.paid)
        .ok_or(ErrorCode::Overflow)?
        .checked_add(total_amount)
        .ok_or(ErrorCode::Overflow)?;
    require!(
        ctx.accounts.vault.amount >= outstanding,
        ErrorCode::InsufficientReserve
    );

    let reward_root = &mut ctx.accounts.reward_root;
    reward_root.campaign = campaign.key();
    reward_root.index = index;
    reward_root.root = root;
    reward_root.total_amount = total_amount;
    reward_root.claimed = 0;
    reward_root.leaf_count = leaf_count;
    reward_root.published_at = Clock::get()?.unix_timestamp;

    campaign.committed = campaign
        .committed
        .checked_add(total_amount)
        .ok_or(ErrorCode::Overflow)?;
    campaign.root_count = campaign.root_count.saturating_add(1);

    msg!("Root {} published with {} leaves", index, leaf_count);
    Ok(())
}
