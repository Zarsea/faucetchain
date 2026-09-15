
import React, { useState, useEffect } from 'react';
import { useNetwork } from './NetworkContext';
import { diagnoseNetworkError } from '../services/geminiService';
import { SparklesIcon, LoadingIcon, ShieldCheckIcon } from './IconComponents';

export const NetworkSentinel: React.FC = () => {
    const { metrics, anomaly } = useNetwork();
    const [diagnosis, setDiagnosis] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    useEffect(() => {
        if (anomaly.type !== 'NONE') {
            const fetchDiagnosis = async () => {
                setIsAnalyzing(true);
                const result = await diagnoseNetworkError(metrics, anomaly);
                setDiagnosis(result);
                setIsAnalyzing(false);
            };
            fetchDiagnosis();
        } else {
            setDiagnosis(null);
        }
    }, [anomaly.type]);

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
                            Gemini Network Sentinel
                            <span className="px-2 py-0.5 bg-brand-bg/50 rounded text-[10px] uppercase tracking-widest text-brand-primary">AI Active</span>
                        </h3>
                        <p className="text-xs text-brand-muted uppercase font-bold tracking-tighter">Monitoring Layer-1 Integrity</p>
                    </div>
                </div>
                {isAnalyzing && <LoadingIcon className="w-6 h-6 animate-spin text-brand-primary" />}
            </div>

            <div className="space-y-4">
                <div className="p-3 bg-brand-bg/60 rounded-lg border border-brand-border">
                    <span className="text-[10px] font-black uppercase text-brand-muted block mb-1">Incident Report</span>
                    <p className="text-brand-secondary font-mono text-sm">{anomaly.description}</p>
                </div>

                <div className="bg-brand-surface/80 p-4 rounded-xl border border-brand-primary/20 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10">
                        <SparklesIcon className="w-12 h-12" />
                    </div>
                    <span className="text-[10px] font-black uppercase text-brand-primary block mb-2 flex items-center gap-2">
                        <SparklesIcon className="w-3 h-3" /> Root Cause Diagnosis & Recommendation
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
