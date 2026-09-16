use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Only the campaign operator can publish reward roots")]
    Unauthorized,
    #[msg("Campaign is closed")]
    CampaignClosed,
    #[msg("Amount must be greater than zero")]
    AmountZero,
    #[msg("Vault does not cover the rewards already published and unpaid")]
    InsufficientReserve,
    #[msg("Merkle proof is longer than the maximum depth")]
    ProofTooLong,
    #[msg("Merkle proof does not lead to the published root")]
    InvalidProof,
    #[msg("This root has already paid its published total")]
    RootExhausted,
    #[msg("Arithmetic overflow")]
    Overflow,
}
