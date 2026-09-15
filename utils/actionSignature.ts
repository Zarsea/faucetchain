import { ethers } from 'ethers';

export interface ActionSignature {
    signature: string | null;
    sig_timestamp: number | null;
}

// Carteiras Web3 assinam cada ação que mexe em saldo (EIP-191, verificada por
// require_action_signature no backend). Contas demo/custodiais não têm chave
// e enviam assinatura nula.
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
