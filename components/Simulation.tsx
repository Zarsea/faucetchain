
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Validator, SimulationResult } from '../types';
import { SectionCard } from './SectionCard';
import { useLanguage } from './LanguageContext';
import { BeakerIcon, ChartPieIcon, ChartBarIcon, SparklesIcon, ShieldCheckIcon, SignalIcon, BoltIcon, CpuChipIcon, XMarkIcon } from './IconComponents';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, ComposedChart, Line } from 'recharts';

const COLORS = ['#58A6FF', '#3FB950', '#F78166', '#A371F7', '#1F6FEB', '#DB61A2', '#C9D1D9', '#eac54f', '#8B949E', '#238636'];
const HEALTH_COLORS: Record<string, string> = {
    'Online': '#3FB950',
    'Offline': '#8B949E',
    'Malicious': '#F78166'
};

// LIVE reproduz select_block_sealer (api_server.py:2336), a unica formula que
// sela um bloco hoje: peso = 1 + stake ativo, sem teto, entre os nos online.
// PROPOSED e a de tres termos -- merito, capital e reputacao -- que nao esta
// implementada. Os dois existem lado a lado de proposito: a diferenca entre
// eles e a proposta, e esconde-la seria a mentira.
type ConsensusMode = 'LIVE' | 'PROPOSED';

