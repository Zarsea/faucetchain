
import React, { useState } from 'react';
import { SparklesIcon, LoadingIcon } from './IconComponents';
import { explainWithGemini } from '../services/geminiService';

export const GeminiExplainer: React.FC<{context: string, prompt: string}> = ({context, prompt}) => {
    const [loading, setLoading] = useState(false);
    const [explanation, setExplanation] = useState<string | null>(null);

    const handleExplain = async () => {
        setLoading(true);
        const result = await explainWithGemini(context, prompt);
        setExplanation(result);
        setLoading(false);
    };

    return (
        <div className="mt-4 pt-3 border-t border-brand-border/50">
            {!explanation ? (
                <button 
                    onClick={handleExplain}
                    disabled={loading}
                    className="flex items-center gap-2 text-xs font-medium text-brand-primary hover:text-brand-secondary transition-colors duration-300 group"
                >
                    {loading ? <LoadingIcon className="w-4 h-4 animate-spin" /> : <SparklesIcon className="w-4 h-4 group-hover:scale-110 transition-transform" />}
                    {loading ? "Asking Gemini..." : "Explain this with Gemini AI"}
                </button>
            ) : (
                <div className="bg-brand-surface/50 border border-brand-primary/20 rounded-lg p-4 animate-fadeIn">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <SparklesIcon className="w-4 h-4 text-brand-primary" />
                            <span className="text-xs font-bold text-brand-primary uppercase tracking-wider">Gemini Insight</span>
                        </div>
                        <button onClick={() => setExplanation(null)} className="text-xs text-brand-muted hover:text-brand-secondary">Close</button>
                    </div>
                    <p className="text-sm text-brand-secondary/90 leading-relaxed whitespace-pre-wrap">{explanation}</p>
                </div>
            )}
        </div>
    );
};
