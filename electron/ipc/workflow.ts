import { ipcMain } from 'electron';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';
import { getApiKey, getProvider, addToHistory } from '../storage/keystore';
import { INTENT_PROMPT } from '../../lib/intent-prompt';
import { SYSTEM_PROMPT } from '../../lib/prompt';
import { parsePlan, assemblePlan } from '../../lib/workflow-assembler';
import { repairWorkflow } from '../../lib/node-schemas';
import { validateWorkflow, sanitizeWorkflow } from '../../lib/workflow-validator';
import type { N8nWorkflow } from '../../lib/n8n-types';

// ── LLM callers (return raw text) ─────────────────────────────────────────────

const GEMINI_PREFER = [
  'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash-latest',
  'gemini-1.5-pro', 'gemini-pro',
];

async function resolveGeminiModel(key: string): Promise<string> {
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${key}&pageSize=50`
    );
    if (!r.ok) return 'gemini-2.0-flash';
    const j = await r.json() as { models?: Array<{ name: string; supportedGenerationMethods?: string[] }> };
    const available = (j.models ?? [])
      .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
      .map(m => m.name.replace('models/', ''));
    for (const pref of GEMINI_PREFER) {
      if (available.includes(pref)) return pref;
    }
    return available[0] ?? 'gemini-2.0-flash';
  } catch {
    return 'gemini-2.0-flash';
  }
}

async function callGemini(systemPrompt: string, userMsg: string, key: string): Promise<string> {
  const model = await resolveGeminiModel(key);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: systemPrompt + '\n\n' + userMsg }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 4000 },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini ${res.status} (${model}): ${err}`);
  }
  const json = await res.json() as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> };
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

async function callGroq(systemPrompt: string, userMsg: string, key: string): Promise<string> {
  const client = new OpenAI({ apiKey: key, baseURL: 'https://api.groq.com/openai/v1' });
  const res = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMsg },
    ],
    temperature: 0.2,
    max_tokens: 4000,
  });
  return res.choices[0]?.message?.content ?? '';
}

async function callOpenAI(systemPrompt: string, userMsg: string, key: string): Promise<string> {
  const client = new OpenAI({ apiKey: key });
  const res = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMsg },
    ],
    temperature: 0.2,
    max_tokens: 4000,
  });
  return res.choices[0]?.message?.content ?? '';
}

async function callClaude(systemPrompt: string, userMsg: string, key: string): Promise<string> {
  const client = new Anthropic({ apiKey: key });
  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMsg }],
  });
  return res.content[0].type === 'text' ? res.content[0].text : '';
}

async function callLLM(systemPrompt: string, userMsg: string, provider: string, key: string): Promise<string> {
  switch (provider) {
    case 'openai':  return callOpenAI(systemPrompt, userMsg, key);
    case 'claude':  return callClaude(systemPrompt, userMsg, key);
    case 'groq':    return callGroq(systemPrompt, userMsg, key);
    default:        return callGemini(systemPrompt, userMsg, key);
  }
}

// ── Raw JSON fallback parser (uses repair layer) ───────────────────────────────

function parseRawWorkflow(raw: string): N8nWorkflow {
  const stripped = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(match ? match[0] : stripped) as N8nWorkflow;
  return repairWorkflow(parsed);
}

// ── Error classification ──────────────────────────────────────────────────────

function classifyError(raw: string, provider: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('429') || lower.includes('quota') || lower.includes('rate limit')) {
    return provider === 'gemini'
      ? `Gemini quota exceeded. Get a free key at aistudio.google.com (not Google Cloud Console).\n\n${raw}`
      : `API quota exceeded — check your plan or switch providers in Settings.\n\n${raw}`;
  }
  if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('invalid api key') || lower.includes('incorrect api key')) {
    return `Invalid API key. Go to Settings → Change API Key.\n\n${raw}`;
  }
  return raw;
}

// ── Main handler ──────────────────────────────────────────────────────────────

export function registerWorkflowHandlers(): void {
  ipcMain.handle('ipc:generate-workflow', async (_e, description: string) => {
    try {
      const apiKey = getApiKey();
      if (!apiKey) return { error: 'No API key configured. Open Settings to add one.' };

      const provider = getProvider();
      let workflow: N8nWorkflow;
      const warnings: string[] = [];

      // ── Step 1: Generate structured plan ────────────────────────────────────
      let planText: string;
      try {
        planText = await callLLM(INTENT_PROMPT, `Generate a workflow plan for: ${description}`, provider, apiKey);
      } catch (err) {
        throw err; // rethrow — quota/auth errors should surface
      }

      // ── Step 2: Try to assemble from plan ────────────────────────────────────
      const plan = parsePlan(planText);

      if (plan) {
        const result = assemblePlan(plan);
        workflow = sanitizeWorkflow(result.workflow);
        warnings.push(...result.warnings);
      } else {
        // ── Fallback: ask LLM for raw n8n JSON with repair ───────────────────
        warnings.push('Plan parsing failed — falling back to direct JSON generation with repair layer.');
        const rawText = await callLLM(
          SYSTEM_PROMPT,
          `Generate an n8n workflow for: ${description}`,
          provider,
          apiKey
        );
        workflow = sanitizeWorkflow(parseRawWorkflow(rawText));
      }

      // ── Step 3: Validate ─────────────────────────────────────────────────────
      const validation = validateWorkflow(workflow);
      warnings.push(...validation.warnings);

      if (!validation.valid) {
        // Non-fatal: still return the workflow but include errors as warnings
        warnings.push(...validation.errors.map(e => `VALIDATION ERROR: ${e}`));
      }

      // ── Record history ───────────────────────────────────────────────────────
      addToHistory({
        id: randomUUID(),
        description,
        timestamp: Date.now(),
        nodeCount: workflow.nodes?.length ?? 0,
      });

      return { workflow, warnings: warnings.length > 0 ? warnings : undefined };

    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : 'Unknown error';
      return { error: classifyError(raw, getProvider()) };
    }
  });
}
