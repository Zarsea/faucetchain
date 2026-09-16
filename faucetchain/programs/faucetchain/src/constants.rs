use anchor_lang::prelude::*;

#[constant]
pub const CAMPAIGN_SEED: &[u8] = b"campaign";

#[constant]
pub const VAULT_SEED: &[u8] = b"vault";

#[constant]
pub const ROOT_SEED: &[u8] = b"root";

#[constant]
pub const RECEIPT_SEED: &[u8] = b"receipt";

/// Deepest tree a proof may describe (2^24 leaves per batch).
pub const MAX_PROOF_LEN: usize = 24;
