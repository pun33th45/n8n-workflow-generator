import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SYSTEM_PROMPT } from '@/lib/prompt';
import { N8nWorkflow } from '@/lib/n8n-types';

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_key_here') {
      return NextResponse.json(
        { error: 'Add GEMINI_API_KEY to .env.local — get one free at https://aistudio.google.com/app/apikey' },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { description } = body;

    if (!description || typeof description !== 'string' || !description.trim()) {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

    const prompt =
      SYSTEM_PROMPT + '\n\nGenerate an n8n workflow for: ' + description.trim();

    const result = await model.generateContent(prompt);
    const raw = result.response.text();

    // Strip markdown fences, then fall back to extracting the first {...} block
    const stripped = raw
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    const jsonMatch = stripped.match(/\{[\s\S]*\}/);
    const cleaned = jsonMatch ? jsonMatch[0] : stripped;

    let workflow: N8nWorkflow;
    try {
      workflow = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: 'Generated output was not valid JSON. Try rephrasing.' },
        { status: 500 }
      );
    }

    const nodeCount = workflow.nodes?.length ?? 0;

    return NextResponse.json({ workflow, nodeCount });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
