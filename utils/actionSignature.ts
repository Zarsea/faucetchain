import { ethers } from 'ethers';

export interface ActionSignature {
    signature: string | null;
    sig_timestamp: number | null;
}

// Signs a balance-moving action with the account's own EVM key (EIP-191,
// checked by require_action_signature on the server).
//
// Since external wallets were dropped as a login method, every account here is
// custodial and this returns nulls: the server holds the key, so it does the
// signing itself. The path is kept because the server still verifies a
// signature whenever one arrives, and because the Solana wallet proof on the
// payouts screen is the live example of the same idea.
export async function signAction(
    authMethod: string | null,
    buildMessage: (ts: number) => string
): Promise<ActionSignature> {
    if (authMethod !== 'WALLET' || typeof window.ethereum === 'undefined') {
        return { signature: null, sig_timestamp: null };
    }
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const sig_timestamp = Math.floor(Date.now() / 1000);
    const signature = await signer.signMessage(buildMessage(sig_timestamp));
    return { signature, sig_timestamp };
}
