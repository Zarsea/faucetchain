use anchor_lang::prelude::*;
use solana_keccak_hasher::hashv;

/// Folha de prêmio: keccak256(destinatário ‖ valor LE ‖ índice LE).
///
/// Mesma regra de combinação do resto do projeto (api_server.py e
/// utils/merkle.ts): pai = keccak256(esquerda ‖ direita), com a direção dada
/// pelo bit do índice. Nível ímpar duplica o último nó, o que aparece na prova
/// como um irmão igual ao próprio nó.
pub fn leaf_hash(recipient: &Pubkey, amount: u64, leaf_index: u32) -> [u8; 32] {
    hashv(&[
        recipient.as_ref(),
        &amount.to_le_bytes(),
        &leaf_index.to_le_bytes(),
    ])
    .to_bytes()
}

pub fn verify_proof(
    leaf: [u8; 32],
    leaf_index: u32,
    proof: &[[u8; 32]],
    root: [u8; 32],
) -> bool {
    let mut hash = leaf;
    let mut index = leaf_index;
    for sibling in proof {
        hash = if index & 1 == 1 {
            hashv(&[sibling, &hash]).to_bytes()
        } else {
            hashv(&[&hash, sibling]).to_bytes()
        };
        index >>= 1;
    }
    hash == root
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parent(left: [u8; 32], right: [u8; 32]) -> [u8; 32] {
        hashv(&[&left, &right]).to_bytes()
    }

    /// Árvore de 3 folhas: o nível ímpar duplica a última, como no backend.
    fn tree() -> ([[u8; 32]; 3], [u8; 32]) {
        let leaves = [
            leaf_hash(&Pubkey::new_from_array([1; 32]), 10, 0),
            leaf_hash(&Pubkey::new_from_array([2; 32]), 20, 1),
            leaf_hash(&Pubkey::new_from_array([3; 32]), 30, 2),
        ];
        let n01 = parent(leaves[0], leaves[1]);
        let n22 = parent(leaves[2], leaves[2]);
        (leaves, parent(n01, n22))
    }

    #[test]
    fn accepts_every_leaf_of_the_tree() {
        let (leaves, root) = tree();
        let n01 = parent(leaves[0], leaves[1]);
        let n22 = parent(leaves[2], leaves[2]);

        assert!(verify_proof(leaves[0], 0, &[leaves[1], n22], root));
        assert!(verify_proof(leaves[1], 1, &[leaves[0], n22], root));
        assert!(verify_proof(leaves[2], 2, &[leaves[2], n01], root));
    }

    #[test]
    fn rejects_wrong_amount_index_or_sibling() {
        let (leaves, root) = tree();
        let n22 = parent(leaves[2], leaves[2]);

        // valor trocado na folha
        let forged = leaf_hash(&Pubkey::new_from_array([1; 32]), 99, 0);
        assert!(!verify_proof(forged, 0, &[leaves[1], n22], root));
        // índice trocado inverte a direção da combinação
        assert!(!verify_proof(leaves[0], 1, &[leaves[1], n22], root));
        // irmão trocado
        assert!(!verify_proof(leaves[0], 0, &[leaves[2], n22], root));
    }

    #[test]
    fn single_leaf_tree_has_the_leaf_as_root() {
        let only = leaf_hash(&Pubkey::new_from_array([7; 32]), 5, 0);
        assert!(verify_proof(only, 0, &[], only));
    }
}
