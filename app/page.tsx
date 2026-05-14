'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import WorkflowForm from '@/components/WorkflowForm';
import NodePreview from '@/components/NodePreview';
import JsonViewer from '@/components/JsonViewer';
import { useToast } from '@/components/ToastProvider';
import type { N8nWorkflow } from '@/lib/n8n-types';

function isApiKeyError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes('429') ||
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('invalid api key') ||
    lower.includes('api key') ||
    lower.includes('unauthorized') ||
    lower.includes('authentication') ||
    lower.includes('permission denied') ||
    lower.includes('invalid_api_key') ||
    lower.includes('incorrect api key')
  );
}

type Status = 'idle' | 'loading' | 'success' | 'error';

function HomeContent() {
  const [status, setStatus] = useState<Status>('idle');
  const [workflow, setWorkflow] = useState<N8nWorkflow | null>(null);
  const [jsonString, setJsonString] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [prefill, setPrefill] = useState('');
  const { addToast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const p = searchParams.get('prompt');
    if (p) setPrefill(decodeURIComponent(p));
  }, [searchParams]);

  const handleGenerate = async (description: string) => {
    setStatus('loading');
    setWorkflow(null);
    setJsonString(null);
    setErrorMsg('');

    try {
      if (!window.electronAPI) throw new Error('Electron API not available');

      const result = await window.electronAPI.generateWorkflow(description);

      if (result.error || !result.workflow) {
        const msg = result.error ?? 'Something went wrong. Please try again.';
        setErrorMsg(msg);
        setStatus('error');
        addToast(msg, 'error');
        return;
      }

      setWorkflow(result.workflow);
      setJsonString(JSON.stringify(result.workflow, null, 2));
      setStatus('success');
      addToast(`Workflow generated — ${result.workflow.nodes.length} nodes`, 'success');
      // Surface validation warnings as info toasts
      if (result.warnings?.length) {
        result.warnings
          .filter(w => !w.startsWith('Plan parsing failed'))
          .slice(0, 3)
          .forEach(w => addToast(w, 'error'));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unexpected error';
      setErrorMsg(msg);
      setStatus('error');
      addToast(msg, 'error');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-7">
        <div className="flex items-center gap-3 mb-1.5">
          <h1
            className="text-2xl font-bold tracking-tight text-zinc-100"
            style={{ fontFamily: 'var(--font-syne)' }}
          >
            n8n Workflow Generator
          </h1>
          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-[#e8ff47] text-[#0e0e10] uppercase tracking-widest">
            AI
          </span>
        </div>
        <p className="text-zinc-600 text-sm">
          Describe any automation in plain English → get importable n8n JSON
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Input */}
        <div className="rounded-xl border border-[#1e1e24] bg-[#0a0a0c] p-5 flex flex-col gap-4">
          <WorkflowForm
            onGenerate={handleGenerate}
            isLoading={status === 'loading'}
            initialValue={prefill}
          />
          <div className="min-h-[28px]">
            {status === 'loading' && (
              <p className="text-sm text-zinc-600 flex items-center gap-2">
                <span className="inline-block w-3 h-3 border border-[#e8ff47]/20 border-t-[#e8ff47] rounded-full animate-spin" />
                Generating workflow…
              </p>
            )}
            {status === 'success' && workflow && (
              <p className="text-sm text-[#e8ff47]">✓ {workflow.nodes.length} nodes generated</p>
            )}
            {status === 'error' && (
              <div className="rounded-lg border border-red-900/40 bg-red-950/20 px-3 py-2 flex flex-col gap-2">
                <p className="text-sm text-red-400">{errorMsg}</p>
                {isApiKeyError(errorMsg) && (
                  <button
                    onClick={() => router.push('/settings?changeKey=1')}
                    className="self-start px-3 py-1.5 rounded-lg bg-[#e8ff47] text-[#0e0e10] text-xs font-semibold hover:bg-[#d4eb3a] transition-colors"
                  >
                    Change API Key →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Output */}
        <div className="rounded-xl border border-[#1e1e24] bg-[#0a0a0c] p-5 flex flex-col gap-5">
          {status === 'idle' && (
            <div className="flex flex-col items-center justify-center h-full min-h-[220px] text-center gap-3">
              <div className="w-10 h-10 rounded-xl border border-[#1e1e24] bg-[#0e0e10] flex items-center justify-center text-xl">
                ⚡
              </div>
              <p className="text-zinc-700 text-sm">Your workflow JSON will appear here</p>
            </div>
          )}
          {status === 'loading' && (
            <div className="flex flex-col items-center justify-center h-full min-h-[220px] gap-3">
              <div className="w-8 h-8 border-2 border-[#e8ff47]/15 border-t-[#e8ff47] rounded-full animate-spin" />
              <p className="text-zinc-700 text-sm">Building your workflow…</p>
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
              <div className="w-10 h-10 rounded-xl border border-red-900/40 bg-red-950/20 flex items-center justify-center text-lg text-red-500">
                ✕
              </div>
              {isApiKeyError(errorMsg) ? (
                <>
                  <p className="text-zinc-500 text-sm">Your API key is invalid or quota exceeded</p>
                  <button
                    onClick={() => router.push('/settings?changeKey=1')}
                    className="px-4 py-2 rounded-lg bg-[#e8ff47] text-[#0e0e10] text-sm font-semibold hover:bg-[#d4eb3a] transition-colors"
                  >
                    Change API Key →
                  </button>
                </>
              ) : (
                <p className="text-zinc-700 text-sm">Fix the error on the left and try again</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}
