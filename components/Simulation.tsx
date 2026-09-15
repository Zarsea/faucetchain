
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Validator, SimulationResult } from '../types';
import { SectionCard } from './SectionCard';
import { BeakerIcon, ChartPieIcon, ChartBarIcon, SparklesIcon, ShieldCheckIcon, SignalIcon, BoltIcon, CpuChipIcon, XMarkIcon } from './IconComponents';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, ComposedChart, Line } from 'recharts';

const COLORS = ['#58A6FF', '#3FB950', '#F78166', '#A371F7', '#1F6FEB', '#DB61A2', '#C9D1D9', '#eac54f', '#8B949E', '#238636'];
const HEALTH_COLORS: Record<string, string> = {
    'Online': '#3FB950',
    'Offline': '#8B949E',
    'Malicious': '#F78166'
};

const runSimulation = (
    numValidators: number, 
    alpha: number, 
    beta: number, 
    gamma: number, 
    blockHeight: number,
    reliability: number,
    maliciousness: number,
    maliciousIntensity: number
): SimulationResult => {
    const validators: Validator[] = [];
    let totalHybridWeight = 0;
    let activeNodes = 0;
    let maliciousNodes = 0;

    for (let i = 0; i < numValidators; i++) {
        const pocWeight = Math.pow(Math.random(), 2) * 10000;
        const posStake = Math.pow(Math.random(), 3) * 500000;
        const reputationScore = Math.random() * 100;
        
        const randStatus = Math.random() * 100;
        let status: 'online' | 'offline' | 'malicious' = 'online';
        
        if (randStatus > reliability) {
            status = 'offline';
        } else if (Math.random() * 100 < maliciousness) {
            status = 'malicious';
        }

        let statusMultiplier = 1.0;
        if (status === 'offline') statusMultiplier = 0.0;
        if (status === 'malicious') {
            // Malicious intensity directly reduces the remaining weight of bad actors
            // representing the effectiveness of slashing and AI detection
            statusMultiplier = Math.max(0, 0.2 - (maliciousIntensity / 500)); 
            maliciousNodes++;
        } else if (status === 'online') {
            activeNodes++;
        }
        
        const hybridWeight = ((pocWeight * alpha/100) + (posStake * beta/100) + (reputationScore * gamma/100)) * statusMultiplier;
        
        validators.push({ id: i, pocWeight, posStake, hybridWeight, status });
        totalHybridWeight += hybridWeight;
    }
    
    validators.sort((a, b) => b.hybridWeight - a.hybridWeight);

    const powerDistribution = validators.slice(0, 10).map(v => ({
        name: `Val ${v.id}`,
        value: totalHybridWeight > 0 ? (v.hybridWeight / totalHybridWeight) * 100 : 0
    }));

    const maxWeight = Math.max(...validators.map(v => v.hybridWeight));
    const numBins = 12;
    const binSize = maxWeight / numBins || 1;
    const weightDistribution = Array.from({ length: numBins }, (_, i) => {
        const lower = i * binSize;
        const upper = (i + 1) * binSize;
        const count = validators.filter(v => v.hybridWeight >= lower && v.hybridWeight < upper).length;
        return {
            bin: `${Math.round(lower / 1000)}k-${Math.round(upper / 1000)}k`,
            count
        };
    });

    const healthDistribution = [
        { name: 'Online', value: activeNodes, color: HEALTH_COLORS['Online'] },
        { name: 'Offline', value: numValidators - activeNodes - maliciousNodes, color: HEALTH_COLORS['Offline'] },
        { name: 'Malicious', value: maliciousNodes, color: HEALTH_COLORS['Malicious'] }
    ].filter(d => d.value > 0);

    let gini = 0;
    if (totalHybridWeight > 0) {
        const sortedWeights = validators.map(v => v.hybridWeight).sort((a, b) => a - b);
        const n = sortedWeights.length;
        let sum = 0;
        for (let i = 0; i < n; i++) {
            sum += (i + 1) * sortedWeights[i];
        }
        gini = (2 * sum) / (n * totalHybridWeight) - (n + 1) / n;
    }

    // Stability is heavily impacted by the intensity of malicious actions
    const stabilityScore = Math.max(0, ((activeNodes / numValidators) * 100) - (maliciousNodes * (maliciousIntensity / 10)));
    
    return {
        validators: validators.slice(0, 50),
        powerDistribution,
        weightDistribution,
        healthDistribution,
        giniCoefficient: parseFloat(gini.toFixed(4)),
        stabilityScore: parseFloat(stabilityScore.toFixed(2)),
        activeNodes
    };
};

