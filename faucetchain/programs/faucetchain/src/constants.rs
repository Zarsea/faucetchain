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

/// The two constants above are one decision, and until this line nothing said
/// so. A batch of 2^13 leaves needs proofs of 13 nodes; raising
/// MAX_LEAVES_PER_BATCH without raising MAX_PROOF_LEN makes the deepest leaves
/// unprovable, and the tokens behind them stay in the vault with no instruction
/// able to release them -- `claim_reward` would refuse every proof long enough
/// to reach them with `ProofTooLong`.
///
/// Compile time, so that mistake cannot ship. A comment explaining the relation
/// is what was here before, and a comment does not fail a build.
const _: () = assert!(MAX_LEAVES_PER_BATCH as u64 <= 1u64 << MAX_PROOF_LEN);
