use anchor_lang::prelude::*;

#[constant]
pub const CAMPAIGN_SEED: &[u8] = b"campaign";

#[constant]
pub const VAULT_SEED: &[u8] = b"vault";

#[constant]
pub const ROOT_SEED: &[u8] = b"root";

#[constant]
pub const RECEIPT_SEED: &[u8] = b"receipt";

/// Profundidade máxima da árvore aceita numa prova (2^24 folhas por lote).
pub const MAX_PROOF_LEN: usize = 24;
