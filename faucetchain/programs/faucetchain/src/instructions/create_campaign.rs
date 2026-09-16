use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::{constants::*, state::Campaign};

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

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handle_create_campaign(
    ctx: Context<CreateCampaign>,
    campaign_id: u64,
    operator: Pubkey,
) -> Result<()> {
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

    msg!("Campaign {} created by {}", campaign_id, campaign.sponsor);
    Ok(())
}
