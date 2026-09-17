/**
 * The sentences a wallet asks somebody to sign.
 *
 * The wallet shows these verbatim, so each opens with what the signature does
 * and what it does not do, then lists the facts one per line. Every action used
 * to build its own pipe-separated line at the call site, which read as jargon
 * in the wallet and gave five separate chances for this file and the server to
 * disagree about a byte — a disagreement that surfaces as "invalid signature",
 * far from its cause.
 *
 * This file is the mirror of the builders in settlement.py. Fixed vectors in
 * that module's self-check pin every sentence, and scripts/check-messages.mjs
 * runs these functions against the Python ones. Change one side and the other
 * has to follow, or linking and claiming both start failing verification.
 */

const CHAIN_ID = '7777';

type Field = [string, string];

export function actionMessage(
    action: string,
    explanation: string,
    fields: Field[],
    ts: number,
    chainId: string = CHAIN_ID
): string {
    const issued = new Date(ts * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
    return [
        `FaucetChain: ${action}`,
        '',
        explanation,
        '',
        ...fields.map(([label, value]) => `${label}: ${value}`),
        `Chain: ${chainId}`,
        `Issued: ${issued}`,
    ].join('\n');
}

export const claimMessage = (user: string, ts: number): string =>
    actionMessage(
        'claim your rewards',
        'Signing proves this claim came from you. It costs nothing and moves ' +
        'no money on its own.',
        [['Account', user]],
        ts
    );

export const withdrawMessage = (user: string, faucet: string, ts: number): string =>
    actionMessage(
        'withdraw your balance',
        'Signing sends the micro-claims you have collected to the faucet ' +
        'below. Check that address: the transfer cannot be undone.',
        [['Account', user], ['Faucet', faucet]],
        ts
    );

export const stakeMessage = (user: string, amount: number, tier: string, ts: number): string =>
    actionMessage(
        'stake your CLAIM',
        'Signing locks the amount below in the tier below. It stays locked ' +
        "until you unstake it under that tier's terms.",
        [['Account', user], ['Amount', `${amount.toFixed(6)} CLAIM`], ['Tier', tier]],
        ts
    );

export const unstakeMessage = (user: string, position: string, ts: number): string =>
    actionMessage(
        'close a staking position',
        'Signing closes the position below and credits its principal and ' +
        'yield back to your balance.',
        [['Account', user], ['Position', position]],
        ts
    );

export const linkMessage = (user: string, solanaAddress: string, ts: number): string =>
    actionMessage(
        'link a Solana wallet',
        'Signing names the Solana wallet that should receive your rewards. ' +
        'The wallet signs separately to prove you hold its key.',
        [['Account', user], ['Wallet', solanaAddress]],
        ts
    );

// Signed by the Solana wallet itself, not by the FaucetChain account: the one
// above says which wallet was chosen, this says who can spend from it.
export const walletProofMessage = (user: string, wallet: string, ts: number): string =>
    actionMessage(
        'prove you control this wallet',
        'Signing links your FaucetChain account to this Solana wallet so ' +
        'rewards can be paid to it. It costs nothing and authorises no ' +
        'transaction.',
        [['Account', user], ['Wallet', wallet]],
        ts
    );
