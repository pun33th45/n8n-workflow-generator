'use client';

import { useState } from 'react';
import WorkflowForm from '@/components/WorkflowForm';
import NodePreview from '@/components/NodePreview';
import JsonViewer from '@/components/JsonViewer';
import { N8nWorkflow } from '@/lib/n8n-types';

type Status = 'idle' | 'loading' | 'success' | 'error';

export default function Home() {
  const [status, setStatus] = useState<Status>('idle');
  const [workflow, setWorkflow] = useState<N8nWorkflow | null>(null);
  const [jsonString, setJsonString] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const handleGenerate = async (description: string) => {
    setStatus('loading');
    setWorkflow(null);
    setJsonString(null);
    setErrorMsg('');

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setErrorMsg(data.error ?? 'Something went wrong. Please try again.');
        setStatus('error');
        return;
      }

      setWorkflow(data.workflow);
      setJsonString(JSON.stringify(data.workflow, null, 2));
      setStatus('success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error. Please try again.';
      setErrorMsg(msg);
      setStatus('error');
    }
  };

  return (
    <main className="min-h-screen bg-[#0e0e10] text-zinc-100">
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <h1
              className="text-3xl font-bold tracking-tight"
              style={{ fontFamily: 'var(--font-syne)' }}
            >
              n8n Workflow Generator
            </h1>
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-[#e8ff47] text-[#0e0e10] uppercase tracking-wide">
              n8n
            </span>
          </div>
          <p className="text-zinc-400 text-base">
            Describe any automation in plain English → get importable n8n JSON
          </p>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Form */}
          <div className="rounded-xl border border-[#2e2e35] bg-[#18181b] p-6">
            <WorkflowForm
              onGenerate={handleGenerate}
              isLoading={status === 'loading'}
            />

            {/* Status area */}
            <div className="mt-4 min-h-[28px]">
              {status === 'loading' && (
                <p className="text-sm text-zinc-400">
                  Generating workflow with Claude…
                </p>
              )}
              {status === 'success' && workflow && (
                <p className="text-sm text-[#e8ff47]">
                  ✓ Workflow generated — {workflow.nodes.length} nodes
                </p>
              )}
              {status === 'error' && (
                <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2">
                  <p className="text-sm text-red-400">{errorMsg}</p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Output */}
          <div className="rounded-xl border border-[#2e2e35] bg-[#18181b] p-6 flex flex-col gap-6">
            {status === 'idle' && (
              <div className="flex flex-col items-center justify-center h-full min-h-[220px] text-center gap-3">
                <div className="w-12 h-12 rounded-xl border border-[#2e2e35] bg-[#0e0e10] flex items-center justify-center text-2xl">
                  ⚡
                </div>
                <p className="text-zinc-500 text-sm">
                  Your workflow JSON will appear here
                </p>
              </div>
            )}

            {status === 'loading' && (
              <div className="flex flex-col items-center justify-center h-full min-h-[220px] gap-3">
                <div className="w-8 h-8 border-2 border-[#e8ff47]/30 border-t-[#e8ff47] rounded-full animate-spin" />
                <p className="text-zinc-500 text-sm">Building your workflow…</p>
              </div>
            )}

            {status === 'success' && workflow && jsonString && (
              <>
                <NodePreview workflow={workflow} />
                <JsonViewer json={jsonString} />
              </>
            )}

            {status === 'error' && (
              <div className="flex flex-col items-center justify-center h-full min-h-[220px] text-center gap-3">
                <div className="w-12 h-12 rounded-xl border border-red-900/50 bg-red-950/30 flex items-center justify-center text-xl text-red-500">
                  ✕
                </div>
                <p className="text-zinc-500 text-sm">
                  Fix the error on the left and try again
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
