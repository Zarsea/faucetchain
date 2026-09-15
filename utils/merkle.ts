import { concat, getBytes, keccak256 } from 'ethers';

function bytes32(hex: string): Uint8Array {
  return getBytes(hex);
}

/**
 * Verifica prova de inclusão usando o mesmo esquema do backend:
 * - leafHash = keccak256(bytes32(blockHash))
 * - parent = keccak256(left || right)
 * - index define a direção (bit 0 = leaf level)
 */
export function verifyBlockHashMerkleProof(params: {
  blockHash: string;
  root: string;
  siblings: string[];
  index: number;
}): boolean {
  const leafHash = keccak256(bytes32(params.blockHash));
  let hash = leafHash;
  let idx = params.index;

  for (const sibling of params.siblings) {
    const a = bytes32(hash);
    const b = bytes32(sibling);
    const isRight = (idx & 1) === 1;
    hash = isRight ? keccak256(concat([b, a])) : keccak256(concat([a, b]));
    idx >>= 1;
  }

  return hash.toLowerCase() === params.root.toLowerCase();
}

