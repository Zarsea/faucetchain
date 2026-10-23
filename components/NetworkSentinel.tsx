
import React, { useState, useEffect } from 'react';
import { useNetwork } from './NetworkContext';
import { SparklesIcon, LoadingIcon, ShieldCheckIcon } from './IconComponents';
import { useLanguage } from './LanguageContext';

export const NetworkSentinel: React.FC = () => {
    const { metrics, anomaly } = useNetwork();
    const { tri } = useLanguage();
    const [diagnosis, setDiagnosis] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Read from the metrics rather than asked of an outside model. An anomaly
    // is a rule that fired, so the explanation is the rule -- and it arrives
    // instantly, works offline, and cannot invent a cause that did not happen.
    useEffect(() => {
        if (anomaly.type === 'NONE') {
            setDiagnosis(null);
            return;
        }
        setIsAnalyzing(true);
        const reading = [
            `${tri('Block', 'Bloco', 'Bloque')} ${metrics.blockHeight} · ${metrics.tps.toFixed(1)} TPS · ${metrics.activeValidators} ${tri('validators online.', 'validadores online.', 'validadores en línea.')}`,
            anomaly.type === 'LOW_TPS'
                ? tri('Throughput fell below the expected band. Usually few miners online, or the hourly quota already spent.',
                      'A vazão caiu abaixo da faixa esperada. Em geral é pouco minerador online, ou a cota da hora já gasta.',
                      'El caudal cayó por debajo de la banda esperada. Suele ser poco minero en línea, o la cuota de la hora ya gastada.')
                : anomaly.type === 'HIGH_FEES'
                ? tri('Fees rose above the usual band, which points at congestion — a claim burst or a run of transfers.',
                      'As taxas subiram acima da faixa usual, o que aponta congestionamento — uma rajada de claims ou uma sequência de transferências.',
                      'Las comisiones subieron por encima de la banda usual, lo que apunta a congestión — una ráfaga de claims o una seguidilla de transferencias.')
                : anomaly.type === 'VALIDATOR_DROP'
                ? tri('Validators went offline. The sealer draw stays valid with whoever remains, but fewer nodes means less redundancy.',
                      'Validadores saíram do ar. O sorteio do selador continua válido com quem ficou, mas menos nós significa menos redundância.',
                      'Validadores se cayeron. El sorteo del sellador sigue válido con quien quedó, pero menos nodos significa menos redundancia.')
                : tri('The metrics left their expected band.',
                      'As métricas saíram da faixa esperada.',
                      'Las métricas salieron de su banda esperada.'),
            `Severity: ${anomaly.severity}.`,
        ].join(' ');
        setDiagnosis(reading);
        setIsAnalyzing(false);
    }, [anomaly.type, anomaly.severity, metrics.blockHeight, metrics.tps, metrics.activeValidators]);

    if (anomaly.type === 'NONE' && !diagnosis) return null;

    return (
        <div className={`mt-6 p-6 rounded-2xl border-2 animate-scaleIn transition-colors duration-500 ${
            anomaly.severity === 'CRITICAL' ? 'bg-red-950/20 border-red-500/50' : 
            anomaly.severity === 'MEDIUM' ? 'bg-orange-950/20 border-orange-500/50' : 
            'bg-blue-950/20 border-blue-500/50'
        }`}>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                        anomaly.severity === 'CRITICAL' ? 'bg-red-500 text-white' : 'bg-brand-primary text-brand-bg'
                    }`}>
                        <ShieldCheckIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-brand-secondary flex items-center gap-2">
                            Network Sentinel
                            <span className="px-2 py-0.5 bg-brand-bg/50 rounded text-[10px] uppercase tracking-widest text-brand-primary">
                                {tri('Live', 'Ao vivo', 'En vivo')}
                            </span>
                        </h3>
                        <p className="text-xs text-brand-muted uppercase font-bold tracking-tighter">
                            {tri('Monitoring Layer-1 Integrity', 'Monitorando a integridade da Layer-1',
                                 'Monitoreando la integridad de la Layer-1')}
                        </p>
                    </div>
                </div>
                {isAnalyzing && <LoadingIcon className="w-6 h-6 animate-spin text-brand-primary" />}
            </div>

            <div className="space-y-4">
                <div className="p-3 bg-brand-bg/60 rounded-lg border border-brand-border">
                    <span className="text-[10px] font-black uppercase text-brand-muted block mb-1">
                        {tri('Incident Report', 'Relato do incidente', 'Informe del incidente')}
                    </span>
                    <p className="text-brand-secondary font-mono text-sm">{anomaly.description}</p>
                </div>

                <div className="bg-brand-surface/80 p-4 rounded-xl border border-brand-primary/20 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10">
                        <SparklesIcon className="w-12 h-12" />
                    </div>
                    <span className="text-[10px] font-black uppercase text-brand-primary block mb-2 flex items-center gap-2">
                        <SparklesIcon className="w-3 h-3" />{' '}
                        {tri('Root Cause Diagnosis & Recommendation',
                             'Diagnóstico da causa raiz e recomendação',
                             'Diagnóstico de la causa raíz y recomendación')}
                    </span>
                    {isAnalyzing ? (
                        <div className="space-y-2">
                            <div className="h-2 bg-brand-border animate-pulse w-3/4 rounded"></div>
                            <div className="h-2 bg-brand-border animate-pulse w-full rounded"></div>
                            <div className="h-2 bg-brand-border animate-pulse w-1/2 rounded"></div>
                        </div>
                    ) : (
                        <p className="text-sm text-brand-secondary/90 leading-relaxed italic">
                            "{diagnosis}"
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};
