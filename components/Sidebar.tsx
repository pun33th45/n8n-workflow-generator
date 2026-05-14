'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { HistoryEntry } from '@/lib/ipc-types';

const NAV = [
  { href: '/', icon: '⚡', label: 'Generate' },
  { href: '/settings', icon: '⚙', label: 'Settings' },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.getHistory().then(setHistory).catch(() => {});
    }
  }, [pathname]);

  return (
    <aside
      className={[
        'flex flex-col h-screen bg-[#0a0a0c] border-r border-[#1e1e24]',
        'transition-all duration-200 ease-in-out flex-shrink-0',
        collapsed ? 'w-[52px]' : 'w-[210px]',
      ].join(' ')}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3 py-[14px] border-b border-[#1e1e24]">
        <div className="w-7 h-7 rounded-md bg-[#e8ff47] flex items-center justify-center flex-shrink-0">
          <span className="text-[#0e0e10] text-[10px] font-black leading-none">n8n</span>
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-xs font-semibold text-zinc-100 truncate leading-tight">n8n Flow</p>
            <p className="text-[10px] text-zinc-600 leading-tight">Generator</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-0.5 p-1.5 mt-1">
        {NAV.map(({ href, icon, label }) => {
          const active = href === '/'
            ? pathname === '/' || pathname === ''
            : pathname?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={[
                'flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium',
                'transition-colors duration-100',
                active
                  ? 'bg-[#e8ff47]/10 text-[#e8ff47]'
                  : 'text-zinc-500 hover:text-zinc-200 hover:bg-[#18181b]',
              ].join(' ')}
            >
              <span className="flex-shrink-0 text-base leading-none">{icon}</span>
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Recent History */}
      {!collapsed && history.length > 0 && (
        <div className="flex flex-col gap-0.5 px-1.5 mt-3 flex-1 overflow-hidden min-h-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-700 px-2.5 mb-1">
            Recent
          </p>
          <div className="flex flex-col gap-0.5 overflow-y-auto">
            {history.slice(0, 10).map(entry => (
              <button
                key={entry.id}
                onClick={() =>
                  router.push(`/?prompt=${encodeURIComponent(entry.description)}`)
                }
                title={entry.description}
                className="text-left px-2.5 py-1.5 rounded-md text-[11px] text-zinc-600 hover:text-zinc-300 hover:bg-[#18181b] transition-colors truncate"
              >
                {entry.description.length > 30
                  ? entry.description.slice(0, 30) + '…'
                  : entry.description}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1" />

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(c => !c)}
        title={collapsed ? 'Expand' : 'Collapse'}
        className="flex items-center justify-center m-1.5 p-2 rounded-md text-zinc-700 hover:text-zinc-400 hover:bg-[#18181b] transition-colors text-xs"
      >
        {collapsed ? '›' : '‹'}
      </button>
    </aside>
  );
}
