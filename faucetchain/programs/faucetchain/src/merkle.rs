use anchor_lang::prelude::*;
use solana_keccak_hasher::hashv;

/// A reward leaf: keccak256(recipient ‖ amount LE ‖ index LE).
///
/// Same combination rule as the rest of the project (api_server.py and
/// settlement.py): parent = keccak256(left ‖ right), with the direction taken
/// from the index bit. An odd level duplicates its last node, which shows up in
/// a proof as a sibling equal to the node itself.
///
/// **There is no domain separation between a leaf and an internal node**, and
/// that is worth stating rather than leaving to be discovered. Nothing prefixes
/// a leaf with 0x00 and a node with 0x01, so `verify_proof` on its own accepts
/// an internal node presented as a leaf -- `an_internal_node_passes_as_a_leaf`
/// below proves it does.
///
/// What closes that hole is not this function: it is `claim_reward` computing
/// the leaf from the signer, the amount and the index instead of accepting one
/// from the caller. Forging a claim therefore needs a 44-byte keccak preimage
/// matching a 32-byte internal node, which is a preimage attack and not a
/// protocol mistake.
///
/// So the rule for anyone extending this program: **never pass a caller-supplied
/// leaf to `verify_proof`.** An instruction that takes a leaf as an argument
/// reopens the hole completely, and no constraint elsewhere would catch it.
/// Real domain separation is listed under "Before mainnet" in PENDING.md,
/// because adding a prefix changes every root -- including the six already
/// published, whose proofs would stop verifying.
///
/// (That count said 19 until 9 October. Nineteen was the number the sequencer's
/// database claimed; six is the number of root accounts that exist on devnet.
/// `verify_published_roots.py` is what tells them apart.)
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

    /// A three-leaf tree: the odd level duplicates the last one, as the backend does.
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

        // the amount in the leaf was changed
        let forged = leaf_hash(&Pubkey::new_from_array([1; 32]), 99, 0);
        assert!(!verify_proof(forged, 0, &[leaves[1], n22], root));
        // a different index flips the direction of the combination
        assert!(!verify_proof(leaves[0], 1, &[leaves[1], n22], root));
        // the sibling was swapped
        assert!(!verify_proof(leaves[0], 0, &[leaves[2], n22], root));
    }

    /// The same fixed vector `_self_check` asserts in settlement.py: if either
    /// side changed the rule, the two tests would disagree and withdrawals break.
    #[test]
    fn matches_the_backend_vector() {
        let (_, root) = tree();
        assert_eq!(
            root,
            [
                0xe5, 0x50, 0x5b, 0xf9, 0x59, 0x82, 0xe5, 0x4e, 0x7e, 0xc2, 0xa2, 0x06, 0x6f, 0x8a,
                0xcc, 0x19, 0x07, 0x0e, 0x81, 0xc0, 0x4a, 0x52, 0x24, 0x1d, 0xc8, 0xbd, 0xa8, 0x31,
                0x73, 0x48, 0x92, 0xc8
            ]
        );
    }

    #[test]
    fn single_leaf_tree_has_the_leaf_as_root() {
        let only = leaf_hash(&Pubkey::new_from_array([7; 32]), 5, 0);
        assert!(verify_proof(only, 0, &[], only));
    }

    /// Pins the one property of this tree that could become a theft, so that
    /// nobody has to rediscover it.
    ///
    /// Without domain separation, an internal node handed in as a leaf verifies
    /// against the root: on a four-leaf tree, n01 at index 0 with [n23] as its
    /// proof rehashes to exactly the root, because that is what the root is.
    /// This test asserts that it DOES verify -- it is not describing a defect in
    /// `verify_proof`, it is recording that `verify_proof` cannot be trusted
    /// with a leaf it did not compute.
    ///
    /// `claim_reward` is what makes it unreachable: the leaf there comes from
    /// the signer, the amount and the index, never from an argument. If this
    /// test ever starts failing, someone added domain separation and every
    /// published root changed with it, which is a migration and not a patch.
    #[test]
    fn an_internal_node_passes_as_a_leaf() {
        let leaves = [
            leaf_hash(&Pubkey::new_from_array([1; 32]), 10, 0),
            leaf_hash(&Pubkey::new_from_array([2; 32]), 20, 1),
            leaf_hash(&Pubkey::new_from_array([3; 32]), 30, 2),
            leaf_hash(&Pubkey::new_from_array([4; 32]), 40, 3),
        ];
        let n01 = parent(leaves[0], leaves[1]);
        let n23 = parent(leaves[2], leaves[3]);
        let root = parent(n01, n23);

        // The honest claim: leaf 0 with its two siblings.
        assert!(verify_proof(leaves[0], 0, &[leaves[1], n23], root));

        // The property: an internal node, one level up, with a one-node proof.
        assert!(
            verify_proof(n01, 0, &[n23], root),
            "the tree gained domain separation; every published root changed"
        );

        // And the reason it is harmless: a leaf is computed, and no (pubkey,
        // amount, index) triple in reach hashes to n01. Checking a handful is
        // not a proof of that -- the preimage resistance of keccak is -- but it
        // keeps the claim from being purely rhetorical.
        for i in 0..8u8 {
            for amount in [0u64, 10, 20, u64::MAX] {
                assert_ne!(leaf_hash(&Pubkey::new_from_array([i; 32]), amount, 0), n01);
            }
        }
    }
}
