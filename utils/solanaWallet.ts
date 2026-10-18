import { PublicKey, type Transaction } from '@solana/web3.js';
import { keccak256 } from 'ethers';

// Phantom and Solflare both inject a provider that speaks this much. The type
// and the lookup live here because two screens need them: signing in, and
// withdrawing.
export interface SolanaProvider {
    publicKey?: { toString(): string };
    // `onlyIfTrusted` restores an approval the user already gave this origin
    // without showing them a popup. It rejects when there is none, which is the
    // signal to ask properly.
    connect(options?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toString(): string } }>;
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
 * Whether this is a phone or tablet browser.
 *
 * It matters because the remedy for "no wallet" is not the same on the two.
 * On a desktop, no provider means no extension installed, and installing one
 * fixes it. On a phone, Phantom is an app and injects nothing into Chrome or
 * Safari — telling someone to install it is useless advice to someone who
 * very likely already has it.
 */
export function isMobileBrowser(): boolean {
    if (typeof navigator === 'undefined') return false;
    if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) return true;
    // An iPad asking for the desktop site reports itself as a Mac. Touch points
    // are what still give it away.
    return /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
}

/**
 * Phantom's documented deeplink for opening a page inside its own browser,
 * which is the one place on a phone where the provider exists.
 *
 * Both parameters are required and both are URL-encoded: `url` is the page to
 * open, `ref` says who asked. The host is phantom.com; the older phantom.app
 * keeps the same path.
 *
 * https://docs.phantom.com/phantom-deeplinks/other-methods/browse
 */
export function phantomBrowseLink(target?: string): string {
    const url = encodeURIComponent(target ?? window.location.href);
    const ref = encodeURIComponent(window.location.origin);
    return `https://phantom.com/ul/browse/${url}?ref=${ref}`;
}

/**
 * The account that will sign, after making sure the wallet has authorized this
 * tab to ask.
 *
 * Phantom answers signTransaction with "The requested method and/or account has
 * not been authorized by the user" when nothing connected first. A page reload
 * clears that authorization while the server-side link survives, so a screen
 * that decides what to offer from the link alone will happily show a button
 * that cannot work.
 *
 * `known` is the account this tab already connected to, when it has; passing it
 * avoids a second round trip to the wallet.
 */
export async function connectedSigner(
    provider: SolanaProvider,
    known?: string | null
): Promise<string> {
    if (known) return known;
    // Silent when the user already trusted this origin; rejects when they have
    // not, which is when it is right to show them a popup.
    const restored = await provider.connect({ onlyIfTrusted: true }).catch(() => null);
    const { publicKey } = restored ?? (await provider.connect());
    return publicKey.toString();
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
 * The browser asks the server which account a wallet signs in as rather than
 * deriving it, because a wallet already linked elsewhere signs in there instead.
 * This stays as the readable statement of the rule, and as the half that
 * scripts/check_messages.py compares against the server's.
 *
 * api_server.address_from_solana_wallet is the other half of this, and
 * scripts/check_messages.py compares them. If the two ever disagree, the browser
 * signs for one account and the server checks another, and sign-in fails with a
 * message about signatures that points nowhere near the cause.
 */
export function accountFromWallet(solanaAddress: string): string {
    return '0x' + keccak256(new PublicKey(solanaAddress).toBytes()).slice(-40);
}
