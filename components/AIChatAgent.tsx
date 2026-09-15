
import React, { useState, useRef, useEffect } from 'react';
import {
    PaperAirplaneIcon,
    SparklesIcon,
    CpuChipIcon,
    BoltIcon,
    ShieldCheckIcon,
    SignalIcon,
    CubeIcon,
    LoadingIcon,
    BookOpenIcon
} from './IconComponents';
import { useNetwork } from './NetworkContext';
import { useLanguage } from './LanguageContext';
import { LocalIntelligence } from './LocalIntelligence';
import { explainWithGemini } from '../services/geminiService';
import { API_BASE_URL } from '../apiConfig';

const CONFIDENCE_THRESHOLD = 0.3;

const SUGGESTIONS_BY_PATTERN: Record<string, { en: string[]; pt: string[] }> = {
    identity: { en: ['What is the network status?', 'Explain consensus'], pt: ['Qual o status da rede?', 'Explique o consenso'] },
    status: { en: ['Explain PoC consensus', 'Mint test tokens'], pt: ['Explique o consenso PoC', 'Mintar tokens de teste'] },
    consensus_explain: { en: ['Network status', 'Trigger stress test'], pt: ['Status da rede', 'Simular estresse'] },
    faucet_request: { en: ['Network status', 'Explain tokenomics'], pt: ['Status da rede', 'Explicar tokenomics'] },
    stress_test: { en: ['Network status', 'Explain security'], pt: ['Status da rede', 'Explicar segurança'] },
    help: { en: ['Network status', 'Explain consensus', 'Mint tokens'], pt: ['Status da rede', 'Explicar consenso', 'Mintar tokens'] }
};

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'ai';
    timestamp: number;
    isTyping?: boolean;
    source?: 'local' | 'cloud';
    patternId?: string;
}

