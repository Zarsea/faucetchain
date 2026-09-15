import { ethers } from 'ethers';
import { API_BASE_URL } from '../apiConfig';

export interface PocProof {
    poc_nonce: number;
    poc_epoch_id: number;
    poc_parent_hash: string;
}

// Proof of Claim: acha `nonce` tal que
// keccak256("FaucetChain-PoC|chain|epoch|parentHash|user|nonce") tenha
// N bits iniciais em zero. Amarrado ao tip da cadeia → não pré-computável.
export async function solvePocChallenge(
    userAddr: string,
    onProgress?: (status: string) => void
): Promise<PocProof> {
    const chRes = await fetch(`${API_BASE_URL}/api/poc/challenge`);
    if (!chRes.ok) throw new Error('Falha ao obter o desafio PoC');
    const ch = await chRes.json();
    const target = BigInt(1) << BigInt(256 - ch.difficultyBits);
    let nonce = Math.floor(Math.random() * 1_000_000_000);
    let attempts = 0;
    while (true) {
        const msg = `FaucetChain-PoC|${ch.chainId}|${ch.epochId}|${ch.parentHash}|${userAddr.toLowerCase()}|${nonce}`;
        const hash = ethers.keccak256(ethers.toUtf8Bytes(msg));
        if (BigInt(hash) < target) {
            onProgress?.(`⛏️ Bloco explorado! ${attempts.toLocaleString()} hashes`);
            return { poc_nonce: nonce, poc_epoch_id: ch.epochId, poc_parent_hash: ch.parentHash };
        }
        nonce++;
        attempts++;
        if (attempts % 2000 === 0) {
            onProgress?.(`⛏️ Explorando bloco... ${attempts.toLocaleString()} hashes`);
            await new Promise(r => setTimeout(r, 0)); // não travar a UI
        }
    }
}
