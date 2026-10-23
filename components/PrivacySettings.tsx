import React, { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from '../apiConfig';
import { useAuth, sessionHeaders } from './AuthContext';
import { useLanguage } from './LanguageContext';
import { ShieldCheckIcon, GlobeAltIcon, WalletIcon, XMarkIcon } from './IconComponents';

/**
 * Privacidade da conta: o que esta ligado a ela, e o que isso expoe.
 *
 * Existe como tela propria porque vincular o Google e uma escolha, nao um
 * passo de fluxo. Um botao "entrar com Google" solto numa tela qualquer pede
 * a decisao no meio de outra coisa, quando a pessoa nao esta pensando no
 * assunto -- e consentimento pedido assim nao e consentimento, e distracao.
 *
 * A regra que governa o texto daqui: dizer o que acontece ANTES do clique.
 * Depois do clique, qualquer explicacao e desculpa.
 */

interface Identidades {
    address: string;
    sign_in_methods: string[];
    google: { linked: boolean; linked_at: number | null; can_unlink: boolean };
}

const nomeDaPorta = (tri: (en: string, pt: string, es?: string) => string): Record<string, string> => ({
    password: tri('Email and password', 'E-mail e senha', 'Correo y contraseña'),
    wallet: tri('Solana wallet', 'Carteira Solana', 'Billetera Solana'),
    google: 'Google',
    telegram: 'Telegram',
});

const Linha: React.FC<{
    icone: React.ReactNode; titulo: string; estado: string; children?: React.ReactNode;
}> = ({ icone, titulo, estado, children }) => (
    <div className="p-5 bg-brand-card/40 border border-brand-border rounded-2xl">
        <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-brand-bg/60 border border-brand-border flex items-center justify-center text-brand-primary">
                {icone}
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h3 className="font-bold text-brand-secondary">{titulo}</h3>
                    <span className="text-[10px] font-black uppercase tracking-[0.14em] text-brand-muted">
                        {estado}
                    </span>
                </div>
                {children}
            </div>
        </div>
    </div>
);

export const PrivacySettings: React.FC = () => {
    const { tri, locale } = useLanguage();
    const { isConnected, userAddress } = useAuth();
    const [dados, setDados] = useState<Identidades | null>(null);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState('');
    const [aviso, setAviso] = useState('');
    const [confirmando, setConfirmando] = useState(false);
    const [vinculando, setVinculando] = useState(false);

    const buscar = useCallback(async () => {
        try {
            const r = await fetch(`${API_BASE_URL}/api/account/identities`,
                { headers: { ...sessionHeaders() } });
            if (!r.ok) throw new Error(String(r.status));
            setDados(await r.json());
            setErro('');
        } catch {
            setDados(null);
            setErro(tri('Could not read your account settings. Try again in a moment.',
                        'Não foi possível ler as configurações da sua conta. Tente de novo daqui a pouco.',
                        'No fue posible leer la configuración de su cuenta. Inténtelo de nuevo en un momento.'));
        } finally {
            setCarregando(false);
        }
    }, []);

    useEffect(() => { if (isConnected) buscar(); else setCarregando(false); }, [isConnected, buscar]);

    // A volta do vinculo chega no fragmento, como a do login. Lida uma vez e
    // apagada da barra na mesma batida.
    useEffect(() => {
        if (!window.location.hash.includes('google=')) return;
        const estado = new URLSearchParams(window.location.hash.slice(1)).get('google');
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        const recados: Record<string, string> = {
            linked: tri('Google is linked to this account.',
                        'O Google está vinculado a esta conta.',
                        'Google está vinculado a esta cuenta.'),
            already_linked: tri('That Google account was already linked here.',
                        'Essa conta Google já estava vinculada aqui.',
                        'Esa cuenta de Google ya estaba vinculada aquí.'),
            taken: tri('That Google account belongs to another FaucetChain account. Sign in there and unlink it first.',
                        'Essa conta Google pertence a outra conta FaucetChain. Entre lá e desvincule primeiro.',
                        'Esa cuenta de Google pertenece a otra cuenta FaucetChain. Entre allí y desvincúlela primero.'),
            cancelled: tri('Linking cancelled. Nothing changed.',
                        'Vínculo cancelado. Nada mudou.',
                        'Vínculo cancelado. Nada cambió.'),
            expired: tri('That took too long. Start again.',
                        'Demorou demais. Comece de novo.',
                        'Tardó demasiado. Empiece de nuevo.'),
            failed: tri('Google did not confirm it. Nothing changed.',
                        'O Google não confirmou. Nada mudou.',
                        'Google no lo confirmó. Nada cambió.'),
        };
        if (estado && recados[estado]) setAviso(recados[estado]);
        buscar();
    }, [buscar]);

    // Pede o endereco do Google levando a sessao, e so entao navega.
    //
    // O cabecalho e o ponto inteiro: vincular precisa provar de qual conta se
    // trata, e nenhuma navegacao de pagina carrega cabecalho. Por isso a
    // chamada vem antes da ida.
    const vincular = async () => {
        setErro('');
        setVinculando(true);
        try {
            const r = await fetch(`${API_BASE_URL}/api/auth/google/start?link=1`,
                { headers: { ...sessionHeaders() } });
            const corpo = await r.json().catch(() => ({}));
            if (!r.ok || !corpo?.authorize_url) {
                throw new Error(corpo?.detail || tri('Could not start linking. Try again in a moment.',
                    'Não foi possível começar o vínculo. Tente de novo daqui a pouco.',
                    'No fue posible empezar el vínculo. Inténtelo de nuevo en un momento.'));
            }
            window.location.href = corpo.authorize_url;
        } catch (e: any) {
            setErro(e.message);
            setVinculando(false);
        }
    };

    const desvincular = async () => {
        setErro('');
        try {
            const r = await fetch(`${API_BASE_URL}/api/auth/google/link`,
                { method: 'DELETE', headers: { ...sessionHeaders() } });
            const corpo = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(corpo?.detail || `HTTP ${r.status}`);
            setAviso(tri('Google is no longer linked to this account.',
                         'O Google não está mais vinculado a esta conta.',
                         'Google ya no está vinculado a esta cuenta.'));
            setConfirmando(false);
            buscar();
        } catch (e: any) {
            setErro(e.message);
            setConfirmando(false);
        }
    };

    if (!isConnected) {
        return (
            <div className="max-w-2xl">
                <h2 className="text-3xl font-bold text-brand-secondary mb-2">
                    {tri('Privacy', 'Privacidade', 'Privacidad')}
                </h2>
                <p className="text-brand-muted">
                    {tri(
                        'Sign in to see what is linked to your account. These settings belong to one account, and there is no account here yet.',
                        'Entre para ver o que está vinculado à sua conta. Estas configurações pertencem a uma conta, e aqui ainda não há nenhuma.',
                        'Inicie sesión para ver qué está vinculado a su cuenta. Esta configuración pertenece a una cuenta, y aquí todavía no hay ninguna.')}
                </p>
            </div>
        );
    }

    return (
        <div className="max-w-2xl space-y-6">
            <div>
                <h2 className="text-3xl font-bold text-brand-secondary">
                    {tri('Privacy', 'Privacidade', 'Privacidad')}
                </h2>
                <p className="text-brand-muted mt-1">
                    {tri(
                        'What is connected to this account, and what each connection does. Nothing here is required: an account works with one way in, and the rest is your choice.',
                        'O que está conectado a esta conta, e o que cada conexão faz. Nada aqui é obrigatório: uma conta funciona com uma porta de entrada, e o resto é escolha sua.',
                        'Qué está conectado a esta cuenta, y qué hace cada conexión. Nada aquí es obligatorio: una cuenta funciona con una puerta de entrada, y el resto es decisión suya.')}
                </p>
            </div>

            {aviso && (
                <div className="p-4 rounded-xl bg-brand-primary/10 border border-brand-primary/30 text-brand-secondary text-sm">
                    {aviso}
                </div>
            )}
            {erro && (
                <div className="p-4 rounded-xl bg-brand-error/10 border border-brand-error/30 text-brand-error text-sm">
                    {erro}
                </div>
            )}

            {carregando && (
                <p className="text-brand-muted text-sm">
                    {tri('Reading your settings…', 'Lendo suas configurações…',
                         'Leyendo su configuración…')}
                </p>
            )}

            {dados && (
                <>
                    <Linha
                        icone={<ShieldCheckIcon className="w-5 h-5" />}
                        titulo={tri('This account', 'Esta conta', 'Esta cuenta')}
                        estado={dados.sign_in_methods.length === 1
                            ? `1 ${tri('way in', 'porta de entrada', 'puerta de entrada')}`
                            : `${dados.sign_in_methods.length} ${tri('ways in', 'portas de entrada', 'puertas de entrada')}`}
                    >
                        <p className="font-mono text-xs text-brand-muted mt-2 break-all">{dados.address}</p>
                        <div className="flex flex-wrap gap-2 mt-3">
                            {dados.sign_in_methods.map((m) => (
                                <span key={m} className="px-2 py-1 rounded-lg bg-brand-bg/60 border border-brand-border text-[11px] font-bold text-brand-secondary">
                                    {nomeDaPorta(tri)[m] ?? m}
                                </span>
                            ))}
                        </div>
                        {dados.sign_in_methods.length === 1 && (
                            <p className="text-brand-warn text-xs mt-3 leading-relaxed">
                                {tri(
                                    'Only one way in. Lose it and the account goes with it — there is no password reset for an account nobody holds a second key to.',
                                    'Uma porta de entrada só. Perdeu ela, perdeu a conta junto — não existe recuperação de senha para uma conta de que ninguém tem a segunda chave.',
                                    'Una sola puerta de entrada. Si la pierde, pierde la cuenta con ella — no existe recuperación de contraseña para una cuenta de la que nadie tiene la segunda llave.')}
                            </p>
                        )}
                    </Linha>

                    <Linha
                        icone={<GlobeAltIcon className="w-5 h-5" />}
                        titulo="Google"
                        estado={dados.google.linked
                            ? tri('Linked', 'Vinculado', 'Vinculado')
                            : tri('Not linked', 'Não vinculado', 'No vinculado')}
                    >
                        {/* O que a pessoa precisa saber antes de clicar, nao depois. */}
                        <ul className="text-brand-muted text-xs leading-relaxed mt-2 space-y-1.5 list-disc pl-4">
                            <li>{tri(
                                'Lets you sign in to this account with Google, on any device.',
                                'Permite entrar nesta conta com o Google, em qualquer aparelho.',
                                'Permite entrar en esta cuenta con Google, en cualquier dispositivo.')}</li>
                            <li>
                                {tri('We store the identifier Google gives us, and nothing else.',
                                     'Guardamos o identificador que o Google nos dá, e nada além disso.',
                                     'Guardamos el identificador que Google nos da, y nada más.')}{' '}
                                <strong className="text-brand-secondary">
                                    {tri('Your email address is not stored', 'Seu e-mail não é guardado',
                                         'Su correo no se guarda')}
                                </strong>{' '}
                                {tri('and never appears on this network.', 'e nunca aparece nesta rede.',
                                     'y nunca aparece en esta red.')}
                            </li>
                            <li>{tri(
                                'Nothing about it is public. No screen, no API and no export shows who is linked.',
                                'Nada disso é público. Nenhuma tela, nenhuma API e nenhuma exportação mostra quem está vinculado.',
                                'Nada de esto es público. Ninguna pantalla, ninguna API y ninguna exportación muestra quién está vinculado.')}</li>
                            <li>{tri(
                                'You can unlink it here at any time, as long as you keep another way in.',
                                'Você pode desvincular aqui quando quiser, desde que mantenha outra porta de entrada.',
                                'Puede desvincularlo aquí cuando quiera, siempre que conserve otra puerta de entrada.')}</li>
                        </ul>

                        {dados.google.linked ? (
                            <div className="mt-4">
                                {dados.google.linked_at && (
                                    <p className="text-brand-muted text-[11px] mb-3">
                                        {tri('Linked on', 'Vinculado em', 'Vinculado el')}{' '}
                                        {new Date(dados.google.linked_at * 1000).toLocaleDateString(locale)}.
                                    </p>
                                )}
                                {!dados.google.can_unlink ? (
                                    <p className="text-brand-warn text-xs leading-relaxed">
                                        {tri(
                                            'Google is the only way into this account, so it cannot be unlinked yet. Add a password or link a wallet first, and this button comes back.',
                                            'O Google é a única porta de entrada desta conta, então ainda não dá para desvincular. Adicione uma senha ou vincule uma carteira primeiro, e este botão volta.',
                                            'Google es la única puerta de entrada de esta cuenta, así que todavía no se puede desvincular. Agregue una contraseña o vincule una billetera primero, y este botón vuelve.')}
                                    </p>
                                ) : confirmando ? (
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={desvincular}
                                            className="min-h-[44px] px-4 rounded-xl bg-brand-error/15 border border-brand-error/40 text-brand-error text-sm font-bold"
                                        >
                                            {tri('Yes, unlink Google', 'Sim, desvincular o Google',
                                                 'Sí, desvincular Google')}
                                        </button>
                                        <button
                                            onClick={() => setConfirmando(false)}
                                            className="min-h-[44px] px-4 rounded-xl bg-brand-bg/60 border border-brand-border text-brand-muted text-sm font-bold"
                                        >
                                            {tri('Keep it', 'Manter', 'Mantener')}
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setConfirmando(true)}
                                        className="min-h-[44px] px-4 rounded-xl bg-brand-bg/60 border border-brand-border text-brand-secondary text-sm font-bold hover:border-brand-error/40 hover:text-brand-error transition-colors inline-flex items-center gap-2"
                                    >
                                        <XMarkIcon className="w-4 h-4" />{' '}
                                        {tri('Unlink Google', 'Desvincular o Google', 'Desvincular Google')}
                                    </button>
                                )}
                            </div>
                        ) : (
                            // Busca primeiro, navega depois.
                            //
                            // Era um <a href> direto, e nao funcionava nunca: vincular
                            // exige X-Session-Token, e navegacao de pagina nao carrega
                            // cabecalho. O servidor respondia 401 em toda tentativa.
                            //
                            // O `fetch` leva o cabecalho, o servidor devolve o endereco
                            // do Google, e a navegacao acontece aqui. Continua sendo
                            // pagina inteira e nao popup: o popup exigiria o script do
                            // Google e connect-src aberto, e e connect-src 'self' que
                            // impede um XSS de levar o token de sessao embora.
                            <button
                                onClick={vincular}
                                disabled={vinculando}
                                className="mt-4 inline-flex items-center justify-center gap-3 min-h-[48px] px-5 rounded-xl bg-brand-surface border border-brand-border text-brand-secondary text-sm font-bold hover:border-brand-primary transition-colors disabled:opacity-50"
                            >
                                <svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden="true">
                                    <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z" />
                                    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                                    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                                    <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C37 40.2 44 35 44 24c0-1.3-.1-2.6-.4-3.9z" />
                                </svg>
                                {vinculando
                                    ? tri('Opening Google…', 'Abrindo o Google…', 'Abriendo Google…')
                                    : tri('Link a Google account', 'Vincular uma conta Google',
                                          'Vincular una cuenta de Google')}
                            </button>
                        )}
                    </Linha>

                    <Linha
                        icone={<WalletIcon className="w-5 h-5" />}
                        titulo={tri('Solana wallet', 'Carteira Solana', 'Billetera Solana')}
                        estado={dados.sign_in_methods.includes('wallet')
                            ? tri('Linked', 'Vinculada', 'Vinculada')
                            : tri('Not linked', 'Não vinculada', 'No vinculada')}
                    >
                        <p className="text-brand-muted text-xs leading-relaxed mt-2">
                            {tri(
                                'A wallet is both a way in and the address campaign tokens settle to. Without one you can earn here, but a withdrawal has nowhere to land. Linking happens when you sign in with the wallet.',
                                'Uma carteira é ao mesmo tempo porta de entrada e o endereço onde os tokens de campanha liquidam. Sem ela dá para ganhar aqui, mas um saque não tem onde cair. O vínculo acontece quando você entra com a carteira.',
                                'Una billetera es a la vez puerta de entrada y la dirección donde los tokens de campaña liquidan. Sin ella se puede ganar aquí, pero un retiro no tiene dónde caer. El vínculo ocurre cuando usted entra con la billetera.')}
                        </p>
                    </Linha>

                    <p className="text-brand-muted/70 text-[11px] leading-relaxed pt-2">
                        {tri(
                            'Public testnet. Account addresses and settlement are on chain and public by design; what is on this page is not, and is not shared with the faucets connected to the network.',
                            'Testnet público. Endereços de conta e liquidação estão na cadeia e são públicos por projeto; o que está nesta página não é, e não é compartilhado com as torneiras conectadas à rede.',
                            'Testnet público. Las direcciones de cuenta y la liquidación están en la cadena y son públicas por diseño; lo que está en esta página no lo es, y no se comparte con los grifos conectados a la red.')}
                    </p>
                </>
            )}
        </div>
    );
};

export default PrivacySettings;
