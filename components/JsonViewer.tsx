'use client';

import { useState, useCallback } from 'react';

interface JsonViewerProps {
  json: string | null;
}

function syntaxHighlight(json: string): string {
  const escaped = json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return escaped.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          // JSON key
          return `<span class="json-key">${match}</span>`;
        }
        // String value
        return `<span class="json-string">${match}</span>`;
      }
      if (/true|false|null/.test(match)) {
        return `<span class="json-bool">${match}</span>`;
      }
      // Number
      return `<span class="json-number">${match}</span>`;
    }
  );
}

export default function JsonViewer({ json }: JsonViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (!json) return;
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [json]);

  const handleDownload = useCallback(() => {
    if (!json) return;
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'workflow.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [json]);

  if (!json) return null;

  const highlighted = syntaxHighlight(json);

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
        JSON Output
      </span>
      <div className="rounded-lg border border-[#2e2e35] overflow-hidden">
        {/* Sticky header */}
        <div className="flex items-center justify-between px-4 py-2 bg-[#111113] border-b border-[#2e2e35]">
          <span className="text-xs text-zinc-500 font-mono">workflow.json</span>
          <button
            onClick={handleCopy}
            className="text-xs px-3 py-1 rounded border border-[#2e2e35] bg-[#18181b] text-zinc-400 hover:text-zinc-100 hover:border-zinc-500 transition-colors"
          >
            {copied ? 'Copied ✓' : 'Copy JSON'}
          </button>
        </div>

        {/* Code block */}
        <div
          className="overflow-y-auto"
          style={{ maxHeight: '400px', backgroundColor: '#0d0d0f' }}
        >
          <pre
            className="p-4 text-sm font-mono leading-relaxed overflow-x-auto"
            style={{ fontSize: '13px' }}
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        </div>
      </div>

      <button
        onClick={handleDownload}
        className="self-start px-4 py-2 rounded-lg text-sm font-medium border border-[#2e2e35] bg-[#18181b] text-zinc-300 hover:text-[#e8ff47] hover:border-[#e8ff47]/50 transition-colors"
      >
        ↓ Download JSON
      </button>

      <style>{`
        .json-key   { color: #60a5fa; }
        .json-string { color: #4ade80; }
        .json-number { color: #fbbf24; }
        .json-bool  { color: #f472b6; }
      `}</style>
    </div>
  );
}
