use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::{
    constants::*,
    error::ErrorCode,
    merkle::{leaf_hash, verify_proof},
    state::{Campaign, RewardRoot},
};

#[derive(Accounts)]
pub struct ClaimReward<'info> {
    /// Owner of the reward. Signs, but needs no SOL: the fee and the rent for
    /// any new account are paid by `payer` — a relayer, in practice.
    pub recipient: Signer<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        seeds = [CAMPAIGN_SEED, campaign.sponsor.as_ref(), &campaign.campaign_id.to_le_bytes()],
        bump = campaign.bump,
        has_one = mint
    )]
    pub campaign: Account<'info, Campaign>,

    #[account(
        mut,
        seeds = [ROOT_SEED, campaign.key().as_ref(), &reward_root.index.to_le_bytes()],
        bump,
        constraint = reward_root.campaign == campaign.key() @ ErrorCode::InvalidProof
    )]
    pub reward_root: Account<'info, RewardRoot>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        seeds = [VAULT_SEED, campaign.key().as_ref()],
        bump = campaign.vault_bump
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = recipient,
        associated_token::token_program = token_program
    )]
    pub recipient_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handle_claim_reward(
    ctx: Context<ClaimReward>,
    leaf_index: u32,
    amount: u64,
    proof: Vec<[u8; 32]>,
) -> Result<()> {
    require!(amount > 0, ErrorCode::AmountZero);
    require!(proof.len() <= MAX_PROOF_LEN, ErrorCode::ProofTooLong);

    let recipient = ctx.accounts.recipient.key();
    let leaf = leaf_hash(&recipient, amount, leaf_index);
    require!(
        verify_proof(leaf, leaf_index, &proof, ctx.accounts.reward_root.root),
        ErrorCode::InvalidProof
    );

    let reward_root = &mut ctx.accounts.reward_root;
    require!(
        leaf_index < reward_root.leaf_count,
        ErrorCode::LeafOutOfRange
    );
    // Setting the bit is what stops a second withdrawal of the same leaf. It
    // fails when the bit is already set, which is exactly that second attempt.
    require!(
        reward_root.mark_claimed(leaf_index),
        ErrorCode::AlreadyClaimed
    );
    let claimed = reward_root
        .claimed
        .checked_add(amount)
        .ok_or(ErrorCode::Overflow)?;
    require!(claimed <= reward_root.total_amount, ErrorCode::RootExhausted);
    reward_root.claimed = claimed;

    let campaign_key = ctx.accounts.campaign.key();
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
                to: ctx.accounts.recipient_token_account.to_account_info(),
                authority: ctx.accounts.campaign.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
        ctx.accounts.mint.decimals,
    )?;

    let campaign = &mut ctx.accounts.campaign;
    campaign.paid = campaign.paid.checked_add(amount).ok_or(ErrorCode::Overflow)?;

    msg!("Leaf {} of campaign {} paid {}", leaf_index, campaign_key, amount);
    Ok(())
}
