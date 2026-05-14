'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AIProvider } from '@/lib/ipc-types';

const PROVIDERS: {
  id: AIProvider;
  name: string;
  tagline: string;
  hint: string;
  url: string;
}[] = [
  {
    id: 'groq',
    name: 'Groq',
    tagline: '100% free · no credit card · 14,400 req/day — recommended',
    hint: 'Starts with gsk_…',
    url: 'https://console.groq.com/keys',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    tagline: 'Free via AI Studio (aistudio.google.com)',
    hint: 'Starts with AIza…',
    url: 'https://aistudio.google.com/app/apikey',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    tagline: 'GPT-4o Mini — requires billing credits',
    hint: 'Starts with sk-…',
    url: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    tagline: 'Claude Haiku — $5 free credit on signup',
    hint: 'Starts with sk-ant-…',
    url: 'https://console.anthropic.com/settings/keys',
  },
];

type Step = 'provider' | 'key' | 'done';

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>('provider');
  const [provider, setProvider] = useState<AIProvider>('groq');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const selected = PROVIDERS.find(p => p.id === provider)!;

  const handleSave = async () => {
    if (!key.trim() || !window.electronAPI) return;
    setBusy(true);
    setError('');
    const result = await window.electronAPI.saveApiKey(provider, key.trim());
    if (result.valid) {
      setStep('done');
    } else {
      setError(result.error ?? 'Validation failed. Double-check your API key.');
    }
    setBusy(false);
  };

  const openUrl = (url: string) => {
    if (window.electronAPI) window.electronAPI.openExternal(url);
  };

  /* ── Success screen ── */
  if (step === 'done') {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0e0e10]">
        <div className="flex flex-col items-center gap-5 text-center w-80">
          <div className="w-14 h-14 rounded-2xl bg-[#e8ff47]/10 border border-[#e8ff47]/30 flex items-center justify-center text-2xl">
            ✓
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-100 mb-1" style={{ fontFamily: 'var(--font-syne)' }}>
              You&apos;re all set!
            </h2>
            <p className="text-sm text-zinc-500">API key saved securely on your device.</p>
          </div>
          <button
            onClick={() => router.push('/')}
            className="w-full py-3 rounded-lg bg-[#e8ff47] text-[#0e0e10] font-semibold text-sm hover:bg-[#d4eb3a] transition-colors"
          >
            Start Generating →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-[#0e0e10] p-6">
      <div className="w-full max-w-[420px]">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-11 h-11 rounded-xl bg-[#e8ff47] flex items-center justify-center mx-auto mb-4">
            <span className="text-[#0e0e10] text-xs font-black">n8n</span>
          </div>
          <h1
            className="text-2xl font-bold text-zinc-100 mb-1"
            style={{ fontFamily: 'var(--font-syne)' }}
          >
            n8n Workflow Generator
          </h1>
          <p className="text-zinc-600 text-sm">Connect an AI provider to get started</p>
        </div>

        {/* Step: Provider */}
        {step === 'provider' && (
          <div className="flex flex-col gap-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-1">
              Choose AI Provider
            </p>
            {PROVIDERS.map(p => (
              <button
                key={p.id}
                onClick={() => setProvider(p.id)}
                className={[
                  'w-full text-left p-4 rounded-xl border transition-all',
                  provider === p.id
                    ? 'border-[#e8ff47]/50 bg-[#e8ff47]/5'
                    : 'border-[#1e1e24] bg-[#0a0a0c] hover:border-[#2e2e35]',
                ].join(' ')}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className={`font-semibold text-sm ${provider === p.id ? 'text-[#e8ff47]' : 'text-zinc-200'}`}>
                      {p.name}
                    </p>
                    <p className="text-xs text-zinc-600 mt-0.5">{p.tagline}</p>
                  </div>
                  {provider === p.id && <span className="text-[#e8ff47] mt-0.5">✓</span>}
                </div>
              </button>
            ))}
            <button
              onClick={() => setStep('key')}
              className="w-full py-3 mt-1 rounded-lg bg-[#e8ff47] text-[#0e0e10] font-semibold text-sm hover:bg-[#d4eb3a] transition-colors"
            >
              Continue →
            </button>
          </div>
        )}

        {/* Step: API Key */}
        {step === 'key' && (
          <div className="flex flex-col gap-4">
            <button
              onClick={() => { setStep('provider'); setError(''); }}
              className="self-start text-zinc-600 hover:text-zinc-300 text-sm transition-colors"
            >
              ← Back
            </button>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-3">
                {selected.name} API Key
              </p>
              <input
                type="password"
                value={key}
                onChange={e => { setKey(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                placeholder={selected.hint}
                autoFocus
                className="w-full rounded-lg border border-[#1e1e24] bg-[#0a0a0c] text-zinc-100 placeholder-zinc-700 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#e8ff47]/30 focus:border-[#e8ff47]/40 font-mono"
              />
              <p className="text-[10px] text-zinc-700 mt-2">
                Encrypted on your device. Never sent to our servers.
              </p>
            </div>

            {error && (
              <div className="rounded-lg border border-red-900/40 bg-red-950/20 px-3 py-2.5">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={!key.trim() || busy}
              className="w-full py-3 rounded-lg bg-[#e8ff47] text-[#0e0e10] font-semibold text-sm hover:bg-[#d4eb3a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {busy ? (
                <>
                  <span className="w-3.5 h-3.5 border border-[#0e0e10]/30 border-t-[#0e0e10] rounded-full animate-spin" />
                  Validating…
                </>
              ) : (
                'Validate & Save →'
              )}
            </button>

            <button
              onClick={() => openUrl(selected.url)}
              className="text-xs text-zinc-700 hover:text-[#e8ff47] transition-colors text-center"
            >
              Get your {selected.name} API key →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
