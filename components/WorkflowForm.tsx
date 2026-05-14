'use client';

import { useState, useEffect } from 'react';

const PRESETS = [
  {
    label: 'Webhook → Slack + Sheets',
    value: 'When a webhook receives data, post a message to Slack and append a row to Google Sheets',
  },
  {
    label: 'Daily HN digest',
    value: 'Every day at 9am, fetch the top 5 Hacker News posts via HTTP and send them as a formatted Telegram message',
  },
  {
    label: 'Lead capture',
    value: 'When a Typeform webhook fires, add the lead to a Notion database and send a welcome email via Gmail',
  },
  {
    label: 'Uptime monitor',
    value: 'Every 10 minutes, make an HTTP GET request to my website. If the status is not 200, send a Slack alert immediately',
  },
  {
    label: 'Sheets → WhatsApp',
    value: 'When a new row is added to Google Sheets, send a WhatsApp message with the row contents via HTTP request',
  },
  {
    label: 'File processor',
    value: 'When a webhook receives a file URL, download it via HTTP, process it with a Code node, and save the result to Airtable',
  },
];

interface WorkflowFormProps {
  onGenerate: (description: string) => void;
  isLoading: boolean;
  initialValue?: string;
}

export default function WorkflowForm({ onGenerate, isLoading, initialValue = '' }: WorkflowFormProps) {
  const [description, setDescription] = useState(initialValue);

  useEffect(() => {
    if (initialValue) setDescription(initialValue);
  }, [initialValue]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (description.trim() && !isLoading) {
      onGenerate(description.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          Describe your automation
        </label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="e.g. Every morning at 9am, fetch top Hacker News posts and send a summary to my Telegram"
          className="w-full rounded-lg border border-[#2e2e35] bg-[#0e0e10] text-zinc-100 placeholder-zinc-700 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#e8ff47]/30 focus:border-[#e8ff47]/50 transition-colors"
          style={{ minHeight: '120px' }}
          disabled={isLoading}
        />
        <span className="text-[10px] text-zinc-700 text-right">{description.length} chars</span>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Presets</span>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map(preset => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setDescription(preset.value)}
              className="px-2.5 py-1 rounded-md text-xs font-medium border border-[#2e2e35] bg-[#0e0e10] text-zinc-500 hover:border-[#e8ff47]/40 hover:text-[#e8ff47] transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={!description.trim() || isLoading}
        className="w-full py-2.5 px-6 rounded-lg font-semibold text-sm bg-[#e8ff47] text-[#0e0e10] hover:bg-[#d4eb3a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <span className="w-3.5 h-3.5 border border-[#0e0e10]/30 border-t-[#0e0e10] rounded-full animate-spin" />
            Generating…
          </>
        ) : (
          'Generate Workflow →'
        )}
      </button>
    </form>
  );
}