const Slider: React.FC<{label: string, value: number, setValue: (v: number) => void, min?: number, max?: number, unit: string, color?: string, disabled?: boolean, sublabel?: string}> = ({label, value, setValue, min=0, max=100, unit, color="accent-brand-primary", disabled=false, sublabel}) => (
    <div className={disabled ? "opacity-40" : "mb-4"}>
        <div className="flex justify-between items-end mb-1">
            <label className="text-xs font-bold text-brand-muted uppercase">
                {label}
            </label>
            <span className="text-brand-secondary font-mono text-xs">{value}{unit}</span>
        </div>
        <input
            type="range"
            min={min} max={max} value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            className={`w-full h-1.5 bg-brand-border rounded-lg appearance-none cursor-pointer ${color}`}
            disabled={disabled}
        />
        {sublabel && <p className="text-[9px] text-brand-muted mt-1 italic leading-tight">{sublabel}</p>}
    </div>
);

export const Simulation: React.FC = () => {
    const [alpha, setAlpha] = useState(40);
    const [beta, setBeta] = useState(30);
    const [numValidators, setNumValidators] = useState(200);
    const [blockHeight, setBlockHeight] = useState(500);
    const [reliability, setReliability] = useState(95); 
    const [maliciousness, setMaliciousness] = useState(5); 
    const [maliciousIntensity, setMaliciousIntensity] = useState(25);
    const [results, setResults] = useState<SimulationResult | null>(null);
    const [era, setEra] = useState<'BOOTSTRAP' | 'STABILITY' | 'CRISIS'>('STABILITY');

    const gamma = Math.max(0, 100 - alpha - beta);

    const applyEraPreset = (selectedEra: typeof era) => {
        setEra(selectedEra);
        switch(selectedEra) {
            case 'BOOTSTRAP':
                setAlpha(80); setBeta(10); setMaliciousIntensity(10); break;
            case 'STABILITY':
                setAlpha(40); setBeta(30); setMaliciousIntensity(25); break;
            case 'CRISIS':
                setAlpha(20); setBeta(70); setMaliciousIntensity(80); break;
        }
    };

    const handleRunSimulation = useCallback(() => {
        setResults(runSimulation(numValidators, alpha, beta, gamma, blockHeight, reliability, maliciousness, maliciousIntensity));
    }, [numValidators, alpha, beta, gamma, blockHeight, reliability, maliciousness, maliciousIntensity]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
                <SectionCard title="Stress Test Config" icon={<BeakerIcon className="w-5 h-5"/>}>
                     <div className="mb-6">
                        <label className="text-[10px] font-black text-brand-muted uppercase mb-3 block tracking-widest">Protocol Scenario</label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { id: 'BOOTSTRAP', label: 'Merit', color: 'border-brand-primary' },
                                { id: 'STABILITY', label: 'Balance', color: 'border-brand-success' },
                                { id: 'CRISIS', label: 'Safety', color: 'border-brand-error' }
                            ].map(e => (
                                <button 
                                    key={e.id}
                                    onClick={() => applyEraPreset(e.id as any)}
                                    className={`px-2 py-2 text-[10px] font-bold rounded-lg border transition-all ${era === e.id ? `${e.color} bg-brand-surface text-white` : 'border-brand-border text-brand-muted hover:border-brand-muted'}`}
                                >
                                    {e.label}
                                </button>
                            ))}
                        </div>
                     </div>

                     <Slider label="Validator Count" value={numValidators} setValue={setNumValidators} min={50} max={1000} unit=""/>
                     
                     <div className="p-4 bg-brand-bg/50 rounded-xl border border-brand-border mb-4">
                        <h4 className="text-[10px] font-black text-brand-primary uppercase mb-4 tracking-widest">PoC Vectors</h4>
                        <Slider label="PoC Weight (α)" value={alpha} setValue={(v) => {
                            if (v + beta > 100) setBeta(100 - v);
                            setAlpha(v);
                            setEra('STABILITY');
                        }} unit="%" sublabel="Influence based on verifiable activity/contribution." />
                        <Slider label="PoS Weight (β)" value={beta} setValue={(v) => {
                            if (v + alpha > 100) setAlpha(100 - v);
                            setBeta(v);
                            setEra('STABILITY');
                        }} unit="%" sublabel="Influence based on staked capital commitment." />
                        <div className="flex justify-between items-center text-xs font-bold p-2 bg-brand-primary/10 rounded-lg text-brand-primary border border-brand-primary/20">
                            <span className="flex items-center gap-2 font-mono uppercase tracking-tighter">AI Reputation (γ)</span>
                            <span>{gamma}%</span>
                        </div>
                     </div>

                     <div className="p-4 bg-brand-bg/50 rounded-xl border border-brand-border">
                        <h4 className="text-[10px] font-black text-brand-error uppercase mb-4 tracking-widest">Adversarial Parameters</h4>
                        <Slider label="Sybil Nodes" value={maliciousness} setValue={setMaliciousness} min={0} max={40} unit="%" color="accent-brand-error" sublabel="% of nodes attempting to exploit the consensus." />
                        <Slider label="Malicious Intensity" value={maliciousIntensity} setValue={setMaliciousIntensity} min={0} max={100} unit="%" color="accent-red-600" sublabel="Severity of bad actions (e.g. double-signing frequency)." />
                     </div>

                     <button
                        onClick={handleRunSimulation}
                        className="w-full bg-brand-primary text-brand-bg font-black py-4 px-4 rounded-xl hover:bg-white hover:shadow-glow-primary transition-all active:scale-95 uppercase tracking-wider text-sm mt-4"
                     >
                        Generate Consensus Simulation
                     </button>
                </SectionCard>
            </div>

            <div className="lg:col-span-2 space-y-8">
                {results ? (
                    <div className="animate-fadeIn space-y-8">
                        {/* Summary Metrics Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <SectionCard title="Network Stability" icon={<ShieldCheckIcon className="w-5 h-5"/>}>
                                <div className="text-center p-6 bg-brand-bg/40 rounded-2xl border border-brand-border relative overflow-hidden h-full flex flex-col justify-center">
                                    <div className="absolute top-0 left-0 h-1 transition-all duration-1000" style={{ width: `${results.stabilityScore}%`, backgroundColor: results.stabilityScore > 80 ? '#4ade80' : results.stabilityScore > 50 ? '#fbbf24' : '#f43f5e' }}></div>
                                    <p className="text-[10px] font-black text-brand-muted uppercase tracking-widest mb-2">Liveness Resilience</p>
                                    <p className={`text-6xl font-black font-mono tracking-tighter ${results.stabilityScore > 80 ? 'text-brand-success' : results.stabilityScore > 50 ? 'text-brand-accent' : 'text-brand-error'}`}>
                                        {results.stabilityScore}%
                                    </p>
                                    <p className="text-[10px] text-brand-muted mt-4">
                                        {results.stabilityScore > 80 ? "CONSENSO ROBUSTO" : results.stabilityScore > 50 ? "RISCO DE FINALIDADE" : "COLAPSO DE REDE IMINENTE"}
                                    </p>
                                </div>
                            </SectionCard>

                            <SectionCard title="Decentralization Index" icon={<ChartPieIcon className="w-5 h-5"/>}>
                                <div className="text-center p-6 bg-brand-bg/40 rounded-2xl border border-brand-border relative overflow-hidden h-full flex flex-col justify-center">
                                    <p className="text-[10px] font-black text-brand-muted uppercase tracking-widest mb-2">Gini Coefficient (Inverse)</p>
                                    <p className="text-6xl font-black font-mono tracking-tighter text-brand-primary">
                                        {(1 - results.giniCoefficient).toFixed(2)}
                                    </p>
                                    <div className="w-full bg-brand-border/30 h-1.5 rounded-full mt-4">
                                        <div className="bg-brand-primary h-full rounded-full transition-all duration-1000" style={{ width: `${(1 - results.giniCoefficient) * 100}%` }}></div>
                                    </div>
                                    <p className="text-[10px] text-brand-muted mt-4 uppercase font-bold tracking-widest">
                                        GINI: {results.giniCoefficient}
                                    </p>
                                </div>
                            </SectionCard>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <SectionCard title="Validator Health State" icon={<SignalIcon className="w-5 h-5"/>}>
                                <div style={{ width: '100%', height: 280 }}>
                                    <ResponsiveContainer>
                                        <PieChart>
                                            <Pie
                                                data={results.healthDistribution}
                                                innerRadius={65}
                                                outerRadius={95}
                                                paddingAngle={8}
                                                dataKey="value"
                                                animationBegin={0}
                                                animationDuration={1200}
                                            >
                                                {results.healthDistribution.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                                ))}
                                            </Pie>
                                            <Tooltip 
                                                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }}
                                                itemStyle={{ color: '#f8fafc' }}
                                            />
                                            <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </SectionCard>

                            <SectionCard title="Consensus Power Concentration" icon={<BoltIcon className="w-5 h-5 text-brand-accent"/>}>
                                <div style={{ width: '100%', height: 280 }}>
                                    <ResponsiveContainer>
                                        <PieChart>
                                            <Pie
                                                data={results.powerDistribution}
                                                innerRadius={65}
                                                outerRadius={95}
                                                paddingAngle={4}
                                                dataKey="value"
                                                animationBegin={200}
                                                animationDuration={1500}
                                            >
                                                {results.powerDistribution.map((_, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                                                ))}
                                            </Pie>
                                            <Tooltip 
                                                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }}
                                                formatter={(v: number) => [`${v.toFixed(2)}%`, 'Voting Power']}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </SectionCard>
                        </div>

                        <SectionCard title="PoC Hybrid Weight Distribution" icon={<ChartBarIcon className="w-5 h-5 text-brand-primary"/>}>
                            <div className="mb-4 flex gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-brand-primary rounded-sm"></div>
                                    <span className="text-[10px] text-brand-muted uppercase font-bold">Node Count</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-0.5 bg-brand-accent"></div>
                                    <span className="text-[10px] text-brand-muted uppercase font-bold">Consensus Stability Trend</span>
                                </div>
                            </div>
                            <div style={{ width: '100%', height: 320 }}>
                                <ResponsiveContainer>
                                    <ComposedChart data={results.weightDistribution}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} opacity={0.3} />
                                        <XAxis dataKey="bin" stroke="#94a3b8" fontSize={10} axisLine={false} tickLine={false} />
                                        <YAxis stroke="#94a3b8" fontSize={10} axisLine={false} tickLine={false} />
                                        <Tooltip cursor={{fill: 'rgba(56, 189, 248, 0.05)'}} contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155' }} />
                                        <Bar dataKey="count" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                                        <Line type="monotone" dataKey="count" stroke="#818cf8" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                            <p className="text-xs text-brand-muted mt-4 text-center italic">
                                Gráfico mostra a quantidade de nós em cada faixa de peso híbrido. Maior dispersão (Gini baixo) indica uma rede mais descentralizada.
                            </p>
                        </SectionCard>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center bg-brand-surface/20 border-2 border-dashed border-brand-border rounded-3xl p-12 text-center group transition-all duration-500 hover:border-brand-primary/40">
                        <div className="w-24 h-24 bg-brand-primary/5 rounded-full flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500 relative">
                            <div className="absolute inset-0 bg-brand-primary/10 rounded-full animate-ping"></div>
                            <CpuChipIcon className="w-12 h-12 text-brand-primary opacity-60 relative z-10" />
                        </div>
                        <h3 className="text-2xl font-bold text-white uppercase tracking-tighter">Command Center: Simulation</h3>
                        <p className="text-brand-muted max-w-sm mt-4 leading-relaxed font-medium">
                            Execute o simulador PoC-V3 para auditar como o mérito, capital e comportamento malicioso impactam a descentralização do ledger FaucetChain.
                        </p>
                        <div className="mt-8 flex gap-3">
                            <span className="px-3 py-1 bg-brand-border/30 rounded-lg text-[10px] font-black uppercase tracking-widest text-brand-muted border border-brand-border">No Hardware Mining</span>
                            <span className="px-3 py-1 bg-brand-border/30 rounded-lg text-[10px] font-black uppercase tracking-widest text-brand-muted border border-brand-border">AI Reputation Ready</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
