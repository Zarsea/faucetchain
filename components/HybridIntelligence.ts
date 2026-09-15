/**
 * Integration Example: LocalIntelligence + Vector Database
 * =========================================================
 * Shows how to combine keyword matching with semantic search.
 */

import { LocalIntelligence } from './LocalIntelligence';
import { KNOWLEDGE_BASE } from './KnowledgeBase';

interface NetworkMetrics {
    blockHeight: number;
    tps: number;
    avgGasPrice: number;
    activeValidators: number;
}

export class HybridIntelligence {
    /**
     * Hybrid approach: Try local KB first, fallback to Vector DB
     */
    static async processQuery(input: string, metrics: NetworkMetrics): Promise<{ text: string, action?: string, source: string }> {

        // STEP 1: Try local Knowledge Base (fast, deterministic)
        const localResult = LocalIntelligence.processQuery(input, metrics);

        // Check confidence based on keyword match
        const normalizedInput = input.toLowerCase();
        const hasStrongMatch = KNOWLEDGE_BASE.some(pattern =>
            pattern.keywords.some(k => normalizedInput.includes(k))
        );

        if (hasStrongMatch) {
            return {
                ...localResult,
                source: 'LOCAL_KB'
            };
        }

        // STEP 2: Fallback to Vector Database (slower, more flexible)
        try {
            const vectorResponse = await fetch('/api/vector-search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: input,
                    top_k: 3
                })
            });

            if (!vectorResponse.ok) {
                throw new Error('Vector DB unavailable');
            }

            const results = await vectorResponse.json();

            if (results.length > 0 && results[0].score > 0.7) {
                // High confidence match from Vector DB
                const topResult = results[0];
                const synthesized = this.synthesizeResponse(topResult, metrics);

                return {
                    text: synthesized,
                    source: 'VECTOR_DB'
                };
            }

        } catch (error) {
            console.warn('Vector DB fallback failed:', error);
        }

        // STEP 3: Ultimate fallback to local result
        return {
            ...localResult,
            source: 'LOCAL_KB_FALLBACK'
        };
    }

    private static synthesizeResponse(vectorResult: any, metrics: NetworkMetrics): string {
        let response = vectorResult.content;

        // Inject live metrics
        response = response
            .replace(/\{\{blockHeight\}\}/g, metrics.blockHeight.toString())
            .replace(/\{\{tps\}\}/g, metrics.tps.toFixed(1))
            .replace(/\{\{gasPrice\}\}/g, metrics.avgGasPrice.toFixed(2))
            .replace(/\{\{activeValidators\}\}/g, metrics.activeValidators.toString());

        // Add source attribution
        const category = vectorResult.metadata?.category || 'general';
        response += `\n\n[Source: ${category} documentation | Confidence: ${(vectorResult.score * 100).toFixed(0)}%]`;

        return response;
    }
}

// Example usage in AIChatAgent.tsx:
/*
import { HybridIntelligence } from './HybridIntelligence';

const handleSendMessage = async (userMsg: string) => {
    const result = await HybridIntelligence.processQuery(userMsg, metrics);

    console.log(`Answer source: ${result.source}`);
    setMessages(prev => [...prev, {
        id: Date.now().toString(),
        text: result.text,
        sender: 'ai',
        timestamp: Date.now()
    }]);
};
*/
