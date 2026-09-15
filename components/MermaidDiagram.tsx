
import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { DIAGRAMS } from '../constants';
import { 
    ChartBarIcon, 
    MagnifyingGlassPlusIcon, 
    MagnifyingGlassMinusIcon, 
    ArrowPathIcon,
    ArrowsPointingOutIcon,
    XMarkIcon
} from './IconComponents';
import { GeminiExplainer } from './GeminiExplainer';

// Initialize mermaid with higher stability settings
// Fix: defaultRenderer type "dagre" is not assignable to "dagre-d3" | "dagre-wrapper" | "elk"
mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    securityLevel: 'loose',
    fontFamily: 'Inter, sans-serif',
    flowchart: { 
        useMaxWidth: false, 
        htmlLabels: true, 
        curve: 'basis',
        defaultRenderer: 'dagre-wrapper'
    },
    pie: { useMaxWidth: false },
    sequence: { useMaxWidth: false, showSequenceNumbers: true },
});

interface MermaidDiagramProps {
    code?: string;
    title?: string;
    icon?: React.ReactNode;
    prompt?: string;
}

export const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ 
    code = DIAGRAMS.en.MERMAID_CODE, 
    title = "Consensus Flow Diagram",
    icon,
    prompt
}) => {
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [svgCode, setSvgCode] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const renderDiagram = async () => {
            if (!code || !code.trim()) return;
            try {
                // Generate a unique ID for this render cycle
                const id = `mermaid_diag_${Math.random().toString(36).substring(2, 11)}`;
                const cleanCode = code.trim();
                
                const { svg } = await mermaid.render(id, cleanCode);
                setSvgCode(svg);
                setError(null);
            } catch (err) {
                console.error("Mermaid render error:", err);
                setError("Diagram Render Error: Incompatible syntax detected in this view.");
            }
        };
        renderDiagram();
    }, [code]);

    const handleZoomIn = (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation();
        setScale(prev => Math.min(prev + 0.2, 4));
    };

    const handleZoomOut = (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation();
        setScale(prev => Math.max(prev - 0.2, 0.3));
    };

    const handleReset = (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation();
        setScale(1);
        setOffset({ x: 0, y: 0 });
    };

    // Mouse events
    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        setOffset({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        });
    };

    // Touch events for mobile
    const handleTouchStart = (e: React.TouchEvent) => {
        setIsDragging(true);
        const touch = e.touches[0];
        setDragStart({ x: touch.clientX - offset.x, y: touch.clientY - offset.y });
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging) return;
        const touch = e.touches[0];
        setOffset({
            x: touch.clientX - dragStart.x,
            y: touch.clientY - dragStart.y
        });
    };

    const handleEnd = () => {
        setIsDragging(false);
    };

    const DiagramViewer = ({ inFullscreen = false }) => (
        <div 
            className={`relative group flex flex-col h-full select-none overflow-hidden ${inFullscreen ? 'bg-brand-bg p-4 md:p-8' : ''}`}
            onMouseMove={handleMouseMove}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleEnd}
            onTouchCancel={handleEnd}
        >
            {/* Control Bar - Fixed visibility for Fullscreen/Mobile */}
            <div className={`flex items-center gap-2 mb-4 p-2 bg-brand-surface border border-brand-border rounded-xl backdrop-blur-md self-center transition-all duration-300 z-[120] shadow-2xl ${inFullscreen ? 'sticky top-4' : 'opacity-0 group-hover:opacity-100'}`}>
                <button onClick={handleZoomIn} title="Zoom In" className="p-3 md:p-2 hover:bg-brand-bg rounded-lg text-brand-muted hover:text-brand-primary transition-colors">
                    <MagnifyingGlassPlusIcon className="w-6 h-6 md:w-5 md:h-5" />
                </button>
                <button onClick={handleZoomOut} title="Zoom Out" className="p-3 md:p-2 hover:bg-brand-bg rounded-lg text-brand-muted hover:text-brand-primary transition-colors">
                    <MagnifyingGlassMinusIcon className="w-6 h-6 md:w-5 md:h-5" />
                </button>
                <div className="w-px h-6 bg-brand-border mx-1" />
                <button onClick={handleReset} title="Reset" className="p-3 md:p-2 hover:bg-brand-bg rounded-lg text-brand-muted hover:text-brand-primary transition-colors">
                    <ArrowPathIcon className="w-6 h-6 md:w-5 md:h-5" />
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); inFullscreen ? setIsFullscreen(false) : setIsFullscreen(true); }} 
                    title={inFullscreen ? "Close" : "Fullscreen"}
                    className="p-3 md:p-2 hover:bg-brand-bg rounded-lg text-brand-muted hover:text-brand-primary transition-colors"
                >
                    {inFullscreen ? <XMarkIcon className="w-6 h-6 md:w-5 md:h-5" /> : <ArrowsPointingOutIcon className="w-6 h-6 md:w-5 md:h-5" />}
                </button>
            </div>

            <div 
                className={`flex-1 flex items-center justify-center cursor-grab active:cursor-grabbing h-full`}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
            >
                {error ? (
                    <div className="p-6 border border-red-500/30 bg-red-500/10 rounded-xl text-center space-y-4 max-w-sm">
                        <XMarkIcon className="w-10 h-10 text-red-500 mx-auto" />
                        <div className="space-y-1">
                            <p className="text-sm font-black text-red-400 uppercase tracking-widest">Parser Error</p>
                            <p className="text-xs text-brand-muted leading-relaxed">{error}</p>
                        </div>
                    </div>
                ) : (
                    <div 
                        style={{ 
                            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, 
                            transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                            transformOrigin: 'center center'
                        }}
                        className="flex justify-center items-center pointer-events-none w-full h-full"
                        dangerouslySetInnerHTML={{ __html: svgCode }}
                    />
                )}
            </div>

            {inFullscreen && (
                <div className="mt-8 max-w-4xl mx-auto w-full pb-20 pointer-events-auto">
                     <GeminiExplainer 
                        context={`Diagram Logic:\n${code}`} 
                        prompt={prompt || "Explain this consensus flow in detail."} 
                    />
                    {/* Extra mobile close button at the bottom for better reach */}
                    <div className="md:hidden flex justify-center mt-10">
                         <button 
                            onClick={() => setIsFullscreen(false)}
                            className="flex items-center gap-2 px-8 py-4 bg-brand-surface border border-brand-border rounded-2xl text-white font-black uppercase tracking-widest shadow-xl active:scale-95"
                        >
                            <XMarkIcon className="w-5 h-5" />
                            Sair do Visualizador
                        </button>
                    </div>
                </div>
            )}
            
            {!inFullscreen && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-brand-muted opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none uppercase font-bold tracking-widest whitespace-nowrap">
                    Arraste para mover • Pinça/Scroll para zoom
                </div>
            )}
        </div>
    );

    return (
        <>
            <div className="bg-brand-surface border border-brand-border rounded-2xl p-6 relative flex flex-col overflow-hidden">
                <h3 className="text-lg font-extrabold text-brand-secondary mb-4 flex items-center gap-2">
                    {icon || <ChartBarIcon className="w-5 h-5" />}
                    {title}
                </h3>
                
                <div className="bg-brand-bg/50 rounded-2xl border border-brand-border h-[450px] relative overflow-hidden flex-1 shadow-inner">
                    <DiagramViewer inFullscreen={false} />
                </div>

                <GeminiExplainer 
                    context={`Diagram Logic:\n${code}`} 
                    prompt={prompt || "Explain this consensus flow in detail."} 
                />
            </div>

            {isFullscreen && (
                <div className="fixed inset-0 z-[200] bg-brand-bg animate-fadeIn overflow-y-auto">
                    {/* High-visibility Close Button for Mobile (Top Left) */}
                    <div className="absolute top-4 left-4 z-[210] md:top-6 md:right-6 md:left-auto">
                        <button 
                            onClick={() => setIsFullscreen(false)}
                            className="p-4 md:p-3 bg-brand-surface border border-brand-border rounded-full text-brand-muted hover:text-brand-primary hover:border-brand-primary transition-all shadow-2xl active:scale-90"
                            aria-label="Close Diagram"
                        >
                            <XMarkIcon className="w-8 h-8 md:w-6 md:h-6" />
                        </button>
                    </div>
                    <DiagramViewer inFullscreen={true} />
                </div>
            )}
        </>
    );
};
