
import React from 'react';
import { CodeSection } from '../types';
import { ANCHOR_CODE, PYTHON_CODE } from '../constants';
import { CodeBlock } from './CodeBlock';

interface CodeViewerProps {
    section: CodeSection;
}

export const CodeViewer: React.FC<CodeViewerProps> = ({ section }) => {
    if (section === 'Smart Contract') {
        return (
            <div>
                <h2 className="text-2xl font-bold text-brand-secondary mb-4">The Settlement Program on Solana</h2>
                <p className="text-brand-muted mb-6">
                    This is the program that holds every partner budget, at{' '}
                    <code className="text-brand-primary text-xs">64LW8DZcrttzaZ5RTTxAytfCGdb3QvDeTq5pUY7WBqSm</code>.
                    The appchain keeps doing the distributing; this holds what needs a public
                    guarantee. A root is only accepted if the vault already covers everything
                    promised, and a reward is only paid against an inclusion proof — so partner
                    funds never cross a bridge, they enter here and leave here.
                </p>
                <CodeBlock code={ANCHOR_CODE} language="rust" title="programs/faucetchain/src/lib.rs" />
            </div>
        );
    }

    if (section === 'AI Module') {
        return (
            <div>
                <h2 className="text-2xl font-bold text-brand-secondary mb-4">AI Module for Fraud Detection & Bonus Calculation</h2>
                <p className="text-brand-muted mb-6">
                    This Python module uses machine learning to enhance the consensus mechanism. It detects anomalous patterns indicative of claim farming and calculates an activity bonus for validators participating in the DeFi ecosystem.
                </p>
                <CodeBlock code={PYTHON_CODE} language="python" title="FraudAndBonusDetector.py" />
            </div>
        );
    }

    return null;
};
