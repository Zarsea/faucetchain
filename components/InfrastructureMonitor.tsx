
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SectionCard } from './SectionCard';
import { SignalIcon, CpuChipIcon, CubeIcon, ShieldCheckIcon, BoltIcon } from './IconComponents';
import { API_BASE_URL, WS_BASE_URL } from '../apiConfig';

// ── Types ────────────────────────────────────────────────────────
interface InfraStatus {
    api: { status: string; uptime_seconds: number; websocket_connections: number; vector_db: string; fraud_detector: string };
    mining: { status: string; nodes_online: number; nodes_total: number; total_mined: number; pending_claims: number; last_heartbeat: number };
    staking: { status: string; active_positions: number; total_locked: number; last_action: number };
    bounty: { status: string; open_bounties: number; claimed_pending: number; total_distributed: number };
    sentinel: { status: string; vector_db_docs: number };
    database: { status: string; blocks: number; transactions: number; claims: number; size_mb: number };
    websocket: { status: string; active_connections: number };
    timestamp: number;
}

interface LiveEvent {
    id: number;
    type: string;
    description: string;
    timestamp: number;
    color: string;
    icon: string;
}

// ── Node config for topology ────────────────────────────────────
const NODES = [
    { id: 'api', label: 'Backend API', icon: '⚙️', x: 300, y: 80 },
    { id: 'mining', label: 'Mining Network', icon: '⛏️', x: 520, y: 160 },
    { id: 'staking', label: 'Staking Vault', icon: '🔒', x: 480, y: 310 },
    { id: 'bounty', label: 'Bounty Board', icon: '⚡', x: 300, y: 370 },
    { id: 'sentinel', label: 'Sentinel AI', icon: '🛡️', x: 120, y: 310 },
    { id: 'database', label: 'SQLite DB', icon: '💾', x: 80, y: 160 },
    { id: 'frontend', label: 'React DApp', icon: '🖥️', x: 300, y: 225 },
];

const CONNECTIONS = [
    { from: 'frontend', to: 'api' },
    { from: 'api', to: 'database' },
    { from: 'api', to: 'mining' },
    { from: 'api', to: 'staking' },
    { from: 'api', to: 'bounty' },
    { from: 'api', to: 'sentinel' },
    { from: 'mining', to: 'database' },
    { from: 'staking', to: 'database' },
    { from: 'sentinel', to: 'database' },
    { from: 'bounty', to: 'database' },
];

const EVENT_COLORS: Record<string, { color: string; icon: string; label: string }> = {
    CLAIM_SUBMITTED: { color: '#58a6ff', icon: '📥', label: 'Claim Submitted' },
    BLOCK_MINED: { color: '#f78166', icon: '⛏️', label: 'Block Mined' },
    MINER_HEARTBEAT: { color: '#238636', icon: '💚', label: 'Heartbeat' },
    STAKE_ACTION: { color: '#d2a8ff', icon: '🔒', label: 'Stake Action' },
    TRANSFER_EXECUTED: { color: '#f0883e', icon: '💸', label: 'Transfer' },
    NEW_BLOCK: { color: '#58a6ff', icon: '🧱', label: 'New Block' },
};

// ── Helpers ──────────────────────────────────────────────────────
const formatUptime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const statusColor = (s: string) =>
    s === 'online' || s === 'active' ? '#238636' :
    s === 'idle' || s === 'disabled' ? '#d29922' :
    s === 'error' ? '#f85149' : '#8b949e';

const StatusDot: React.FC<{ status: string }> = ({ status }) => (
    <span
        className="inline-block w-2.5 h-2.5 rounded-full mr-2 flex-shrink-0"
        style={{
            backgroundColor: statusColor(status),
            boxShadow: `0 0 8px ${statusColor(status)}80`,
            animation: status === 'online' || status === 'active' ? 'pulse 2s infinite' : 'none',
        }}
    />
);

