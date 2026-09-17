
import React from 'react';
import { CodeBracketIcon } from './IconComponents';

interface CodeBlockProps {
    code: string;
    language: string;
    title: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ code, language, title }) => {
    return (
        <div className="bg-brand-surface border border-brand-border rounded-lg overflow-hidden">
            <div className="px-4 py-2 border-b border-brand-border bg-brand-bg/30">
                <h4 className="text-sm font-medium text-brand-secondary flex items-center gap-2">
                    <CodeBracketIcon className="w-5 h-5" />
                    {title}
                </h4>
            </div>
            <div className="p-4">
                <pre className="text-sm overflow-x-auto font-mono text-brand-secondary/90 mb-4 scrollbar-thin scrollbar-thumb-brand-border scrollbar-track-transparent">
                    <code>{code.trim()}</code>
                </pre>
            </div>
        </div>
    );
};
