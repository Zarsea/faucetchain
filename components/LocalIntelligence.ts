import { KNOWLEDGE_BASE, IntentPattern } from './KnowledgeBase';

interface NetworkMetrics {
    blockHeight: number;
    tps: number;
    avgGasPrice: number;
    activeValidators: number;
}

export interface ProcessQueryContext {
    lastUserMessage?: string;
    lastAiMessage?: string;
}

export interface ProcessQueryResult {
    text: string;
    action?: string;
    confidence: number;
    patternId: string;
    actionPayload?: { anomalyType?: 'CONGESTION' | 'VALIDATOR_DROP'; amount?: number };
}

export class LocalIntelligence {

    /**
     * Processes user input and returns a structured response with optional actions.
     * confidence: 0-1; 0 = fallback to help, 1 = strong match (e.g. regex).
     */
    static processQuery(
        input: string,
        metrics: NetworkMetrics,
        context?: ProcessQueryContext
    ): ProcessQueryResult {
        const normalizedInput = input.toLowerCase();
        const contextText = [context?.lastUserMessage, context?.lastAiMessage]
            .filter(Boolean)
            .map(s => s!.toLowerCase())
            .join(' ');
        const searchText = normalizedInput + ' ' + contextText;

        // Detect language based on Portuguese keywords
        const portugueseKeywords = ['qual', 'como', 'onde', 'quando', 'porque', 'o que', 'é', 'são', 'está', 'estão', 'tem', 'pode', 'minta', 'explique', 'mostre'];
        const isPortuguese = portugueseKeywords.some(keyword => normalizedInput.includes(keyword));

        // 1. Find Matching Intent and compute confidence
        let best: { pattern: IntentPattern; confidence: number } | null = null;

        for (const pattern of KNOWLEDGE_BASE) {
            let confidence = 0;
            if (pattern.regex && pattern.regex.test(normalizedInput)) {
                confidence = 1;
            } else {
                const matchingKeywords = pattern.keywords.filter(k => searchText.includes(k));
                if (matchingKeywords.length > 0) {
                    confidence = Math.min(1, 0.3 + (matchingKeywords.length / pattern.keywords.length) * 0.7);
                }
            }
            if (confidence > 0 && (!best || confidence > best.confidence)) {
                best = { pattern, confidence };
            }
        }

        const pattern = best?.pattern ?? KNOWLEDGE_BASE.find(p => p.id === 'help')!;
        const confidence = best?.confidence ?? 0;

        // 3. Pick response based on detected language
        let template: string;
        if (pattern.response.length > 1) {
            template = isPortuguese ? pattern.response[1] : pattern.response[0];
        } else {
            template = pattern.response[0];
        }

        const responseText = this.injectVariables(template, metrics);

        const actionPayload = this.buildActionPayload(pattern, normalizedInput);

        return {
            text: responseText,
            action: pattern.action,
            confidence,
            patternId: pattern.id,
            actionPayload
        };
    }

    private static buildActionPayload(pattern: IntentPattern, normalizedInput: string): ProcessQueryResult['actionPayload'] | undefined {
        if (pattern.action === 'TRIGGER_ANOMALY') {
            const validatorDropKeywords = ['validator drop', 'queda de validadores', 'validadores caíram', 'validator_drop'];
            const anomalyType = validatorDropKeywords.some(k => normalizedInput.includes(k)) ? 'VALIDATOR_DROP' as const : 'CONGESTION' as const;
            return { anomalyType };
        }
        if (pattern.action === 'MINT_TOKENS') {
            const amountMatch = normalizedInput.match(/\d+/);
            const amount = amountMatch ? parseInt(amountMatch[0], 10) : undefined;
            return amount !== undefined ? { amount } : undefined;
        }
        return undefined;
    }

    private static injectVariables(template: string, metrics: NetworkMetrics): string {
        return template
            .replace('{{blockHeight}}', metrics.blockHeight.toString())
            .replace('{{tps}}', metrics.tps.toFixed(1))
            .replace('{{gasPrice}}', metrics.avgGasPrice.toFixed(2))
            .replace('{{activeValidators}}', metrics.activeValidators.toString());
    }
}
