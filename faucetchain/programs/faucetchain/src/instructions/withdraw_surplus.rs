use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::{constants::*, error::ErrorCode, state::Campaign};

#[derive(Accounts)]
pub struct WithdrawSurplus<'info> {
    #[account(mut)]
    pub sponsor: Signer<'info>,

    #[account(
        mut,
        seeds = [CAMPAIGN_SEED, campaign.sponsor.as_ref(), &campaign.campaign_id.to_le_bytes()],
        bump = campaign.bump,
        has_one = sponsor @ ErrorCode::Unauthorized,
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

/// Returns to the partner whatever the vault holds above what is already owed.
///
/// Without this, tokens that enter the vault and never become a reward can never
/// leave, and funding a campaign is a one-way door. The bound is the same one
/// `publish_root` uses to accept a root: the vault must keep covering everything
/// published and not yet withdrawn, so a reward already promised to a user
/// cannot be pulled out from under them.
pub fn handle_withdraw_surplus(ctx: Context<WithdrawSurplus>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::AmountZero);

    let outstanding = ctx
        .accounts
        .campaign
        .committed
        .checked_sub(ctx.accounts.campaign.paid)
        .ok_or(ErrorCode::Overflow)?;
    let surplus = ctx
        .accounts
        .vault
        .amount
        .checked_sub(outstanding)
        .ok_or(ErrorCode::Overflow)?;
    require!(amount <= surplus, ErrorCode::InsufficientReserve);

    let sponsor = ctx.accounts.campaign.sponsor;
    let campaign_id = ctx.accounts.campaign.campaign_id.to_le_bytes();
    let bump = [ctx.accounts.campaign.bump];
    let signer_seeds: &[&[&[u8]]] = &[&[CAMPAIGN_SEED, sponsor.as_ref(), &campaign_id, &bump]];

    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.vault.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.sponsor_token_account.to_account_info(),
                authority: ctx.accounts.campaign.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
        ctx.accounts.mint.decimals,
    )?;

    msg!(
        "Campaign {} returned {} to the sponsor",
        ctx.accounts.campaign.campaign_id,
        amount
    );
    Ok(())
}
