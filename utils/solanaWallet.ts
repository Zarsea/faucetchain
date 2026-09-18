import { PublicKey, type Transaction } from '@solana/web3.js';
import { keccak256 } from 'ethers';

// Phantom and Solflare both inject a provider that speaks this much. The type
// and the lookup live here because two screens need them: signing in, and
// withdrawing.
export interface SolanaProvider {
    publicKey?: { toString(): string };
    connect(): Promise<{ publicKey: { toString(): string } }>;
    signTransaction(transaction: Transaction): Promise<Transaction>;
    signMessage(message: Uint8Array, display?: string): Promise<{ signature: Uint8Array }>;
}

declare global {
    interface Window {
        solana?: SolanaProvider & { isPhantom?: boolean };
        solflare?: SolanaProvider;
    }
}

export function solanaProvider(): SolanaProvider | null {
    return window.solana ?? window.solflare ?? null;
}

/**
 * Base64 of the raw 64-byte signature — the encoding the API expects, and the
 * reason the browser needs no base58 library.
 */
export function encodeSignature(signature: Uint8Array): string {
    return btoa(String.fromCharCode(...signature));
}

/**
 * The FaucetChain address that belongs to a Solana wallet: the last 20 bytes of
 * keccak256 over the public key, which is how Ethereum derives an address from
 * one. The wallet is the account, so the same Phantom reaches the same account
 * anywhere, with no password to lose.
 *
 * api_server.address_from_solana_wallet is the other half of this, and
 * scripts/check_messages.py compares them. If the two ever disagree, the browser
 * signs for one account and the server checks another, and sign-in fails with a
 * message about signatures that points nowhere near the cause.
 */
export function accountFromWallet(solanaAddress: string): string {
    return '0x' + keccak256(new PublicKey(solanaAddress).toBytes()).slice(-40);
}