const runSimulation = (
    mode: ConsensusMode,
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
        
        // O "+1" da chance minima a um no sem stake, e e o unico freio que
        // existe hoje contra quem trava muito: nao ha teto no termo de stake.
        const hybridWeight = mode === 'LIVE'
            ? (1 + posStake) * statusMultiplier
            : ((pocWeight * alpha/100) + (posStake * beta/100) + (reputationScore * gamma/100)) * statusMultiplier;
        
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
    const { tri } = useLanguage();
    const [mode, setMode] = useState<ConsensusMode>('LIVE');
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
        setResults(runSimulation(mode, numValidators, alpha, beta, gamma, blockHeight, reliability, maliciousness, maliciousIntensity));
    }, [mode, numValidators, alpha, beta, gamma, blockHeight, reliability, maliciousness, maliciousIntensity]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
                <SectionCard title={tri('Stress Test Config', 'Configuração do teste de estresse',
                                         'Configuración de la prueba de estrés')}
                             icon={<BeakerIcon className="w-5 h-5"/>}>
                     <div className="mb-6">
                        <label className="text-[10px] font-black text-brand-muted uppercase mb-3 block tracking-widest">
                            {tri('Which consensus', 'Qual consenso', 'Cuál consenso')}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { id: 'LIVE', label: tri('Running today', 'Rodando hoje', 'En marcha hoy'),
                                  color: 'border-brand-success' },
                                { id: 'PROPOSED', label: tri('Proposed', 'Proposto', 'Propuesto'),
                                  color: 'border-brand-accent' }
                            ].map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => setMode(m.id as ConsensusMode)}
                                    className={`px-2 py-2 text-[10px] font-bold rounded-lg border transition-all ${mode === m.id ? `${m.color} bg-brand-surface text-white` : 'border-brand-border text-brand-muted hover:border-brand-muted'}`}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>
                     </div>

                     <div className="mb-6">
                        <label className="text-[10px] font-black text-brand-muted uppercase mb-3 block tracking-widest">
                            {tri('Protocol Scenario', 'Cenário do protocolo', 'Escenario del protocolo')}
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { id: 'BOOTSTRAP', label: tri('Merit', 'Mérito', 'Mérito'),
                                  color: 'border-brand-primary' },
                                { id: 'STABILITY', label: tri('Balance', 'Equilíbrio', 'Equilibrio'),
                                  color: 'border-brand-success' },
                                { id: 'CRISIS', label: tri('Safety', 'Segurança', 'Seguridad'),
                                  color: 'border-brand-error' }
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

                     <Slider label={tri('Validator Count', 'Quantidade de validadores',
                                        'Cantidad de validadores')} value={numValidators} setValue={setNumValidators} min={50} max={1000} unit=""/>
                     
                     {mode === 'LIVE' ? (
                     <div className="p-4 bg-brand-bg/50 rounded-xl border border-brand-success/30 mb-4">
                        <h4 className="text-[10px] font-black text-brand-success uppercase mb-3 tracking-widest">
                            {tri('Sealer weight, as it runs', 'Peso do selador, como ele roda',
                                 'Peso del sellador, como funciona')}
                        </h4>
                        <p className="font-mono text-xs text-white bg-brand-bg p-3 rounded-lg border border-brand-border">weight = 1 + activeStake</p>
                        <p className="text-[11px] text-brand-muted mt-3 leading-relaxed">
                            {tri(
                                'One term. The draw runs among online nodes only, seeded by keccak256(parent_hash) so anyone can recompute it',
                                'Um termo só. O sorteio corre apenas entre nós online, semeado por keccak256(parent_hash) para qualquer um refazer a conta',
                                'Un solo término. El sorteo corre solo entre nodos en línea, sembrado por keccak256(parent_hash) para que cualquiera rehaga la cuenta')}{' '}
                            (<span className="font-mono">api_server.py:2336</span>).{' '}
                            {tri('There is', 'Não há', 'No hay')}
                            <span className="text-brand-error font-bold">
                                {' '}{tri('no cap on stake', 'teto nenhum no stake', 'tope alguno al stake')}
                            </span>,{' '}
                            {tri('so the largest staker wins most rounds.',
                                 'então quem travou mais ganha a maioria das rodadas.',
                                 'así que quien bloqueó más gana la mayoría de las rondas.')}
                        </p>
                     </div>
                     ) : (
                     <div className="p-4 bg-brand-bg/50 rounded-xl border border-brand-accent/30 mb-4">
                        <h4 className="text-[10px] font-black text-brand-accent uppercase mb-2 tracking-widest">
                            {tri('PoC Vectors — not implemented', 'Vetores PoC — não implementados',
                                 'Vectores PoC — no implementados')}
                        </h4>
                        <p className="text-[11px] text-brand-muted mb-4 leading-relaxed">
                            {tri(
                                'No merit or reputation term exists in the server. These sliders model a proposal, not the running chain.',
                                'Não existe termo de mérito nem de reputação no servidor. Estes controles modelam uma proposta, não a cadeia que roda.',
                                'No existe término de mérito ni de reputación en el servidor. Estos controles modelan una propuesta, no la cadena en marcha.')}
                        </p>
                        <Slider label={tri('PoC Weight (α)', 'Peso PoC (α)', 'Peso PoC (α)')} value={alpha} setValue={(v) => {
                            if (v + beta > 100) setBeta(100 - v);
                            setAlpha(v);
                            setEra('STABILITY');
                        }} unit="%" sublabel={tri(
                            'Influence based on verifiable activity/contribution.',
                            'Influência pela atividade verificável, não pelo capital.',
                            'Influencia por la actividad verificable, no por el capital.')} />
                        <Slider label={tri('PoS Weight (β)', 'Peso PoS (β)', 'Peso PoS (β)')} value={beta} setValue={(v) => {
                            if (v + alpha > 100) setAlpha(100 - v);
                            setBeta(v);
                            setEra('STABILITY');
                        }} unit="%" sublabel={tri(
                            'Influence based on staked capital commitment.',
                            'Influência pelo capital travado em stake.',
                            'Influencia por el capital bloqueado en stake.')} />
                        <div className="flex justify-between items-center text-xs font-bold p-2 bg-brand-primary/10 rounded-lg text-brand-primary border border-brand-primary/20">
                            <span className="flex items-center gap-2 font-mono uppercase tracking-tighter">
                                {tri('AI Reputation (γ)', 'Reputação da IA (γ)', 'Reputación de la IA (γ)')}
                            </span>
                            <span>{gamma}%</span>
                        </div>
                     </div>
                     )}

                     <div className="p-4 bg-brand-bg/50 rounded-xl border border-brand-border">
                        <h4 className="text-[10px] font-black text-brand-error uppercase mb-4 tracking-widest">
                            {tri('Adversarial Parameters', 'Parâmetros do adversário',
                                 'Parámetros del adversario')}
                        </h4>
                        <Slider label={tri('Sybil Nodes', 'Nós Sybil', 'Nodos Sybil')}
                                value={maliciousness} setValue={setMaliciousness} min={0} max={40}
                                unit="%" color="accent-brand-error"
                                sublabel={tri('% of nodes attempting to exploit the consensus.',
                                              '% dos nós tentando explorar o consenso.',
                                              '% de los nodos intentando explotar el consenso.')} />
                        <Slider label={tri('Malicious Intensity', 'Intensidade maliciosa', 'Intensidad maliciosa')}
                                value={maliciousIntensity} setValue={setMaliciousIntensity} min={0}
                                max={100} unit="%" color="accent-red-600"
                                sublabel={tri('Severity of bad actions (e.g. double-signing frequency).',
                                              'Gravidade das ações ruins (ex.: frequência de assinatura dupla).',
                                              'Gravedad de las acciones malas (ej.: frecuencia de doble firma).')} />
                     </div>

                     <button
                        onClick={handleRunSimulation}
                        className="w-full bg-brand-primary text-brand-bg font-black py-4 px-4 rounded-xl hover:bg-white hover:shadow-glow-primary transition-all active:scale-95 uppercase tracking-wider text-sm mt-4"
                     >
                        {tri('Generate Consensus Simulation', 'Gerar simulação de consenso',
                             'Generar simulación de consenso')}
                     </button>
                </SectionCard>
            </div>

            <div className="lg:col-span-2 space-y-8">
                {results ? (
                    <div className="animate-fadeIn space-y-8">
                        {/* Summary Metrics Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <SectionCard title={tri('Network Stability', 'Estabilidade da rede',
                                                     'Estabilidad de la red')}
                                         icon={<ShieldCheckIcon className="w-5 h-5"/>}>
                                <div className="text-center p-6 bg-brand-bg/40 rounded-2xl border border-brand-border relative overflow-hidden h-full flex flex-col justify-center">
                                    <div className="absolute top-0 left-0 h-1 transition-all duration-1000" style={{ width: `${results.stabilityScore}%`, backgroundColor: results.stabilityScore > 80 ? '#4ade80' : results.stabilityScore > 50 ? '#fbbf24' : '#f43f5e' }}></div>
                                    <p className="text-[10px] font-black text-brand-muted uppercase tracking-widest mb-2">
                                        {tri('Liveness Resilience', 'Resiliência de liveness',
                                             'Resiliencia de liveness')}
                                    </p>
                                    <p className={`text-6xl font-black font-mono tracking-tighter ${results.stabilityScore > 80 ? 'text-brand-success' : results.stabilityScore > 50 ? 'text-brand-accent' : 'text-brand-error'}`}>
                                        {results.stabilityScore}%
                                    </p>
                                    <p className="text-[10px] text-brand-muted mt-4">
                                        {results.stabilityScore > 80
                                            ? tri('ROBUST CONSENSUS', 'CONSENSO ROBUSTO',
                                                  'CONSENSO ROBUSTO')
                                            : results.stabilityScore > 50
                                                ? tri('FINALITY AT RISK', 'RISCO DE FINALIDADE',
                                                      'FINALIDAD EN RIESGO')
                                                : tri('NETWORK COLLAPSE IMMINENT',
                                                      'COLAPSO DE REDE IMINENTE',
                                                      'COLAPSO DE RED INMINENTE')}
                                    </p>
                                </div>
                            </SectionCard>

                            <SectionCard title={tri('Decentralization Index', 'Índice de descentralização',
                                                     'Índice de descentralización')}
                                         icon={<ChartPieIcon className="w-5 h-5"/>}>
                                <div className="text-center p-6 bg-brand-bg/40 rounded-2xl border border-brand-border relative overflow-hidden h-full flex flex-col justify-center">
                                    <p className="text-[10px] font-black text-brand-muted uppercase tracking-widest mb-2">
                                        {tri('Gini Coefficient (Inverse)', 'Coeficiente de Gini (inverso)',
                                             'Coeficiente de Gini (inverso)')}
                                    </p>
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
                            <SectionCard title={tri('Validator Health State', 'Estado de saúde dos validadores',
                                                 'Estado de salud de los validadores')}
                                     icon={<SignalIcon className="w-5 h-5"/>}>
                                <div style={{ width: '100%', height: 280 }}>
                                    <ResponsiveContainer>
                                        <PieChart>
                                            {/* Os nomes nascem em `runSimulation`, que e funcao de
                                                modulo e nao alcanca o hook. Traduzir aqui, na
                                                renderizacao, mantem `name` como chave la e como
                                                rotulo aqui. 'Online' e 'Offline' sao iguais nas tres
                                                linguas; so 'Malicious' muda.

                                                Este comentario ficava entre `<Pie` e `data=`, que e
                                                posicao de atributo e nao aceita comentario JSX. O
                                                esbuild tolerava e o `tsc` parava ali -- e parar no
                                                primeiro arquivo e o motivo de o typechecker nunca ter
                                                visto o resto do projeto. */}
                                            <Pie
                                                data={results.healthDistribution.map((d) => ({
                                                    ...d,
                                                    name: d.name === 'Malicious'
                                                        ? tri('Malicious', 'Malicioso', 'Malicioso')
                                                        : d.name,
                                                }))}
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

                            <SectionCard title={tri('Consensus Power Concentration',
                                                     'Concentração de poder no consenso',
                                                     'Concentración de poder en el consenso')}
                                         icon={<BoltIcon className="w-5 h-5 text-brand-accent"/>}>
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

                        <SectionCard title={tri('PoC Hybrid Weight Distribution',
                                                 'Distribuição do peso híbrido PoC',
                                                 'Distribución del peso híbrido PoC')}
                                     icon={<ChartBarIcon className="w-5 h-5 text-brand-primary"/>}>
                            <div className="mb-4 flex gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-brand-primary rounded-sm"></div>
                                    <span className="text-[10px] text-brand-muted uppercase font-bold">
                                        {tri('Node Count', 'Quantidade de nós', 'Cantidad de nodos')}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-0.5 bg-brand-accent"></div>
                                    <span className="text-[10px] text-brand-muted uppercase font-bold">
                                        {tri('Consensus Stability Trend', 'Tendência da estabilidade',
                                             'Tendencia de la estabilidad')}
                                    </span>
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
                                The chart shows how many nodes sit in each hybrid-weight band. A wider spread (lower Gini) means a more decentralised network.
                            </p>
                        </SectionCard>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center bg-brand-surface/20 border-2 border-dashed border-brand-border rounded-3xl p-12 text-center group transition-all duration-500 hover:border-brand-primary/40">
                        <div className="w-24 h-24 bg-brand-primary/5 rounded-full flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500 relative">
                            <div className="absolute inset-0 bg-brand-primary/10 rounded-full animate-ping"></div>
                            <CpuChipIcon className="w-12 h-12 text-brand-primary opacity-60 relative z-10" />
                        </div>
                        <h3 className="text-2xl font-bold text-white uppercase tracking-tighter">
                            {tri('Command Center: Simulation', 'Centro de comando: simulação',
                                 'Centro de mando: simulación')}
                        </h3>
                        <p className="text-brand-muted max-w-sm mt-4 leading-relaxed font-medium">
                            {tri(
                                'Run "Running today" to see the power distribution the current rule produces: weight = 1 + stake, with no cap. "Proposed" shows what merit and reputation would change, and neither exists on the server yet.',
                                'Rode "Rodando hoje" para ver a distribuição de poder que a regra atual produz: peso = 1 + stake, sem teto. "Proposto" mostra o que mérito e reputação mudariam, e nenhum dos dois existe no servidor ainda.',
                                'Ejecute "En marcha hoy" para ver la distribución de poder que produce la regla actual: peso = 1 + stake, sin tope. "Propuesto" muestra lo que cambiarían el mérito y la reputación, y ninguno de los dos existe en el servidor todavía.')}
                        </p>
                        <div className="mt-8 flex gap-3">
                            <span className="px-3 py-1 bg-brand-border/30 rounded-lg text-[10px] font-black uppercase tracking-widest text-brand-muted border border-brand-border">
                                {tri('No Hardware Mining', 'Sem mineração por hardware',
                                     'Sin minería por hardware')}
                            </span>
                            <span className="px-3 py-1 bg-brand-border/30 rounded-lg text-[10px] font-black uppercase tracking-widest text-brand-muted border border-brand-border">
                                {tri('Stake-Weighted Sealing', 'Selagem ponderada por stake',
                                     'Sellado ponderado por stake')}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
