import React, { useCallback, useEffect, useState } from 'react';
import { Transaction } from '@solana/web3.js';
import { solanaProvider, encodeSignature, connectedSigner } from '../utils/solanaWallet';
import { SectionCard } from './SectionCard';
import {
    ArrowUpRightIcon,
    CubeIcon,
    LoadingIcon,
    ShieldCheckIcon,
} from './IconComponents';
import { useAuth, sessionHeaders } from './AuthContext';
import { API_BASE_URL } from '../apiConfig';
import { useLanguage } from './LanguageContext';
import { signAction } from '../utils/actionSignature';
import { linkMessage, walletProofMessage } from '../utils/actionMessage';

// The reward a published Merkle root owes this user, as the sequencer serves it.
interface Proof {
    batch_id: number;
    campaign_id: number;
    root_index: number;
    root: string;
    published_signature: string | null;
    recipient: string;
    amount: number;
    leaf_index: number;
    proof: string[];
    // null when the sequencer could not reach Solana to check
    claimed: boolean | null;
}


const EXPLORER = 'https://explorer.solana.com';

function explorerUrl(signature: string): string {
    // The demo runs on devnet; a mainnet deployment drops the cluster query.
    return `${EXPLORER}/tx/${signature}?cluster=devnet`;
}


function short(value: string): string {
    return value.length > 12 ? `${value.slice(0, 4)}…${value.slice(-4)}` : value;
}


