
import React from 'react';
import { CodeSection } from '../types';
import { ANCHOR_CODE, PYTHON_CODE } from '../constants';
import { CodeBlock } from './CodeBlock';
import { useLanguage } from './LanguageContext';

interface CodeViewerProps {
    section: CodeSection;
}

export const CodeViewer: React.FC<CodeViewerProps> = ({ section }) => {
    const { tri } = useLanguage();

    if (section === 'Smart Contract') {
        return (
            <div>
                <h2 className="text-2xl font-bold text-brand-secondary mb-4">
                    {tri('The Settlement Program on Solana', 'O programa de liquidação na Solana',
                         'El programa de liquidación en Solana')}
                </h2>
                <p className="text-brand-muted mb-6">
                    {tri('This is the program that holds every partner budget, at',
                         'Este é o programa que guarda o orçamento de cada parceiro, em',
                         'Este es el programa que guarda el presupuesto de cada socio, en')}{' '}
                    <code className="text-brand-primary text-xs">64LW8DZcrttzaZ5RTTxAytfCGdb3QvDeTq5pUY7WBqSm</code>.
                    {tri(
                        'The appchain keeps doing the distributing; this holds what needs a public guarantee. A root is only accepted if the vault already covers everything promised, and a reward is only paid against an inclusion proof — so partner funds never cross a bridge, they enter here and leave here.',
                        'A appchain continua fazendo a distribuição; isto guarda o que precisa de garantia pública. Uma raiz só é aceita se o cofre já cobre tudo o que foi prometido, e uma recompensa só é paga contra prova de inclusão — então dinheiro de parceiro nunca atravessa ponte, ele entra aqui e sai daqui.',
                        'La appchain sigue haciendo la distribución; esto guarda lo que necesita garantía pública. Una raíz solo se acepta si la bóveda ya cubre todo lo prometido, y una recompensa solo se paga contra prueba de inclusión — así que el dinero de socio nunca cruza un puente, entra aquí y sale de aquí.')}
                </p>
                <CodeBlock code={ANCHOR_CODE} language="rust" title="programs/faucetchain/src/lib.rs" />
            </div>
        );
    }

    if (section === 'AI Module') {
        return (
            <div>
                <h2 className="text-2xl font-bold text-brand-secondary mb-4">
                    {tri('Sentinel: the cadence check',
                         'Sentinel: a checagem de ritmo',
                         'Sentinel: la verificación de ritmo')}
                </h2>
                <p className="text-brand-muted mb-6">
                    {tri(
                        'There is no machine learning here. Before a merit claim is accepted, the server reads that wallet’s last twenty claims and refuses the new one if two of them came less than a minute apart, which the one-hour cooldown should make impossible. The limits that actually stop farming are arithmetic: the hourly quota, the per-IP wallet cap and the puzzle in the browser.',
                        'Não há aprendizado de máquina aqui. Antes de aceitar um claim de mérito, o servidor lê os últimos vinte claims daquela carteira e recusa o novo se dois deles vieram com menos de um minuto de diferença, o que o intervalo de uma hora deveria impedir. Os limites que de fato seguram o farm são aritméticos: a cota por hora, o teto de carteiras por IP e o desafio no navegador.',
                        'Aquí no hay aprendizaje automático. Antes de aceptar un claim de mérito, el servidor lee los últimos veinte claims de esa billetera y rechaza el nuevo si dos de ellos llegaron con menos de un minuto de diferencia, algo que el intervalo de una hora debería impedir. Los límites que de verdad frenan el farmeo son aritméticos: la cuota por hora, el tope de billeteras por IP y el desafío en el navegador.')}
                </p>
                <CodeBlock code={PYTHON_CODE} language="python" title="FraudAndBonusDetector.py" />
            </div>
        );
    }

    return null;
};
