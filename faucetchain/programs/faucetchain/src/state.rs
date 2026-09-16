use anchor_lang::prelude::*;

/// Campanha de um projeto parceiro: o orçamento fica num cofre nesta rede e só
/// sai contra uma raiz de prêmios publicada pela FaucetChain.
#[account]
#[derive(InitSpace)]
pub struct Campaign {
    /// Quem financia (deposita no cofre).
    pub sponsor: Pubkey,
    /// Quem publica as raízes de prêmios (o sequenciador da FaucetChain).
    pub operator: Pubkey,
    pub mint: Pubkey,
    pub campaign_id: u64,
    /// Total já depositado no cofre.
    pub funded: u64,
    /// Total já sacado por usuários.
    pub paid: u64,
    /// Soma dos totais de todas as raízes publicadas.
    pub committed: u64,
    pub root_count: u32,
    pub closed: bool,
    pub bump: u8,
    pub vault_bump: u8,
}

/// Um lote de prêmios: a FaucetChain fecha o lote fora da cadeia e publica aqui
/// só a raiz. Cada usuário saca provando que sua folha está nessa árvore.
#[account]
#[derive(InitSpace)]
pub struct RewardRoot {
    pub campaign: Pubkey,
    pub index: u32,
    pub root: [u8; 32],
    pub total_amount: u64,
    pub claimed: u64,
    pub leaf_count: u32,
    pub published_at: i64,
}

/// Marca uma folha como gasta. A existência desta conta é o que impede sacar
/// duas vezes o mesmo prêmio.
#[account]
#[derive(InitSpace)]
pub struct ClaimReceipt {
    pub root: Pubkey,
    pub recipient: Pubkey,
    pub leaf_index: u32,
    pub amount: u64,
    pub claimed_at: i64,
}
