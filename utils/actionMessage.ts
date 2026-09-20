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

// A value may arrive as a number (a UTXO id, an amount). Both languages render
// one the same way, so the template literal below is safe either way.
type Field = [string, string | number];

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

// `position` is a UTXO id, which arrives as a number here and as an int on the
// server. Both render it the same way, and the cross-check passes a number so
// that stays true.
export const unstakeMessage = (user: string, position: string | number, ts: number): string =>
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

// The key used to come back from a GET keyed on the faucet's wallet address,
// which the faucet directory publishes. Anyone who could read the directory
// could read the key — and the key is what authorises distributing in that
// faucet's name.
export const apiKeyRevealMessage = (faucet: string, ts: number): string =>
    actionMessage(
        'show your API key',
        'Signing shows the key your faucet uses to call FaucetChain. Whoever ' +
        'holds that key can distribute in your name, so it goes to the wallet ' +
        'that owns the faucet and to nobody else.',
        [['Faucet', faucet]],
        ts
    );

export const apiKeyRotateMessage = (faucet: string, ts: number): string =>
    actionMessage(
        'replace your API key',
        'Signing retires the key your faucet uses now and issues a new one. ' +
        'The old key stops working immediately, so your faucet will fail its ' +
        'next call until you update it.',
        [['Faucet', faucet]],
        ts
    );

// Names a FaucetPay account; it does not prove one. FaucetPay's check-address
// confirms an address belongs to some account and says nothing about who
// controls it, so the account counts as proved only once a payment arrives.
export const faucetpayLinkMessage = (faucet: string, faucetpayAddress: string, ts: number): string =>
    actionMessage(
        'link a FaucetPay account',
        'Signing names the FaucetPay account behind this faucet. It moves no ' +
        'money and proves nothing on its own: the account counts as yours ' +
        'once a payment arrives from it.',
        [['Faucet', faucet], ['FaucetPay', faucetpayAddress]],
        ts
    );

// O endpoint tirava a carteira do corpo da requisicao e debitava. Qualquer
// chamador podia nomear qualquer carteira e gastar o saldo de outra pessoa num
// booster que depois pertencia a essa pessoa.
export const boosterMessage = (user: string, booster: string, cost: number, ts: number): string =>
    actionMessage(
        'buy a booster',
        'Signing spends the amount below from your balance. Part of it is ' +
        'burned and part goes to the treasury, so it does not come back.',
        [['Account', user], ['Booster', booster], ['Cost', `${cost.toFixed(6)} CLAIM`]],
        ts
    );

export const bountyClaimMessage = (user: string, bounty: string | number, ts: number): string =>
    actionMessage(
        'take on a bounty',
        'Signing puts your name on the bounty below as the hunter working it. ' +
        'It pays nothing yet.',
        [['Account', user], ['Bounty', bounty]],
        ts
    );

// A verificacao antiga comparava o endereco do criador vindo da requisicao com
// o gravado na bounty. Os dois saiam do mesmo lugar assim que o chamador
// soubesse o endereco, o que fazia a checagem comparar um valor consigo mesmo.
export const bountyApproveMessage = (user: string, bounty: string | number, ts: number): string =>
    actionMessage(
        'approve a bounty',
        "Signing accepts the hunter's work and releases the reward below. It " +
        'cannot be taken back.',
        [['Account', user], ['Bounty', bounty]],
        ts
    );
