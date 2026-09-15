
import React from 'react';
import { SectionCard } from './SectionCard';
import { CodeBracketIcon, ArrowPathIcon, GlobeAltIcon, ShieldCheckIcon } from './IconComponents';
import { GeminiExplainer } from './GeminiExplainer';
import { useLanguage } from './LanguageContext';
import { DIAGRAMS } from '../constants';
import { MermaidDiagram } from './MermaidDiagram';

export const ApiDocs: React.FC = () => {
    const { lang } = useLanguage();

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            <div className="animate-fadeIn">
                <h2 className="text-3xl font-bold text-brand-secondary mb-4">Documentação da API V3</h2>
                <p className="text-brand-muted mb-6 text-lg leading-relaxed">
                    A FaucetChain permite que **Hubs de Terceiros** se conectem para minerar blocos através da reputação. 
                    Abaixo, veja como configurar seu Hub para farmar $CLAIM via provas de participação.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    {/* HUB INTEGRATION SECTION */}
                    <SectionCard title="Conectar Novo Hub (Onboarding)" icon={<GlobeAltIcon className="w-5 h-5 text-brand-primary"/>}>
                        <p className="text-sm text-brand-muted mb-4">
                            Para começar a farmar, seu Hub deve ser autorizado pela governança. Uma vez autorizado, você pode enviar lotes de claims assinados.
                        </p>
                        <div className="bg-brand-bg p-4 rounded-xl border border-brand-border mb-6">
                            <p className="text-[10px] font-black text-brand-primary uppercase mb-2">Endpoint de Registro</p>
                            <code className="text-xs font-mono text-brand-secondary">POST /v1/hubs/auth</code>
                            <pre className="mt-3 text-[10px] text-brand-muted bg-brand-bg/50 p-2 rounded">
{`{
    "hub_address": "0xSeuHub...",
    "public_key": "ed25519_...",
    "reputation_source": "SocialMedia/IoT/Git"
}`}
                            </pre>
                        </div>
                        <MermaidDiagram 
                            code={DIAGRAMS[lang].HUB_INTEGRATION_DIAGRAM} 
                            title={lang === 'en' ? "Hub-to-L1 Synchronization" : "Sincronização Hub-para-L1"}
                        />
                    </SectionCard>

                    <SectionCard title="Get Latest Block" icon={<CodeBracketIcon className="w-5 h-5"/>}>
                        <div className="flex items-center justify-between mb-2">
                            <p className="font-mono text-xs bg-brand-bg px-2 py-1 rounded border border-brand-border text-brand-primary">GET /v1/blocks/latest</p>
                        </div>
                        <pre className="mt-4 p-4 bg-brand-bg rounded-md text-xs text-brand-secondary/90 overflow-x-auto border border-brand-border font-mono scrollbar-thin">
                            <code>
{`{
    "height": "6789012",
    "hash": "0x7d4b2e...",
    "transactions": [
        {
            "hash": "0x9e8d7...",
            "gasLimit": "30000",
            "chainId": 1042,
            "inputData": "0xa905..."
        }
    ]
}`}
                            </code>
                        </pre>
                    </SectionCard>
                    
                    <SectionCard title="Submit Batch Claim (Hub Farming)" icon={<ShieldCheckIcon className="w-5 h-5 text-green-400"/>}>
                        <div className="flex items-center justify-between mb-2">
                            <p className="font-mono text-xs bg-brand-bg px-2 py-1 rounded border border-brand-border text-brand-primary">POST /v1/claims/submit</p>
                        </div>
                        <p className="text-sm mt-2 text-brand-muted">
                            Este é o endpoint principal para "farmar". Você envia um **Merkle Root** representando centenas de atividades.
                        </p>
                        <div className="mt-4 p-4 bg-brand-bg rounded-md border border-brand-border">
                             <pre className="text-xs font-mono text-brand-secondary">
{`{
    "hub_id": "0xSeuHub...",
    "merkle_root": "0x4f2d7a...",
    "total_weight": 1500.25,
    "proof_signature": "0x7b8c...",
    "timestamp": 1722253810
}`}
                             </pre>
                        </div>
                        <div className="mt-6 p-4 bg-brand-surface border border-brand-border rounded-lg">
                            <GeminiExplainer 
                                context="O farming via Hubs na FaucetChain utiliza Provas de Atividade Agregadas. O Hub atua como um validador de segundo nível (L2) que consolida a reputação de milhares de usuários e a 'liquida' na L1 da FaucetChain para receber recompensas de bloco." 
                                prompt="Como um Hub pode maximizar seu rendimento (yield) na FaucetChain otimizando a frequência de submissão de batches e a qualidade da reputação fornecida?" 
                            />
                        </div>
                    </SectionCard>
                </div>

                <div className="lg:col-span-1 space-y-6">
                    <SectionCard title="Manual do Hub" icon={<GlobeAltIcon className="w-5 h-5 text-brand-primary" />}>
                        <div className="space-y-4">
                            <div className="p-3 bg-brand-primary/5 border border-brand-primary/20 rounded-xl">
                                 <h4 className="text-[10px] font-black text-brand-primary uppercase mb-1">Passo 1: Identidade</h4>
                                 <p className="text-[11px] text-brand-muted leading-relaxed">Crie um par de chaves Ed25519. Este será o 'RG' do seu Hub na rede.</p>
                            </div>
                            <div className="p-3 bg-brand-primary/5 border border-brand-primary/20 rounded-xl">
                                 <h4 className="text-[10px] font-black text-brand-primary uppercase mb-1">Passo 2: Stake Mínimo</h4>
                                 <p className="text-[11px] text-brand-muted leading-relaxed">Todo Hub precisa de 10k $CLAIM em stake para garantir a veracidade dos dados (Anti-Spam).</p>
                            </div>
                            <div className="p-3 bg-brand-primary/5 border border-brand-primary/20 rounded-xl">
                                 <h4 className="text-[10px] font-black text-brand-primary uppercase mb-1">Passo 3: Farming</h4>
                                 <p className="text-[11px] text-brand-muted leading-relaxed">Comece a enviar Provas de Claim. A cada bloco validado, seu Hub recebe 40% da recompensa proporcional.</p>
                            </div>
                        </div>
                    </SectionCard>
                </div>
            </div>
        </div>
    );
};
