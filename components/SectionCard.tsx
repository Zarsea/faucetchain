
import React from 'react';

interface SectionCardProps {
    title: string;
    children: React.ReactNode;
    icon?: React.ReactNode;
    className?: string;
}

export const SectionCard: React.FC<SectionCardProps> = ({ title, children, icon, className = "" }) => {
    return (
        <div className={`glass border border-brand-border/40 rounded-2xl p-6 transition-all duration-500 hover:border-brand-primary/40 hover:shadow-glow-primary flex flex-col relative z-10 ${className}`}>
            <div className="flex items-center gap-3 mb-5 flex-shrink-0">
                {icon && (
                    <div className="p-2.5 bg-brand-primary/10 rounded-xl text-brand-primary border border-brand-primary/20 shadow-inner">
                        {icon}
                    </div>
                )}
                <h3 className="text-lg font-extrabold text-brand-secondary tracking-tight">
                    {title}
                </h3>
            </div>
            <div className="text-brand-muted space-y-4 leading-relaxed flex-1">
                {children}
            </div>
        </div>
    );
};
