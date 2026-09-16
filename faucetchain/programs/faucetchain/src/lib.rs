//! FaucetChain — camada de liquidação na Solana.
//!
//! A FaucetChain (appchain) continua distribuindo: prova do clique, quota
//! horária, Sentinel e micro-claims. Este programa guarda o que precisa de
//! garantia pública:
//!
//! 1. o orçamento do projeto parceiro fica num cofre por campanha;
//! 2. a FaucetChain publica a raiz Merkle de cada lote de prêmios;
//! 3. o usuário saca provando que sua folha está naquela raiz.
//!
//! O dinheiro do parceiro nunca atravessa uma ponte: ele entra e sai aqui.
pub mod constants;
pub mod error;
pub mod instructions;
pub mod merkle;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("64LW8DZcrttzaZ5RTTxAytfCGdb3QvDeTq5pUY7WBqSm");

#[program]
pub mod faucetchain {
    use super::*;

    /// Abre uma campanha e o cofre que guarda o orçamento dela.
    pub fn create_campaign(
        ctx: Context<CreateCampaign>,
        campaign_id: u64,
        operator: Pubkey,
    ) -> Result<()> {
        instructions::create_campaign::handle_create_campaign(ctx, campaign_id, operator)
    }

    /// O parceiro deposita tokens no cofre da campanha.
    pub fn fund_campaign(ctx: Context<FundCampaign>, amount: u64) -> Result<()> {
        instructions::fund_campaign::handle_fund_campaign(ctx, amount)
    }

    /// A FaucetChain publica a raiz de um lote de prêmios. Só passa se o cofre
    /// cobrir tudo que já foi prometido e ainda não sacado.
    pub fn publish_root(
        ctx: Context<PublishRoot>,
        index: u32,
        root: [u8; 32],
        total_amount: u64,
        leaf_count: u32,
    ) -> Result<()> {
        instructions::publish_root::handle_publish_root(ctx, index, root, total_amount, leaf_count)
    }

    /// Devolve ao parceiro o que sobrou no cofre além do já prometido.
    pub fn withdraw_surplus(ctx: Context<WithdrawSurplus>, amount: u64) -> Result<()> {
        instructions::withdraw_surplus::handle_withdraw_surplus(ctx, amount)
    }

    /// Encerra a campanha: nenhuma raiz nova, mas o prometido continua sacável.
    pub fn close_campaign(ctx: Context<CloseCampaign>) -> Result<()> {
        instructions::close_campaign::handle_close_campaign(ctx)
    }

    /// O usuário saca seu prêmio com a prova de inclusão na raiz publicada.
    pub fn claim_reward(
        ctx: Context<ClaimReward>,
        leaf_index: u32,
        amount: u64,
        proof: Vec<[u8; 32]>,
    ) -> Result<()> {
        instructions::claim_reward::handle_claim_reward(ctx, leaf_index, amount, proof)
    }
}