export const AIChatAgent: React.FC = () => {
    const { metrics, addBlockManually, triggerAnomaly, anomaly } = useNetwork();
    const { lang } = useLanguage();
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            text: lang === 'pt'
                ? "Olá. Eu sou o Sentinel AI (Local V3.0). Minha rede neural opera diretamente no seu nó, sem depender de APIs externas. Como posso ajudar com sua infraestrutura hoje?"
                : "Hello. I am Sentinel AI (Local V3.0). My neural network operates directly on your node, independent of external APIs. How can I assist with your infrastructure today?",
            sender: 'ai',
            timestamp: Date.now(),
            source: 'local',
            patternId: 'identity'
        }
    ]);
    const [inputText, setInputText] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const lastAnomalyIdRef = useRef<number | null>(null);
    const lastAnomalyFollowUpRef = useRef<number | null>(null);
    const lastMetricsAlertRef = useRef<number>(0);

    const METRICS_ALERT_COOLDOWN_MS = 60000;
    const TPS_LOW_THRESHOLD = 2;
    const GAS_HIGH_THRESHOLD = 50;

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isThinking]);

    // Autonomia: alertas por thresholds de métricas (evita spam com cooldown)
    useEffect(() => {
        const now = Date.now();
        if (now - lastMetricsAlertRef.current < METRICS_ALERT_COOLDOWN_MS) return;

        const tpsLow = metrics.tps < TPS_LOW_THRESHOLD && metrics.blockHeight > 0;
        const gasHigh = metrics.avgGasPrice > GAS_HIGH_THRESHOLD;
        if (!tpsLow && !gasHigh) return;

        lastMetricsAlertRef.current = now;
        const textPt = tpsLow && gasHigh
            ? `Sentinela: TPS baixo (${metrics.tps.toFixed(1)}) e gás alto (${metrics.avgGasPrice.toFixed(0)} gwei) detectados. Pode indicar pouca atividade ou congestionamento.`
            : tpsLow
                ? `Sentinela: TPS baixo detectado (${metrics.tps.toFixed(1)}). Pode indicar pouca atividade ou nós lentos.`
                : `Sentinela: Gás alto detectado (${metrics.avgGasPrice.toFixed(0)} gwei). Possível congestionamento na rede.`;
        const textEn = tpsLow && gasHigh
            ? `Sentinel: Low TPS (${metrics.tps.toFixed(1)}) and high gas (${metrics.avgGasPrice.toFixed(0)} gwei) detected. May indicate low activity or congestion.`
            : tpsLow
                ? `Sentinel: Low TPS detected (${metrics.tps.toFixed(1)}). May indicate low activity or slow nodes.`
                : `Sentinel: High gas detected (${metrics.avgGasPrice.toFixed(0)} gwei). Possible network congestion.`;

        const aiMsg: Message = {
            id: `metrics-alert-${now}`,
            text: lang === 'pt' ? textPt : textEn,
            sender: 'ai',
            timestamp: now,
            source: 'local'
        };
        setMessages(prev => [...prev, aiMsg]);
    }, [metrics.tps, metrics.avgGasPrice, metrics.blockHeight, lang]);

    // Autonomia: Sentinela reage sozinho a anomalias de rede + sugestão pós-anomalia
    useEffect(() => {
        if (anomaly.type === 'NONE') return;

        if (lastAnomalyIdRef.current === anomaly.timestamp) return;
        lastAnomalyIdRef.current = anomaly.timestamp;

        const baseTextPt = `Sentinela detectou uma anomalia de rede: ${anomaly.type} (severidade ${anomaly.severity}). ${anomaly.description}

Bloco atual: ${metrics.blockHeight} • TPS: ${metrics.tps.toFixed(1)} • Gas médio: ${metrics.avgGasPrice.toFixed(2)} gwei.`;

        const baseTextEn = `Sentinel detected a network anomaly: ${anomaly.type} (severity ${anomaly.severity}). ${anomaly.description}

Current block: ${metrics.blockHeight} • TPS: ${metrics.tps.toFixed(1)} • Avg gas: ${metrics.avgGasPrice.toFixed(2)} gwei.`;

        const text = lang === 'pt' ? baseTextPt : baseTextEn;

        const aiMsg: Message = {
            id: `anomaly-${anomaly.timestamp}`,
            text,
            sender: 'ai',
            timestamp: Date.now(),
            source: 'local'
        };

        setMessages(prev => [...prev, aiMsg]);

        if (lastAnomalyFollowUpRef.current === anomaly.timestamp) return;
        lastAnomalyFollowUpRef.current = anomaly.timestamp;
        const followUpPt = "Quer que eu simule um stress test para validar a resiliência? Use o botão \"Simular Estresse\" abaixo.";
        const followUpEn = "Want me to run a stress test to validate resilience? Use the \"Simulate stress\" button below.";
        setTimeout(() => {
            const followUpMsg: Message = {
                id: `anomaly-followup-${anomaly.timestamp}`,
                text: lang === 'pt' ? followUpPt : followUpEn,
                sender: 'ai',
                timestamp: Date.now(),
                source: 'local'
            };
            setMessages(prev => [...prev, followUpMsg]);
        }, 3000);
    }, [anomaly, metrics.blockHeight, metrics.tps, metrics.avgGasPrice, lang]);

    const handleSendMessage = async (customText?: string) => {
        const textToSend = customText || inputText;
        if (!textToSend.trim() || isThinking) return;

        const userMsg: Message = { id: Date.now().toString(), text: textToSend, sender: 'user', timestamp: Date.now() };
        setMessages(prev => [...prev, userMsg]);
        setInputText('');
        setIsThinking(true);

        const metricsSnapshot = {
            blockHeight: metrics.blockHeight,
            tps: metrics.tps,
            avgGasPrice: metrics.avgGasPrice,
            activeValidators: metrics.activeValidators
        };
        const lastUser = messages.filter(m => m.sender === 'user').slice(-1)[0]?.text;
        const lastAi = messages.filter(m => m.sender === 'ai').slice(-1)[0]?.text;
        const context = lastUser || lastAi ? { lastUserMessage: lastUser, lastAiMessage: lastAi } : undefined;

        setTimeout(async () => {
            try {
                const intelligence = LocalIntelligence.processQuery(textToSend, metricsSnapshot, context);

                let finalContent = intelligence.text;
                let source: 'local' | 'cloud' = 'local';
                const patternId = intelligence.patternId;

                if (intelligence.confidence < CONFIDENCE_THRESHOLD) {
                    try {
                        const vectorRes = await fetch(`${API_BASE_URL}/api/vector-search`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ query: textToSend, top_k: 1 })
                        });
                        
                        if (vectorRes.ok) {
                            const results = await vectorRes.json();
                            if (results && results.length > 0 && results[0].score > 0.3) {
                                finalContent = `[Vector Knowledge Base] Achei na documentação:\n\n${results[0].content}`;
                                source = 'local';
                            } else {
                                // Fallback to Gemini if nothing found via Vector DB
                                const metricsContext = `Block: ${metricsSnapshot.blockHeight}, TPS: ${metricsSnapshot.tps}, Gas: ${metricsSnapshot.avgGasPrice} gwei, Validators: ${metricsSnapshot.activeValidators}.`;
                                finalContent = await explainWithGemini(metricsContext, textToSend);
                                source = 'cloud';
                            }
                        } else {
                            const metricsContext = `Block: ${metricsSnapshot.blockHeight}, TPS: ${metricsSnapshot.tps}, Gas: ${metricsSnapshot.avgGasPrice} gwei, Validators: ${metricsSnapshot.activeValidators}.`;
                            finalContent = await explainWithGemini(metricsContext, textToSend);
                            source = 'cloud';
                        }
                    } catch {
                        finalContent = lang === 'pt'
                            ? "Não entendi bem. Tente perguntar sobre status da rede, consenso ou mintar tokens."
                            : "I didn't quite get that. Try asking about network status, consensus, or minting tokens.";
                    }
                } else {
                    if (intelligence.action === 'MINT_TOKENS') {
                        const txCount = intelligence.actionPayload?.amount ?? 1;
                        addBlockManually("SENTINEL_AI_FAUCET", Math.min(Math.max(txCount, 1), 100));
                        finalContent += "\n\n[SYSTEM]: Protocol 'MINT_Claim' executed. Block added.";
                    } else if (intelligence.action === 'TRIGGER_ANOMALY') {
                        const anomalyType = intelligence.actionPayload?.anomalyType ?? 'CONGESTION';
                        triggerAnomaly(anomalyType);
                        finalContent += "\n\n[SYSTEM]: Anomaly sequence triggered. Monitoring.";
                    }
                }

                const aiMsg: Message = {
                    id: (Date.now() + 1).toString(),
                    text: finalContent,
                    sender: 'ai',
                    timestamp: Date.now(),
                    source,
                    patternId
                };
                setMessages(prev => [...prev, aiMsg]);
            } catch (error) {
                console.error("Local Intelligence Error:", error);
                const errorMsg: Message = {
                    id: (Date.now() + 1).toString(),
                    text: "⚠️ [SYSTEM ALERT]: Local Logic Core disrupted.",
                    sender: 'ai',
                    timestamp: Date.now(),
                    source: 'local'
                };
                setMessages(prev => [...prev, errorMsg]);
            } finally {
                setIsThinking(false);
            }
        }, 800 + Math.random() * 1000);
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col h-[600px] bg-brand-surface/30 border border-brand-border/50 rounded-2xl overflow-hidden backdrop-blur-sm relative">
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-brand-accent via-brand-primary to-brand-accent opacity-50"></div>

                {/* Header */}
                <div className="p-4 bg-brand-bg/80 border-b border-brand-border/30 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center border border-brand-primary/30">
                                <CpuChipIcon className="w-6 h-6 text-brand-primary animate-pulse" />
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-brand-success rounded-full border-2 border-brand-bg animate-bounce"></div>
                        </div>
                        <div>
                            <h3 className="font-black text-brand-secondary tracking-tight">SENTINEL AI <span className="text-[10px] bg-brand-primary/20 text-brand-primary px-1.5 py-0.5 rounded ml-2">LOCAL CORE</span></h3>
                            <p className="text-[10px] text-brand-muted uppercase tracking-widest font-mono">Consensus Guardian • Zero-Latency</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <div className="px-2 py-1 bg-brand-bg border border-brand-border rounded text-[10px] font-mono text-brand-muted">
                            LATENCY: <span className="text-brand-success">1ms (Local)</span>
                        </div>
                    </div>
                </div>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`
                                max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed shadow-lg backdrop-blur-md
                                ${msg.sender === 'user'
                                    ? 'bg-brand-primary/10 border border-brand-primary/20 text-brand-secondary rounded-br-none'
                                    : 'bg-brand-surface border border-brand-border/40 text-brand-muted rounded-bl-none'
                                }
                            `}>
                                {msg.sender === 'ai' && (
                                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/5 flex-wrap">
                                        <SparklesIcon className="w-3 h-3 text-brand-accent" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-brand-accent">Sentinel Logic</span>
                                        {msg.source && (
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase ${msg.source === 'cloud' ? 'bg-brand-accent/20 text-brand-accent' : 'bg-brand-primary/20 text-brand-primary'}`}>
                                                {msg.source === 'cloud' ? 'Nuvem' : 'Local'}
                                            </span>
                                        )}
                                    </div>
                                )}
                                <div className="whitespace-pre-wrap">{msg.text}</div>
                                <div className="h-px w-full bg-brand-border/30 my-2"></div>
                                <span className="text-[9px] font-bold uppercase tracking-widest font-mono opacity-50">
                                    {new Date(msg.timestamp).toLocaleTimeString()}
                                </span>
                                {msg.sender === 'ai' && msg.patternId && SUGGESTIONS_BY_PATTERN[msg.patternId] && (
                                    <div className="flex flex-wrap gap-2 mt-3">
                                        {(lang === 'pt' ? SUGGESTIONS_BY_PATTERN[msg.patternId].pt : SUGGESTIONS_BY_PATTERN[msg.patternId].en).slice(0, 3).map((suggestion, i) => (
                                            <button
                                                key={i}
                                                type="button"
                                                onClick={() => handleSendMessage(suggestion)}
                                                className="text-[10px] px-2 py-1 rounded-lg bg-brand-bg/80 border border-brand-border/50 text-brand-muted hover:border-brand-primary hover:text-brand-primary transition-all"
                                            >
                                                {suggestion}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {isThinking && (
                        <div className="flex justify-start">
                            <div className="space-y-6 max-w-[60%]">
                                <div className="flex items-center gap-4">
                                    <LoadingIcon className="w-8 h-8 animate-spin text-brand-primary" />
                                    <div className="flex flex-col">
                                        <span className="text-xs font-black text-brand-primary uppercase tracking-[0.4em]">Processando Localmente</span>
                                        <span className="text-[9px] text-brand-muted font-bold uppercase">Consultando Knowledge Base...</span>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <div className="h-3 bg-brand-primary/5 rounded-full w-full animate-pulse"></div>
                                    <div className="h-3 bg-brand-primary/5 rounded-full w-11/12 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                                    <div className="h-3 bg-brand-primary/5 rounded-full w-4/5 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Interface de Comando */}
            <div className="p-8 bg-brand-surface/20 border border-brand-border/40 rounded-[2rem] backdrop-blur-md">
                <div className="flex flex-wrap gap-3 mb-8">
                    <button
                        onClick={() => handleSendMessage("Minta 100 tokens de mérito.")}
                        className="px-6 py-3 bg-brand-bg/50 border border-brand-border/40 rounded-xl text-[10px] font-black uppercase text-brand-muted hover:border-brand-primary hover:text-brand-primary transition-all flex items-center gap-3 group hover:shadow-[0_0_15px_rgba(var(--brand-primary-rgb),0.2)]"
                    >
                        <ShieldCheckIcon className="w-4 h-4 group-hover:scale-110 transition-transform text-brand-success" />
                        Requisitar Mérito
                    </button>
                    <button
                        onClick={() => handleSendMessage("Simule um congestionamento.")}
                        className="px-6 py-3 bg-brand-bg/50 border border-brand-border/40 rounded-xl text-[10px] font-black uppercase text-brand-muted hover:border-brand-primary hover:text-brand-primary transition-all flex items-center gap-3 group hover:shadow-[0_0_15px_rgba(var(--brand-primary-rgb),0.2)]"
                    >
                        <SignalIcon className="w-4 h-4 group-hover:scale-110 transition-transform text-brand-error" />
                        Simular Estresse
                    </button>
                    <button
                        onClick={() => handleSendMessage("Explique o consenso PoC.")}
                        className="px-6 py-3 bg-brand-bg/50 border border-brand-border/40 rounded-xl text-[10px] font-black uppercase text-brand-muted hover:border-brand-primary hover:text-brand-primary transition-all flex items-center gap-3 group hover:shadow-[0_0_15px_rgba(var(--brand-primary-rgb),0.2)]"
                    >
                        <BookOpenIcon className="w-4 h-4 group-hover:scale-110 transition-transform text-brand-accent" />
                        Explicar Consenso
                    </button>
                </div>

                <div className="relative">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-primary/20 to-brand-accent/20 rounded-[1.5rem] blur opacity-30"></div>
                    <div className="relative flex items-center gap-4 bg-brand-bg border border-brand-border/60 p-2 pl-6 rounded-[1.5rem] shadow-xl">
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                            placeholder={lang === 'pt' ? "Digite seu comando para o protocolo local..." : "Enter your command for the local protocol..."}
                            className="flex-1 bg-transparent border-none py-4 text-base text-brand-secondary focus:outline-none placeholder:text-brand-muted/30 font-light tracking-wide"
                        />
                        <button
                            onClick={() => handleSendMessage()}
                            disabled={isThinking || !inputText.trim()}
                            className="p-4 bg-brand-primary text-brand-bg rounded-xl hover:bg-brand-primary/90 hover:shadow-glow-primary transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isThinking ? <LoadingIcon className="w-6 h-6 animate-spin" /> : <PaperAirplaneIcon className="w-6 h-6" />}
                        </button>
                    </div>
                </div>
                <div className="mt-4 flex justify-center">
                    <span className="text-[9px] text-brand-muted font-black uppercase tracking-[0.3em] opacity-40">Processamento Local • Sem Dependência de Cloud</span>
                </div>
            </div>
        </div>
    );
};
