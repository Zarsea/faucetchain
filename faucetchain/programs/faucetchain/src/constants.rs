use anchor_lang::prelude::*;

#[constant]
pub const CAMPAIGN_SEED: &[u8] = b"campaign";

#[constant]
pub const VAULT_SEED: &[u8] = b"vault";

#[constant]
pub const ROOT_SEED: &[u8] = b"root";

/// Most leaves one batch may carry, which sets the size of its withdrawal
/// bitmap: 8192 leaves is 1024 bytes, comfortably inside the 10240-byte limit
/// on an account created through a CPI. A busier campaign closes more batches
/// rather than larger ones.
pub const MAX_LEAVES_PER_BATCH: u32 = 8192;

/// Deepest tree a proof may describe. A full batch of 8192 leaves is 2^13, so
/// nothing longer than this can be honest.
pub const MAX_PROOF_LEN: usize = 13;