// ── Topology Map ────────────────────────────────────────────────
const TopologyMap: React.FC<{ infra: InfraStatus | null; activeConnections: Set<string> }> = ({ infra, activeConnections }) => {
    const [hoveredNode, setHoveredNode] = useState<string | null>(null);

    const getNodeStatus = (id: string): string => {
        if (!infra) return 'idle';
        if (id === 'frontend') return 'online';
        const section = (infra as any)[id];
        return section?.status || 'idle';
    };

    return (
        <svg viewBox="0 0 600 450" className="w-full h-auto" style={{ maxHeight: 400 }}>
            <defs>
                <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                    <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#58a6ff" stopOpacity="0.1" />
                    <stop offset="50%" stopColor="#58a6ff" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#58a6ff" stopOpacity="0.1" />
                </linearGradient>
            </defs>

            {/* Connections */}
            {CONNECTIONS.map(({ from, to }) => {
                const a = NODES.find(n => n.id === from)!;
                const b = NODES.find(n => n.id === to)!;
                const isActive = activeConnections.has(`${from}-${to}`) || activeConnections.has(`${to}-${from}`);
                const isHighlighted = hoveredNode === from || hoveredNode === to;
                return (
                    <g key={`${from}-${to}`}>
                        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                            stroke={isHighlighted ? '#58a6ff' : '#30363d'}
                            strokeWidth={isHighlighted ? 2 : 1}
                            strokeOpacity={isHighlighted ? 0.8 : 0.4}
                        />
                        {isActive && (
                            <circle r="3" fill="#58a6ff" filter="url(#glow)">
                                <animateMotion dur="1.5s" repeatCount="indefinite"
                                    path={`M${a.x},${a.y} L${b.x},${b.y}`} />
                            </circle>
                        )}
                    </g>
                );
            })}

            {/* Nodes */}
            {NODES.map(node => {
                const status = getNodeStatus(node.id);
                const isHovered = hoveredNode === node.id;
                const sc = statusColor(status);
                return (
                    <g key={node.id}
                        onMouseEnter={() => setHoveredNode(node.id)}
                        onMouseLeave={() => setHoveredNode(null)}
                        style={{ cursor: 'pointer' }}
                    >
                        {/* Outer glow ring */}
                        <circle cx={node.x} cy={node.y} r={isHovered ? 38 : 34}
                            fill="none" stroke={sc} strokeWidth="1.5"
                            strokeOpacity={isHovered ? 0.6 : 0.2}
                            strokeDasharray={status === 'online' || status === 'active' ? 'none' : '4 4'}
                        />
                        {/* Background */}
                        <circle cx={node.x} cy={node.y} r={30}
                            fill="#161b22" stroke={isHovered ? '#58a6ff' : '#30363d'}
                            strokeWidth={isHovered ? 2 : 1}
                            filter={isHovered ? 'url(#glow)' : 'none'}
                        />
                        {/* Status dot */}
                        <circle cx={node.x + 20} cy={node.y - 20} r="5"
                            fill={sc}
                            filter="url(#glow)"
                        />
                        {/* Icon */}
                        <text x={node.x} y={node.y + 5} textAnchor="middle" fontSize="18">{node.icon}</text>
                        {/* Label */}
                        <text x={node.x} y={node.y + 50} textAnchor="middle"
                            fill={isHovered ? '#c9d1d9' : '#8b949e'}
                            fontSize="10" fontFamily="Outfit" fontWeight="600"
                        >
                            {node.label}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
};

// ── Status Card ─────────────────────────────────────────────────
const StatusCard: React.FC<{
    title: string; icon: string; status: string;
    metrics: { label: string; value: string | number }[];
}> = ({ title, icon, status, metrics }) => (
    <div className="glass border border-brand-border/40 rounded-xl p-4 hover:border-brand-primary/30 transition-all duration-300 group">
        <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
                <span className="text-lg">{icon}</span>
                <h4 className="text-sm font-bold text-brand-secondary">{title}</h4>
            </div>
            <div className="flex items-center">
                <StatusDot status={status} />
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: statusColor(status) }}>
                    {status}
                </span>
            </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
            {metrics.map(m => (
                <div key={m.label} className="bg-brand-bg/50 rounded-lg px-3 py-2">
                    <p className="text-[9px] text-brand-muted uppercase tracking-wider">{m.label}</p>
                    <p className="text-sm font-bold text-brand-secondary font-mono">{m.value}</p>
                </div>
            ))}
        </div>
    </div>
);

// ── Live Event Feed ─────────────────────────────────────────────
const EventFeed: React.FC<{ events: LiveEvent[] }> = ({ events }) => {
    const feedRef = useRef<HTMLDivElement>(null);
    useEffect(() => { if (feedRef.current) feedRef.current.scrollTop = 0; }, [events.length]);

    return (
        <div ref={feedRef} className="space-y-1 max-h-[500px] overflow-y-auto pr-1" style={{ scrollBehavior: 'smooth' }}>
            {events.length === 0 && (
                <div className="text-center py-12 text-brand-muted">
                    <p className="text-xs uppercase tracking-widest font-bold">Awaiting events...</p>
                    <p className="text-[10px] mt-1">Real-time protocol actions will appear here</p>
                </div>
            )}
            {events.map(ev => (
                <div key={ev.id}
                    className="flex items-start gap-2 px-3 py-2 rounded-lg bg-brand-bg/40 border border-brand-border/20 hover:border-brand-primary/20 transition-all animate-slideUpFadeIn"
                >
                    <span className="text-sm flex-shrink-0 mt-0.5">{ev.icon}</span>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs text-brand-secondary truncate">{ev.description}</p>
                        <p className="text-[9px] text-brand-muted font-mono mt-0.5">
                            {new Date(ev.timestamp * 1000).toLocaleTimeString()}
                        </p>
                    </div>
                    <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: ev.color + '15', color: ev.color, border: `1px solid ${ev.color}30` }}
                    >
                        {ev.type.replace(/_/g, ' ')}
                    </span>
                </div>
            ))}
        </div>
    );
};

// ── Main Component ──────────────────────────────────────────────
export const InfrastructureMonitor: React.FC = () => {
    const [infra, setInfra] = useState<InfraStatus | null>(null);
    const [events, setEvents] = useState<LiveEvent[]>([]);
    const [activeConnections, setActiveConnections] = useState<Set<string>>(new Set());
    const [latencies, setLatencies] = useState<Record<string, number>>({});
    const eventCounter = useRef(0);

    const [sentinelInsight, setSentinelInsight] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [lastAuditTime, setLastAuditTime] = useState<number | null>(null);

    const infraRef = useRef<InfraStatus | null>(null);
    const latenciesRef = useRef<Record<string, number>>({});
    const isAnalyzingRef = useRef(false);

    // Sync refs
    useEffect(() => { infraRef.current = infra; }, [infra]);
    useEffect(() => { latenciesRef.current = latencies; }, [latencies]);

    // Sentinel AI Audit
    const runAudit = useCallback(async () => {
        if (!infraRef.current || isAnalyzingRef.current) return;
        isAnalyzingRef.current = true;
        setIsAnalyzing(true);
        try {
            // Read straight off the measurements. This used to post the whole
            // infrastructure snapshot to an outside model; the findings below are
            // thresholds, so they are reproducible and nothing leaves the network.
            const infra = infraRef.current;
            const lat = latenciesRef.current ?? {};
            const slow = Object.entries(lat)
                .filter(([, ms]) => typeof ms === 'number' && (ms as number) > 500)
                .map(([name, ms]) => `${name} at ${Math.round(ms as number)}ms`);

            const findings: string[] = [];
            if (slow.length) findings.push(`Slow endpoints: ${slow.join(', ')}. Anything past 500ms will show up as lag in the explorer.`);
            if (infra?.pendingClaims > 100) findings.push(`${infra.pendingClaims} claims are still pending — the hourly quota may be spent, or the sealer is behind.`);
            if (infra?.nodesOnline !== undefined && infra.nodesOnline < 2) findings.push(`Only ${infra.nodesOnline} node online: the sealer draw still works, but there is no redundancy behind it.`);
            if (infra?.dbSizeMb > 500) findings.push(`The database is ${infra.dbSizeMb}MB. Worth archiving old blocks before it starts costing query time.`);

            setSentinelInsight(
                findings.length
                    ? findings.join('\n\n')
                    : 'Nothing outside its band: endpoints responsive, claims draining, nodes reporting in.'
            );
            setLastAuditTime(Date.now());
        } catch (error) {
            console.error("Sentinel audit failed:", error);
        } finally {
            isAnalyzingRef.current = false;
            setIsAnalyzing(false);
        }
    }, []);

    // Initial audit and 2-minute interval
    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout>;
        
        const initialTimer = setTimeout(() => {
            runAudit();
            timeoutId = setInterval(runAudit, 120000);
        }, 5000);

        return () => {
            clearTimeout(initialTimer);
            clearInterval(timeoutId);
        };
    }, [runAudit]);

    // Poll infrastructure status
    useEffect(() => {
        const fetchStatus = async () => {
            const start = performance.now();
            try {
                const res = await fetch(`${API_BASE_URL}/api/infrastructure/status`);
                if (res.ok) {
                    const data = await res.json();
                    setInfra(data);
                    setLatencies(prev => ({ ...prev, api: Math.round(performance.now() - start) }));
                }
            } catch {}
        };
        fetchStatus();
        const interval = setInterval(fetchStatus, 3000);
        return () => clearInterval(interval);
    }, []);

    // WebSocket for live events
    useEffect(() => {
        let socket: WebSocket | null = null;
        let reconnectTimeout: ReturnType<typeof setTimeout>;
        let reconnectDelay = 1000;
        let unmounted = false;

        const connect = () => {
            if (unmounted) return;
            socket = new WebSocket(`${WS_BASE_URL}/ws/network`);

            socket.onopen = () => { reconnectDelay = 1000; };

            socket.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    const evConfig = EVENT_COLORS[msg.type] || { color: '#8b949e', icon: '📡', label: msg.type };
                    const data = msg.data || {};

                    let description = '';
                    switch (msg.type) {
                        case 'CLAIM_SUBMITTED':
                            description = `Claim ${data.amount} $CLAIM from ${data.address || '?'}`;
                            break;
                        case 'BLOCK_MINED':
                            description = `Block #${data.height} mined by ${data.miner || '?'} (+${data.fee} fee)`;
                            break;
                        case 'MINER_HEARTBEAT':
                            description = `Node ${data.node_id || '?'} heartbeat (+${data.uptime_gained}s)`;
                            break;
                        case 'STAKE_ACTION':
                            description = `${data.action === 'stake' ? 'Staked' : 'Unstaked'} ${data.amount} $CLAIM (Tier ${data.tier})`;
                            break;
                        case 'TRANSFER_EXECUTED':
                            description = `Transfer ${data.amount} $CLAIM: ${data.from} → ${data.to}`;
                            break;
                        case 'NEW_BLOCK':
                            description = `New block notification from indexer`;
                            break;
                        default:
                            description = JSON.stringify(data).slice(0, 80);
                    }

                    const newEvent: LiveEvent = {
                        id: ++eventCounter.current,
                        type: msg.type,
                        description,
                        timestamp: data.timestamp || Math.floor(Date.now() / 1000),
                        color: evConfig.color,
                        icon: evConfig.icon,
                    };

                    setEvents(prev => [newEvent, ...prev].slice(0, 50));

                    // Briefly highlight active connection
                    const connMap: Record<string, string[]> = {
                        CLAIM_SUBMITTED: ['frontend-api', 'api-database'],
                        BLOCK_MINED: ['api-mining', 'mining-database'],
                        MINER_HEARTBEAT: ['api-mining'],
                        STAKE_ACTION: ['api-staking', 'staking-database'],
                        TRANSFER_EXECUTED: ['frontend-api', 'api-database'],
                    };
                    const conns = connMap[msg.type] || [];
                    if (conns.length) {
                        setActiveConnections(new Set(conns));
                        setTimeout(() => setActiveConnections(new Set()), 2000);
                    }
                } catch {}
            };

            socket.onclose = () => {
                if (unmounted) return;
                reconnectTimeout = setTimeout(() => {
                    reconnectDelay = Math.min(reconnectDelay * 2, 30000);
                    connect();
                }, reconnectDelay);
            };
            socket.onerror = () => { socket?.close(); };
        };

        connect();
        return () => { unmounted = true; clearTimeout(reconnectTimeout); socket?.close(); };
    }, []);

    // Measure endpoint latencies
    useEffect(() => {
        const measure = async () => {
            const endpoints: [string, string][] = [
                ['blocks', '/api/blocks'],
                ['metrics', '/api/network-metrics'],
                ['mining', '/api/mining/stats'],
                ['staking', '/api/staking/stats'],
                ['bounty', '/api/bounties/stats'],
            ];
            const results: Record<string, number> = {};
            for (const [key, path] of endpoints) {
                const start = performance.now();
                try {
                    await fetch(`${API_BASE_URL}${path}`);
                    results[key] = Math.round(performance.now() - start);
                } catch {
                    results[key] = -1;
                }
            }
            setLatencies(prev => ({ ...prev, ...results }));
        };
        measure();
        const interval = setInterval(measure, 10000);
        return () => clearInterval(interval);
    }, []);

    const latencyColor = (ms: number) => ms < 0 ? '#f85149' : ms < 200 ? '#238636' : ms < 500 ? '#d29922' : '#f85149';

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-brand-secondary">Infrastructure Monitor</h2>
                    <p className="text-brand-muted">
                        Real-time visualization of all FaucetChain protocol layers and data flow.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {infra && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-brand-surface border border-brand-border rounded-lg">
                            <StatusDot status="online" />
                            <span className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">
                                Uptime: {formatUptime(infra.api.uptime_seconds)}
                            </span>
                        </div>
                    )}
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-brand-surface border border-brand-border rounded-lg">
                        <span className="text-[10px] font-bold text-brand-primary uppercase tracking-wider font-mono">
                            {events.length} events
                        </span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Topology + Status Cards */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Topology Map */}
                    <SectionCard title="Network Topology" icon={<SignalIcon className="w-5 h-5 text-brand-primary" />}>
                        <TopologyMap infra={infra} activeConnections={activeConnections} />
                    </SectionCard>

                    {/* Status Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        <StatusCard
                            title="Backend API" icon="⚙️"
                            status={infra?.api.status || 'idle'}
                            metrics={[
                                { label: 'WS Connections', value: infra?.api.websocket_connections ?? 0 },
                                { label: 'Vector DB', value: infra?.api.vector_db || '—' },
                                { label: 'Fraud Detector', value: infra?.api.fraud_detector || '—' },
                                { label: 'Latency', value: latencies.api ? `${latencies.api}ms` : '—' },
                            ]}
                        />
                        <StatusCard
                            title="Mining Network" icon="⛏️"
                            status={infra?.mining.status || 'idle'}
                            metrics={[
                                { label: 'Nodes Online', value: infra?.mining.nodes_online ?? 0 },
                                { label: 'Total Mined', value: `${infra?.mining.total_mined ?? 0} $C` },
                                { label: 'Pending Claims', value: infra?.mining.pending_claims ?? 0 },
                                { label: 'Latency', value: latencies.mining ? `${latencies.mining}ms` : '—' },
                            ]}
                        />
                        <StatusCard
                            title="Staking Vault" icon="🔒"
                            status={infra?.staking.status || 'idle'}
                            metrics={[
                                { label: 'Positions', value: infra?.staking.active_positions ?? 0 },
                                { label: 'Total Locked', value: `${infra?.staking.total_locked ?? 0} $C` },
                                { label: 'Latency', value: latencies.staking ? `${latencies.staking}ms` : '—' },
                                { label: 'Last Action', value: infra?.staking.last_action ? new Date(infra.staking.last_action * 1000).toLocaleDateString() : '—' },
                            ]}
                        />
                        <StatusCard
                            title="Bounty Board" icon="⚡"
                            status={infra?.bounty.status || 'idle'}
                            metrics={[
                                { label: 'Open', value: infra?.bounty.open_bounties ?? 0 },
                                { label: 'Claimed', value: infra?.bounty.claimed_pending ?? 0 },
                                { label: 'Distributed', value: `${infra?.bounty.total_distributed ?? 0} $C` },
                                { label: 'Latency', value: latencies.bounty ? `${latencies.bounty}ms` : '—' },
                            ]}
                        />
                        <StatusCard
                            title="Sentinel AI" icon="🛡️"
                            status={infra?.sentinel.status || 'disabled'}
                            metrics={[
                                { label: 'KB Docs', value: infra?.sentinel.vector_db_docs ?? 0 },
                                { label: 'Engine', value: infra?.sentinel.status === 'active' ? 'FraudDetector' : 'Offline' },
                            ]}
                        />
                        <StatusCard
                            title="SQLite Database" icon="💾"
                            status={infra?.database.status || 'idle'}
                            metrics={[
                                { label: 'Blocks', value: infra?.database.blocks?.toLocaleString() ?? 0 },
                                { label: 'Transactions', value: infra?.database.transactions?.toLocaleString() ?? 0 },
                                { label: 'Claims', value: infra?.database.claims?.toLocaleString() ?? 0 },
                                { label: 'DB Size', value: `${infra?.database.size_mb ?? 0} MB` },
                            ]}
                        />
                    </div>

                    {/* Latency Matrix */}
                    <SectionCard title="Endpoint Health Matrix" icon={<CpuChipIcon className="w-5 h-5" />}>
                        <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                            {Object.entries(latencies).map(([key, value]) => {
                                const ms = typeof value === 'number' ? value : Number(value) || 0;
                                return (
                                <div key={key} className="bg-brand-bg/50 rounded-lg px-3 py-2 text-center border border-brand-border/20">
                                    <p className="text-[9px] text-brand-muted uppercase tracking-wider mb-1">{key}</p>
                                    <p className="text-sm font-bold font-mono" style={{ color: latencyColor(ms) }}>
                                        {ms < 0 ? 'ERR' : `${ms}ms`}
                                    </p>
                                </div>
                            )})}
                        </div>
                    </SectionCard>

                    {/* Sentinel AI Audit */}
                    <SectionCard title="Sentinel AI Network Audit" icon={<ShieldCheckIcon className="w-5 h-5 text-brand-primary" />}>
                        <div className="bg-[#0d1117] border border-brand-border/30 rounded-xl p-5 relative overflow-hidden group hover:border-brand-primary/40 transition-colors duration-300">
                            <div className="absolute top-0 left-0 w-1 h-full bg-brand-primary/50 shadow-[0_0_10px_rgba(88,166,255,0.8)]" />
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2.5 h-2.5 rounded-full ${isAnalyzing ? 'bg-yellow-500 animate-ping' : 'bg-brand-primary shadow-glow-primary'}`} />
                                    <span className="text-xs font-bold uppercase tracking-widest text-brand-muted">
                                        {isAnalyzing ? "Analyzing Topology..." : "Active Monitoring (2m)"}
                                    </span>
                                </div>
                                {lastAuditTime && (
                                    <span className="text-[10px] text-brand-muted font-mono bg-brand-surface px-2 py-1 rounded">
                                        Last Scan: {new Date(lastAuditTime).toLocaleTimeString()}
                                    </span>
                                )}
                            </div>
                            
                            <div className="min-h-[100px] max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                {isAnalyzing && !sentinelInsight ? (
                                    <div className="flex flex-col items-center justify-center h-full text-brand-primary py-8 space-y-3">
                                        <ShieldCheckIcon className="w-8 h-8 animate-pulse" />
                                        <span className="text-xs font-mono text-brand-primary/70 animate-pulse">Running Neural Inference...</span>
                                    </div>
                                ) : sentinelInsight ? (
                                    <div className="text-sm text-brand-secondary leading-relaxed font-mono whitespace-pre-wrap animate-fadeIn">
                                        {sentinelInsight}
                                    </div>
                                ) : (
                                    <div className="text-sm text-brand-muted italic py-8 text-center flex flex-col items-center space-y-2">
                                        <CpuChipIcon className="w-6 h-6 opacity-50" />
                                        <span>Waiting for initial system data stream...</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </SectionCard>
                </div>

                {/* Right: Live Event Feed */}
                <div className="lg:col-span-1">
                    <SectionCard title="Live Event Feed" icon={<BoltIcon className="w-5 h-5 text-brand-accent" />} className="sticky top-4">
                        <EventFeed events={events} />
                    </SectionCard>
                </div>
            </div>
        </div>
    );
};
