use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::{constants::*, error::ErrorCode, state::Campaign};

#[derive(Accounts)]
pub struct FundCampaign<'info> {
    #[account(mut)]
    pub sponsor: Signer<'info>,

    #[account(
        mut,
        seeds = [CAMPAIGN_SEED, campaign.sponsor.as_ref(), &campaign.campaign_id.to_le_bytes()],
        bump = campaign.bump,
        has_one = mint
    )]
    pub campaign: Account<'info, Campaign>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(mut, token::mint = mint, token::authority = sponsor)]
    pub sponsor_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [VAULT_SEED, campaign.key().as_ref()],
        bump = campaign.vault_bump
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handle_fund_campaign(ctx: Context<FundCampaign>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::AmountZero);
    require!(!ctx.accounts.campaign.closed, ErrorCode::CampaignClosed);

    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.sponsor_token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.sponsor.to_account_info(),
            },
        ),
        amount,
        ctx.accounts.mint.decimals,
    )?;

    let campaign = &mut ctx.accounts.campaign;
    campaign.funded = campaign
        .funded
        .checked_add(amount)
        .ok_or(ErrorCode::Overflow)?;

    msg!("Campaign {} funded with {}", campaign.campaign_id, amount);
    Ok(())
}
