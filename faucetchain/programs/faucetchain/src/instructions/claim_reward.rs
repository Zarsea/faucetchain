use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::{
    constants::*,
    error::ErrorCode,
    merkle::{leaf_hash, verify_proof},
    state::{Campaign, ClaimReceipt, RewardRoot},
};

#[derive(Accounts)]
#[instruction(leaf_index: u32)]
pub struct ClaimReward<'info> {
    /// Dono do prêmio. Assina, mas não precisa ter SOL: quem paga a taxa e o
    /// rent das contas novas é o `payer` (o relayer Kora, na prática).
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

    /// A existência desta conta é o registro de que a folha já foi paga.
    #[account(
        init,
        payer = payer,
        space = 8 + ClaimReceipt::INIT_SPACE,
        seeds = [RECEIPT_SEED, reward_root.key().as_ref(), &leaf_index.to_le_bytes()],
        bump
    )]
    pub receipt: Account<'info, ClaimReceipt>,

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
    let claimed = reward_root
        .claimed
        .checked_add(amount)
        .ok_or(ErrorCode::Overflow)?;
    require!(claimed <= reward_root.total_amount, ErrorCode::RootExhausted);

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

    reward_root.claimed = claimed;

    let receipt = &mut ctx.accounts.receipt;
    receipt.root = reward_root.key();
    receipt.recipient = recipient;
    receipt.leaf_index = leaf_index;
    receipt.amount = amount;
    receipt.claimed_at = Clock::get()?.unix_timestamp;

    let campaign = &mut ctx.accounts.campaign;
    campaign.paid = campaign.paid.checked_add(amount).ok_or(ErrorCode::Overflow)?;

    msg!("Leaf {} of campaign {} paid {}", leaf_index, campaign_key, amount);
    Ok(())
}
