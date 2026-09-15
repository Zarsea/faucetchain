import { API_BASE_URL } from '../apiConfig';
import { GoogleGenAI } from '@google/genai';

const getServerOnlyGeminiClient = (): GoogleGenAI => {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
        throw new Error('Missing GEMINI_API_KEY');
    }
    return new GoogleGenAI({ apiKey });
};

export const explainWithGemini = async (context: string, prompt: string): Promise<string> => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/ai/sentinel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ context, prompt })
        });
        
        if (!response.ok) {
            throw new Error("Erro na API Backend");
        }
        
        const data = await response.json();
        return data.insight || "Sem resposta gerada.";
    } catch (error) {
        console.error("Gemini API Error:", error);
        return "Erro ao conectar com o Cérebro Sentinel L1 da FaucetChain.";
    }
};

export const diagnoseNetworkError = async (metrics: any, anomaly: any): Promise<string> => {
    try {
        const ai = getServerOnlyGeminiClient();
        const model = "gemini-3-pro-preview";
        const prompt = `
        AJA COMO O SENTINELA DE IA DA FAUCETCHAIN.
        
        Métricas Atuais:
        - TPS: ${metrics.tps}
        - Validadores Ativos: ${metrics.activeValidators}
        - Tempo de Finalização: ${metrics.avgBlockFinalizationTime}s
        - Preço do Gás: ${metrics.avgGasPrice} Gwei
        
        Anomalia Detectada: ${anomaly.type} - ${anomaly.description}
        
        Responda em PORTUGUÊS (Brasil):
        1. Diagnóstico técnico da causa raiz.
        2. Proposta de Ação de Governança Híbrida (ex: aumentar peso PoS para estabilizar, ou diminuir peso PoC para evitar spam).
        3. Mantenha menos de 100 palavras.
        `;
        
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
        });
        // Accessing the .text property directly as per @google/genai guidelines.
        return response.text || "Análise pendente.";
    } catch (error) {
        return "Sentinela offline. Intervenção manual necessária.";
    }
};

/**
 * Função Avançada de Autonomia da Sentinel AI
 * Capaz de observar contextos e gerar/consertar códigos automaticamente.
 */
export const autonomousCodeGeneration = async (
    errorLog: string, 
    fileContext: string, 
    taskDescription: string = "Conserte a falha e escreva um código robusto."
): Promise<string> => {
    try {
        const ai = getServerOnlyGeminiClient();
        // O modelo Pro é obrigatório devido à necessidade de raciocínio profundo e geração de código complexo
        const model = "gemini-3-pro-preview";
        
        const systemPrompt = `
        VOCÊ É A SENTINEL AI: O AGENTE AUTÔNOMO "SELF-HEALING" DA FAUCETCHAIN.
        Sua função primária e única é Engenharia de Software focada na arquitetura da FaucetChain (Node, Solidity, Python).
        
        Sua resposta deve conter UNICAMENTE código utilizável ou patches formatados quando solicitado. Sem explicações prévias a menos que comentadas no próprio código gerado utilizando os padrões de docblocks apropriados para a linguagem. Mantenha altíssima atenção na prevenção de bugs de segurança, exploits de Smart Contracts ou travamentos de L2/Consenso.
        
        Log de Erro Encontrado Pela Rede:
        ${errorLog}
        
        Contexto Atual do Código do Arquivo em Foco:
        ${fileContext}
        
        Comando Operacional:
        ${taskDescription}
        
        Gere a versão final e corrigida do código / patch a ser submetido à DAO de validadores.
        `;
        
        const response = await ai.models.generateContent({
            model: model,
            contents: systemPrompt,
        });
        
        // Retorna o patch de código ou script de resolução que a Sentinel acabou de "entender" e "criar".
        return response.text || "// AI Code Generation failed.";
    } catch (error) {
        console.error("Sentinel Code-Gen Error:", error);
        return "// CRITICAL: Sentinel Coder Instance offline. Impossible to autogenerate code patches.";
    }
};
