'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ToastProvider';
import type { AIProvider, AppSettings } from '@/lib/ipc-types';

const PROVIDER_LABELS: Record<AIProvider, string> = {
  groq: 'Groq (Free)',
  gemini: 'Google Gemini',
  openai: 'OpenAI',
  claude: 'Anthropic Claude',
};

function SettingsContent() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [changingKey, setChangingKey] = useState(false);
  const [newProvider, setNewProvider] = useState<AIProvider>('gemini');
  const [newKey, setNewKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState('');
  const { addToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('changeKey') === '1') setChangingKey(true);
  }, [searchParams]);

  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.getSettings().then(s => {
      setSettings(s);
      setNewProvider(s.provider);
    });
    window.electronAPI.getVersion().then(setVersion);
  }, []);

  const handleSaveKey = async () => {
    if (!newKey.trim() || !window.electronAPI) return;
    setSaving(true);
    const result = await window.electronAPI.saveApiKey(newProvider, newKey.trim());
    if (result.valid) {
      addToast('API key updated', 'success');
      setChangingKey(false);
      setNewKey('');
      const updated = await window.electronAPI.getSettings();
      setSettings(updated);
    } else {
      addToast(result.error ?? 'Validation failed', 'error');
    }
    setSaving(false);
  };

  const handleClearHistory = async () => {
    if (!window.electronAPI) return;
    await window.electronAPI.clearHistory();
    addToast('History cleared', 'success');
  };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="rounded-xl border border-[#1e1e24] bg-[#0a0a0c] p-5 mb-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-600 mb-4">{title}</h2>
      {children}
    </section>
  );

  const Row = ({ label, sub, action }: { label: string; sub?: string; action: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm text-zinc-300">{label}</p>
        {sub && <p className="text-xs text-zinc-600 mt-0.5">{sub}</p>}
      </div>
      {action}
    </div>
  );

  return (
    <div className="max-w-xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => router.push('/')}
          className="text-zinc-600 hover:text-zinc-300 text-sm transition-colors"
        >
          ←
        </button>
        <h1 className="text-xl font-bold text-zinc-100" style={{ fontFamily: 'var(--font-syne)' }}>
          Settings
        </h1>
      </div>

      {/* AI Provider */}
      <Section title="AI Provider">
        {!changingKey ? (
          <Row
            label={settings ? PROVIDER_LABELS[settings.provider] : '—'}
            sub={settings?.hasApiKey ? 'API key configured' : 'No API key set'}
            action={
              <button
                onClick={() => setChangingKey(true)}
                className="px-3 py-1.5 rounded-lg border border-[#2e2e35] bg-[#111113] text-zinc-400 hover:text-zinc-100 text-xs font-medium transition-colors whitespace-nowrap"
              >
                Change Key
              </button>
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            {/* Provider picker */}
            <div className="flex gap-2 flex-wrap">
              {(Object.keys(PROVIDER_LABELS) as AIProvider[]).map(p => (
                <button
                  key={p}
                  onClick={() => setNewProvider(p)}
                  className={[
                    'px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                    newProvider === p
                      ? 'border-[#e8ff47]/50 text-[#e8ff47] bg-[#e8ff47]/5'
                      : 'border-[#2e2e35] text-zinc-500 hover:text-zinc-200',
                  ].join(' ')}
                >
                  {PROVIDER_LABELS[p]}
                </button>
              ))}
            </div>
            {/* Key input */}
            <input
              type="password"
              value={newKey}
              onChange={e => setNewKey(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveKey()}
              placeholder="Paste new API key…"
              autoFocus
              className="w-full rounded-lg border border-[#2e2e35] bg-[#0e0e10] text-zinc-100 placeholder-zinc-700 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#e8ff47]/30 font-mono"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveKey}
                disabled={!newKey.trim() || saving}
                className="px-4 py-2 rounded-lg bg-[#e8ff47] text-[#0e0e10] text-sm font-semibold disabled:opacity-50 hover:bg-[#d4eb3a] transition-colors"
              >
                {saving ? 'Validating…' : 'Save'}
              </button>
              <button
                onClick={() => { setChangingKey(false); setNewKey(''); }}
                className="px-4 py-2 rounded-lg border border-[#2e2e35] text-zinc-500 hover:text-zinc-200 text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </Section>

      {/* Data */}
      <Section title="Data">
        <Row
          label="Prompt History"
          sub="Last 20 prompts, stored locally"
          action={
            <button
              onClick={handleClearHistory}
              className="px-3 py-1.5 rounded-lg border border-[#2e2e35] bg-[#111113] text-zinc-500 hover:text-red-400 hover:border-red-900/50 text-xs font-medium transition-colors whitespace-nowrap"
            >
              Clear
            </button>
          }
        />
      </Section>

      {/* Setup */}
      <Section title="Account">
        <Row
          label="Re-run Setup"
          sub="Go through the API key setup again"
          action={
            <button
              onClick={() => router.push('/onboarding')}
              className="px-3 py-1.5 rounded-lg border border-[#2e2e35] bg-[#111113] text-zinc-400 hover:text-zinc-100 text-xs font-medium transition-colors whitespace-nowrap"
            >
              Run Setup
            </button>
          }
        />
      </Section>

      {/* About */}
      <Section title="About">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-600">Version</span>
            <span className="text-zinc-400 font-mono text-xs">{version || '—'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-600">Built with</span>
            <span className="text-zinc-400 text-xs">Electron + Next.js</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-600">Storage</span>
            <span className="text-zinc-400 text-xs">OS-encrypted, local only</span>
          </div>
        </div>
      </Section>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  );
}
