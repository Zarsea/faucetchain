use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::{constants::*, error::ErrorCode, state::Campaign};

#[derive(Accounts)]
#[instruction(campaign_id: u64)]
pub struct CreateCampaign<'info> {
    #[account(mut)]
    pub sponsor: Signer<'info>,

    #[account(
        init,
        payer = sponsor,
        space = 8 + Campaign::INIT_SPACE,
        seeds = [CAMPAIGN_SEED, sponsor.key().as_ref(), &campaign_id.to_le_bytes()],
        bump
    )]
    pub campaign: Account<'info, Campaign>,

    pub mint: InterfaceAccount<'info, Mint>,

    /// The campaign vault: a token account whose authority is the campaign itself.
    #[account(
        init,
        payer = sponsor,
        seeds = [VAULT_SEED, campaign.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = campaign,
        token::token_program = token_program
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    /// Classic SPL Token only, pinned here rather than left to the interface.
    ///
    /// TokenInterface accepts Token-2022, and a Token-2022 mint may carry a
    /// TransferFee. The vault would be debited what the leaf says while the
    /// recipient receives less -- and the leaf is the promise this whole
    /// program exists to keep. A root that pays 98 where it published 100 is
    /// not a rounding problem, it is the guarantee failing quietly.
    ///
    /// The vault is created under this program and never changes program
    /// afterwards, so pinning it at creation is enough: a Token-2022 mint can
    /// never reach claim_reward.
    #[account(address = anchor_spl::token::ID @ ErrorCode::UnsupportedTokenProgram)]
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handle_create_campaign(
    ctx: Context<CreateCampaign>,
    campaign_id: u64,
    operator: Pubkey,
    period_cap: u64,
    period_len: i64,
) -> Result<()> {
    require!(period_len >= 0, ErrorCode::AmountZero);
    let campaign = &mut ctx.accounts.campaign;
    campaign.sponsor = ctx.accounts.sponsor.key();
    campaign.operator = operator;
    campaign.mint = ctx.accounts.mint.key();
    campaign.campaign_id = campaign_id;
    campaign.funded = 0;
    campaign.paid = 0;
    campaign.committed = 0;
    campaign.root_count = 0;
    campaign.closed = false;
    campaign.bump = ctx.bumps.campaign;
    campaign.vault_bump = ctx.bumps.vault;
    campaign.period_cap = period_cap;
    campaign.period_len = period_len;
    campaign.period_start = Clock::get()?.unix_timestamp;
    campaign.spent_period = 0;

    msg!("Campaign {} created by {}", campaign_id, campaign.sponsor);
    Ok(())
}