export const SolanaPayouts: React.FC = () => {
    const { userAddress, isConnected, authMethod } = useAuth();
    const { tri } = useLanguage();

    const [wallet, setWallet] = useState<string | null>(null);
    const [linked, setLinked] = useState<string | null>(null);
    const [proofs, setProofs] = useState<Proof[]>([]);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [sent, setSent] = useState<Record<number, string>>({});

    const loadLinkAndProofs = useCallback(async () => {
        if (!userAddress) return;
        try {
            // Com sessão: desde 8/10 o servidor só diz a carteira de quem está
            // dentro da conta. Sem o cabeçalho isto volta 401 e a tela diz que
            // não há vínculo, que é falso.
            const linkResponse = await fetch(`${API_BASE_URL}/api/solana/link/${userAddress}`, {
                headers: sessionHeaders(),
            });
            if (linkResponse.ok) {
                const body = await linkResponse.json();
                setLinked(body.solana_address);
            } else {
                setLinked(null);
                setProofs([]);
                return;
            }
            const proofResponse = await fetch(`${API_BASE_URL}/api/solana/proof/${userAddress}`);
            if (proofResponse.ok) {
                const body = await proofResponse.json();
                setProofs(body.proofs ?? []);
            }
        } catch {
            setError(tri('Could not reach the sequencer.', 'Não foi possível falar com o sequenciador.',
                         'No fue posible hablar con el secuenciador.'));
        }
    }, [userAddress]);

    useEffect(() => {
        loadLinkAndProofs();
    }, [loadLinkAndProofs]);

    const connectWallet = async () => {
        const solana = solanaProvider();
        if (!solana) {
            setError(tri('No Solana wallet found. Install Phantom or Solflare and reload.',
                         'Nenhuma carteira Solana encontrada. Instale a Phantom ou a Solflare e recarregue.',
                         'No se encontró ninguna billetera Solana. Instale Phantom o Solflare y recargue.'));
            return;
        }
        setError(null);
        setBusy('connect');
        try {
            const { publicKey } = await solana.connect();
            setWallet(publicKey.toString());
        } catch {
            setError(tri('The wallet refused the connection.', 'A carteira recusou a conexão.',
                         'La billetera rechazó la conexión.'));
        } finally {
            setBusy(null);
        }
    };

    const linkWallet = async () => {
        const solana = solanaProvider();
        if (!wallet || !userAddress || !solana) return;
        setError(null);
        setBusy('link');
        try {
            const { signature, sig_timestamp } = await signAction(
                authMethod,
                (ts) => linkMessage(userAddress.toLowerCase(), wallet, ts)
            );

            // The second signature, from the Solana wallet itself. The one above
            // says who chose this address; only this one says who holds its key,
            // and a root already published cannot be redirected to fix a typo.
            const solana_sig_timestamp = Math.floor(Date.now() / 1000);
            const proof = walletProofMessage(userAddress.toLowerCase(), wallet, solana_sig_timestamp);
            const signed = await solana.signMessage(new TextEncoder().encode(proof), 'utf8');
            const solana_signature = encodeSignature(signed.signature);

            const response = await fetch(`${API_BASE_URL}/api/solana/link`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...sessionHeaders() },
                body: JSON.stringify({
                    address: userAddress,
                    solana_address: wallet,
                    signature,
                    sig_timestamp,
                    solana_signature,
                    solana_sig_timestamp,
                }),
            });
            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new Error(body.detail ?? tri('The sequencer refused the link.',
                    'O sequenciador recusou o vínculo.', 'El secuenciador rechazó el vínculo.'));
            }
            await loadLinkAndProofs();
        } catch (e) {
            setError(e instanceof Error ? e.message : tri('Could not link the wallet.',
                'Não foi possível vincular a carteira.', 'No fue posible vincular la billetera.'));
        } finally {
            setBusy(null);
        }
    };

    // The user signs a withdrawal the sequencer built and pays for. Their own
    // balance is never touched — that is the whole point of the relayer.
    const withdraw = async (batchId: number) => {
        const solana = solanaProvider();
        if (!solana || !userAddress) return;
        setError(null);
        setBusy(`claim-${batchId}`);
        try {
            // The button is enabled by `linked`, which the sequencer knows and
            // this browser does not: a reload clears the wallet connection but
            // not the link, and once a wallet is linked this screen stops
            // offering a connect button. Without this, every visit after the
            // linking one asked the wallet to sign having never connected.
            const signer = await connectedSigner(solana, wallet);
            if (signer !== wallet) setWallet(signer);
            // claim_reward derives the leaf from whoever signs. A different
            // account in Phantom therefore does not pay the wrong wallet — the
            // program rejects it, after the user has already approved and the
            // relayer has already paid the fee. Saying it here costs nothing.
            if (linked && signer !== linked) {
                throw new Error(
                    `The wallet is on ${short(signer)}, but this reward belongs to ` +
                    `${short(linked)}. Switch account in your wallet and try again.`
                );
            }

            const prepared = await fetch(`${API_BASE_URL}/api/solana/relay/prepare`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address: userAddress, batch_id: batchId }),
            });
            if (!prepared.ok) {
                const body = await prepared.json().catch(() => ({}));
                throw new Error(body.detail ?? tri('The sequencer could not build the withdrawal.',
                    'O sequenciador não conseguiu montar o saque.',
                    'El secuenciador no pudo armar el retiro.'));
            }
            const { transaction } = await prepared.json();

            const decoded = Transaction.from(
                Uint8Array.from(atob(transaction), (c) => c.charCodeAt(0))
            );
            const signed = await solana.signTransaction(decoded);

            const submitted = await fetch(`${API_BASE_URL}/api/solana/relay/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: userAddress,
                    batch_id: batchId,
                    transaction: btoa(
                        String.fromCharCode(...signed.serialize({ requireAllSignatures: false }))
                    ),
                }),
            });
            if (!submitted.ok) {
                const body = await submitted.json().catch(() => ({}));
                throw new Error(body.detail ?? tri('The withdrawal was refused.', 'O saque foi recusado.',
                    'El retiro fue rechazado.'));
            }
            const { signature } = await submitted.json();
            setSent((current) => ({ ...current, [batchId]: signature }));
        } catch (e) {
            setError(e instanceof Error ? e.message : tri('The withdrawal failed.', 'O saque falhou.',
                'El retiro falló.'));
        } finally {
            setBusy(null);
        }
    };

    if (!isConnected) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-brand-surface/20 border-2 border-dashed border-brand-border rounded-[2.5rem] text-center max-w-2xl mx-auto animate-fadeIn">
                <div className="w-20 h-20 bg-brand-primary/10 rounded-full flex items-center justify-center mb-6">
                    <CubeIcon className="w-10 h-10 text-brand-primary opacity-50" />
                </div>
                <h2 className="text-2xl font-black uppercase tracking-tighter settle-text">Solana Payouts</h2>
                <p className="text-brand-muted mt-4 leading-relaxed">
                    {tri(
                        'Sign in to FaucetChain first. Your rewards are paid from a campaign vault on Solana, and the account that earned them is the one that links the wallet.',
                        'Entre na FaucetChain primeiro. Suas recompensas são pagas de um cofre de campanha na Solana, e a conta que as ganhou é a que vincula a carteira.',
                        'Inicie sesión en FaucetChain primero. Sus recompensas se pagan desde una bóveda de campaña en Solana, y la cuenta que las ganó es la que vincula la billetera.')}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fadeIn">
            <div className="bg-brand-surface border border-brand-border/50 p-8 rounded-[2.5rem] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-sol-purple/10 rounded-full -mr-40 -mt-40 blur-3xl"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-sol-green/10 rounded-full -ml-32 -mb-32 blur-3xl"></div>
                <div className="relative">
                    <h2 className="text-2xl font-black uppercase tracking-tighter settle-text">Solana Payouts</h2>
                    <p className="text-brand-muted mt-3 max-w-2xl leading-relaxed">
                        {tri(
                            'Rewards are held in a campaign vault on Solana and released against a Merkle root the sequencer publishes on-chain. You withdraw by proving your leaf is in that root — and you pay nothing: the fee and the account rent are covered by the relayer.',
                            'As recompensas ficam num cofre de campanha na Solana e são liberadas contra uma raiz Merkle que o sequenciador publica na cadeia. Você saca provando que o seu leaf está nessa raiz — e não paga nada: a taxa e o aluguel da conta saem do relayer.',
                            'Las recompensas quedan en una bóveda de campaña en Solana y se liberan contra una raíz Merkle que el secuenciador publica en la cadena. Usted retira probando que su hoja está en esa raíz — y no paga nada: la comisión y el alquiler de la cuenta los cubre el relayer.')}
                    </p>
                </div>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-6 py-4 rounded-2xl text-sm">
                    {error}
                </div>
            )}

            <SectionCard title={tri('Receiving wallet', 'Carteira que recebe', 'Billetera que recibe')}
                         icon={<ShieldCheckIcon className="w-6 h-6" />}>
                {linked ? (
                    <p className="text-brand-muted">
                        {tri('Payouts go to', 'Os pagamentos vão para', 'Los pagos van a')}{' '}
                        <span className="font-mono text-white">{linked}</span>.{' '}
                        {tri(
                            'A root already published keeps paying this wallet even if you link another one later.',
                            'Uma raiz já publicada continua pagando esta carteira mesmo que você vincule outra depois.',
                            'Una raíz ya publicada sigue pagando a esta billetera aunque usted vincule otra después.')}
                    </p>
                ) : (
                    <div className="space-y-4">
                        <p className="text-brand-muted">
                            {tri(
                                'No wallet linked yet. Connect the one that should receive the tokens. You will be asked to sign twice: once with your FaucetChain account, to say this is the wallet you chose, and once with the wallet itself, to prove you hold its key. A reward already published on-chain pays the address on the leaf, so a wallet typed wrong cannot be corrected afterwards.',
                                'Nenhuma carteira vinculada ainda. Conecte a que deve receber os tokens. Você vai assinar duas vezes: uma com a sua conta FaucetChain, para dizer que é esta a carteira escolhida, e outra com a própria carteira, para provar que a chave é sua. Uma recompensa já publicada na cadeia paga o endereço que está no leaf, então carteira digitada errada não tem conserto depois.',
                                'Ninguna billetera vinculada todavía. Conecte la que debe recibir los tokens. Va a firmar dos veces: una con su cuenta FaucetChain, para decir que es esta la billetera elegida, y otra con la billetera misma, para probar que la clave es suya. Una recompensa ya publicada en la cadena paga la dirección que está en la hoja, así que una billetera mal escrita no tiene arreglo después.')}
                        </p>
                        <div className="flex flex-wrap gap-3 items-center">
                            <button
                                onClick={connectWallet}
                                disabled={busy !== null}
                                className="px-6 py-3 bg-brand-primary/10 border border-brand-primary/40 text-brand-primary rounded-2xl font-bold uppercase text-sm tracking-wide hover:bg-brand-primary/20 disabled:opacity-40"
                            >
                                {busy === 'connect'
                                    ? tri('Connecting…', 'Conectando…', 'Conectando…')
                                    : wallet
                                        ? `${tri('Connected', 'Conectada', 'Conectada')} ${short(wallet)}`
                                        : tri('Connect wallet', 'Conectar carteira', 'Conectar billetera')}
                            </button>
                            {wallet && (
                                <button
                                    onClick={linkWallet}
                                    disabled={busy !== null}
                                    className="px-6 py-3 bg-brand-primary text-black rounded-2xl font-bold uppercase text-sm tracking-wide hover:opacity-90 disabled:opacity-40"
                                >
                                    {busy === 'link'
                                        ? tri('Signing…', 'Assinando…', 'Firmando…')
                                        : tri('Link this wallet', 'Vincular esta carteira',
                                              'Vincular esta billetera')}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </SectionCard>

            <SectionCard title={tri('Rewards waiting', 'Recompensas esperando', 'Recompensas esperando')}
                         icon={<CubeIcon className="w-6 h-6" />}>
                {proofs.length === 0 ? (
                    <p className="text-brand-muted">
                        {tri(
                            'Nothing to withdraw yet. A reward appears here once the sequencer closes the batch it belongs to and publishes its root on Solana.',
                            'Nada para sacar ainda. Uma recompensa aparece aqui quando o sequenciador fecha o lote a que ela pertence e publica a raiz dele na Solana.',
                            'Nada para retirar todavía. Una recompensa aparece aquí cuando el secuenciador cierra el lote al que pertenece y publica su raíz en Solana.')}
                    </p>
                ) : (
                    <div className="space-y-4">
                        {proofs.map((item) => (
                            <div
                                key={item.batch_id}
                                className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-brand-bg/40 border border-brand-border/40 rounded-2xl px-6 py-5"
                            >
                                <div className="min-w-0">
                                    <p className="text-white font-bold">
                                        {tri('Campaign', 'Campanha', 'Campaña')} {item.campaign_id} ·{' '}
                                        {tri('batch', 'lote', 'lote')} {item.batch_id}
                                    </p>
                                    <p className="text-brand-muted text-sm mt-1 font-mono break-all">
                                        {tri('root', 'raiz', 'raíz')} {short(item.root)} ·{' '}
                                        {tri('leaf', 'leaf', 'hoja')} {item.leaf_index} ·{' '}
                                        {item.proof.length}{' '}
                                        {item.proof.length === 1
                                            ? tri('sibling', 'irmão', 'hermano')
                                            : tri('siblings', 'irmãos', 'hermanos')}
                                    </p>
                                    {item.published_signature && (
                                        <a
                                            href={explorerUrl(item.published_signature)}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1 text-brand-primary text-sm mt-2 hover:underline"
                                        >
                                            {tri('Root on Solana', 'Raiz na Solana', 'Raíz en Solana')}{' '}
                                            <ArrowUpRightIcon className="w-3 h-3" />
                                        </a>
                                    )}
                                </div>
                                <div className="flex items-center gap-4 flex-none">
                                    <span className="text-2xl font-black text-white tabular-nums">
                                        {(item.amount / 1_000_000).toFixed(2)}
                                    </span>
                                    {sent[item.batch_id] || item.claimed ? (
                                        sent[item.batch_id] ? (
                                            <a
                                                href={explorerUrl(sent[item.batch_id])}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="px-5 py-2.5 border border-green-500/40 text-green-300 rounded-xl text-sm font-bold uppercase tracking-wide hover:bg-green-500/10"
                                            >
                                                {tri('Withdrawn', 'Sacado', 'Retirado')}
                                            </a>
                                        ) : (
                                            <span className="px-5 py-2.5 border border-green-500/40 text-green-300 rounded-xl text-sm font-bold uppercase tracking-wide">
                                                {tri('Withdrawn', 'Sacado', 'Retirado')}
                                            </span>
                                        )
                                    ) : (
                                        <button
                                            onClick={() => withdraw(item.batch_id)}
                                            disabled={busy !== null || !linked}
                                            className="px-5 py-2.5 bg-brand-primary text-black rounded-xl text-sm font-bold uppercase tracking-wide hover:opacity-90 disabled:opacity-40 flex items-center gap-2"
                                        >
                                            {busy === `claim-${item.batch_id}` && (
                                                <LoadingIcon className="w-4 h-4 animate-spin" />
                                            )}
                                            {tri('Withdraw', 'Sacar', 'Retirar')}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </SectionCard>
        </div>
    );
};
