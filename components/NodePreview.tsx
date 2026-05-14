'use client';

import { N8nWorkflow } from '@/lib/n8n-types';

interface NodePreviewProps {
  workflow: N8nWorkflow | null;
}

function getDotColor(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('trigger') || t.includes('webhook') || t.includes('manual')) {
    return 'bg-blue-500';
  }
  if (t.includes('if') || t.includes('switch') || t.includes('code') || t.includes('function')) {
    return 'bg-pink-500';
  }
  return 'bg-green-500';
}

export default function NodePreview({ workflow }: NodePreviewProps) {
  if (!workflow || !workflow.nodes || workflow.nodes.length === 0) return null;

  const connectionCount = Object.values(workflow.connections ?? {}).reduce(
    (acc, conn) => acc + (conn.main?.flat().length ?? 0),
    0
  );

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
        Workflow Preview
      </span>
      <div className="overflow-x-auto pb-2">
        <div className="flex items-center gap-1 min-w-max">
          {workflow.nodes.map((node, i) => (
            <div key={node.id} className="flex items-center gap-1">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#2e2e35] bg-[#18181b] text-sm text-zinc-300 whitespace-nowrap">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getDotColor(node.type)}`} />
                <span className="font-medium">{node.name}</span>
              </div>
              {i < workflow.nodes.length - 1 && (
                <span className="text-zinc-600 text-sm px-0.5">→</span>
              )}
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-zinc-500">
        {workflow.nodes.length} node{workflow.nodes.length !== 1 ? 's' : ''} &middot;{' '}
        {connectionCount} connection{connectionCount !== 1 ? 's' : ''}
      </p>
    </div>
  );
}
