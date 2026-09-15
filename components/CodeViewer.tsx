
import React from 'react';
import { CodeSection } from '../types';
import { SOLIDITY_CODE, PYTHON_CODE } from '../constants';
import { CodeBlock } from './CodeBlock';

interface CodeViewerProps {
    section: CodeSection;
}

export const CodeViewer: React.FC<CodeViewerProps> = ({ section }) => {
    if (section === 'Smart Contract') {
        return (
            <div>
                <h2 className="text-2xl font-bold text-brand-secondary mb-4">Hybrid PoC+PoS Smart Contract</h2>
                <p className="text-brand-muted mb-6">
                    This Solidity smart contract outlines the core on-chain logic for managing validators, submitting claims with stakes, calculating hybrid weights, and applying unified slashing.
                </p>
                <CodeBlock code={SOLIDITY_CODE} language="solidity" title="HybridPoCPoS.sol" />
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
