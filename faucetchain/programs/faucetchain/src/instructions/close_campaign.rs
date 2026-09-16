use anchor_lang::prelude::*;

use crate::{constants::*, error::ErrorCode, state::Campaign};

#[derive(Accounts)]
pub struct CloseCampaign<'info> {
    pub sponsor: Signer<'info>,

    #[account(
        mut,
        seeds = [CAMPAIGN_SEED, campaign.sponsor.as_ref(), &campaign.campaign_id.to_le_bytes()],
        bump = campaign.bump,
        has_one = sponsor @ ErrorCode::Unauthorized
    )]
    pub campaign: Account<'info, Campaign>,
}

/// Closes the campaign: the operator publishes no further roots on it.
///
/// It does not touch the vault. Anyone holding a reward in a published root can
/// still withdraw after the close — what shuts is the way in for new promises,
/// not the way out for what was already promised. The rest goes back through
/// `withdraw_surplus`.
pub fn handle_close_campaign(ctx: Context<CloseCampaign>) -> Result<()> {
    let campaign = &mut ctx.accounts.campaign;
    require!(!campaign.closed, ErrorCode::CampaignClosed);
    campaign.closed = true;
    msg!("Campaign {} closed", campaign.campaign_id);
    Ok(())
}
