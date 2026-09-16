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

/// Encerra a campanha: o operador não publica mais raízes nela.
///
/// Não mexe no cofre. Quem já tem prêmio numa raiz publicada continua podendo
/// sacar depois do encerramento — o que fecha é a entrada de novas promessas,
/// não a saída do que já foi prometido. O que sobrar volta pelo
/// `withdraw_surplus`.
pub fn handle_close_campaign(ctx: Context<CloseCampaign>) -> Result<()> {
    let campaign = &mut ctx.accounts.campaign;
    require!(!campaign.closed, ErrorCode::CampaignClosed);
    campaign.closed = true;
    msg!("Campaign {} closed", campaign.campaign_id);
    Ok(())
}
