
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
                    {tri('AI Module for Fraud Detection & Bonus Calculation',
                         'Módulo de IA para detecção de fraude e cálculo de bônus',
                         'Módulo de IA para detección de fraude y cálculo de bono')}
                </h2>
                <p className="text-brand-muted mb-6">
                    {tri(
                        'This Python module uses machine learning to enhance the consensus mechanism. It detects anomalous patterns indicative of claim farming and calculates an activity bonus for validators participating in the DeFi ecosystem.',
                        'Este módulo em Python usa aprendizado de máquina para reforçar o mecanismo de consenso. Ele detecta padrões anômalos típicos de farm de claims e calcula um bônus de atividade para validadores que participam do ecossistema DeFi.',
                        'Este módulo en Python usa aprendizaje automático para reforzar el mecanismo de consenso. Detecta patrones anómalos típicos del farmeo de claims y calcula un bono de actividad para validadores que participan del ecosistema DeFi.')}
                </p>
                <CodeBlock code={PYTHON_CODE} language="python" title="FraudAndBonusDetector.py" />
            </div>
        );
    }

    return null;
};
