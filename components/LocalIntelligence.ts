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
        //
        // Tres defeitos deixavam o chat responder a pergunta errada:
        //  - a mensagem anterior, inclusive a resposta do proprio chat, entrava
        //    na busca junto com a pergunta; a saudacao fala em "faucet", e
        //    "how does settlement work?" caia na resposta da torneira;
        //  - a nota era a FRACAO de palavras-chave casadas, entao uma entrada
        //    com muitas palavras perdia para uma com poucas;
        //  - `includes` casava pedaco de palavra: "bot" dentro de "both".
        // Agora a pergunta decide sozinha, conta quantas palavras bateram (a
        // mais longa desempata) e so olha o contexto se nada bateu.
        const casa = (texto: string, k: string) =>
            new RegExp(`(^|[^\\p{L}\\p{N}])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}\\p{N}])`, 'u').test(texto);
        const melhor = (texto: string) => {
            let achado: { pattern: IntentPattern; confidence: number; score: number } | null = null;
            for (const pattern of KNOWLEDGE_BASE) {
                const batidas = pattern.keywords.filter(k => casa(texto, k));
                if (!batidas.length) continue;
                const score = batidas.length * 1000 + Math.max(...batidas.map(k => k.length));
                if (!achado || score > achado.score) {
                    achado = { pattern, score, confidence: Math.min(1, 0.4 + 0.2 * (batidas.length - 1)) };
                }
            }
            return achado;
        };
        const best = melhor(normalizedInput) ?? (contextText ? melhor(searchText) : null);

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

    // tps e avgGasPrice sao null ate a primeira medicao (NetworkContext), e
    // .toFixed em null derrubava TODA pergunta ao chat, nao so as que citam
    // esses numeros: o template e montado antes de saber se usa a variavel.
    private static injectVariables(template: string, metrics: NetworkMetrics): string {
        const fixo = (v: number | null | undefined, casas: number) =>
            v === null || v === undefined ? '—' : v.toFixed(casas);
        return template
            .replace('{{blockHeight}}', String(metrics.blockHeight ?? '—'))
            .replace('{{tps}}', fixo(metrics.tps, 1))
            .replace('{{gasPrice}}', fixo(metrics.avgGasPrice, 2))
            .replace('{{activeValidators}}', String(metrics.activeValidators ?? '—'));
    }
}
