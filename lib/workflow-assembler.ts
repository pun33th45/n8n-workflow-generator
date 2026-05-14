/**
 * Workflow Assembler
 * Converts the LLM's simplified WorkflowPlan into a valid N8nWorkflow
 * using only verified node builders from the registry.
 */
import { randomUUID } from 'crypto';
import { buildNode } from './node-registry';
import type { N8nWorkflow, N8nNode } from './n8n-types';

export interface PlannedNode {
  id: string;
  type: string;
  label: string;
  params: Record<string, unknown>;
}

export interface PlannedConnection {
  from: string;
  to: string;
  branch?: number; // 0 = true/first, 1 = false/second (for IF nodes)
}

export interface WorkflowPlan {
  name: string;
  nodes: PlannedNode[];
  connections: PlannedConnection[];
}

export interface AssemblyResult {
  workflow: N8nWorkflow;
  warnings: string[];
}

export function assemblePlan(plan: WorkflowPlan): AssemblyResult {
  const warnings: string[] = [];

  // ── Build nodes ─────────────────────────────────────────────────────────────
  const nodes: N8nNode[] = [];
  const idToName = new Map<string, string>(); // plan ID → node name

  plan.nodes.forEach((planned, idx) => {
    const position: [number, number] = [250 + idx * 220, 300];
    const id = planned.id || `node-${idx + 1}`;
    const label = planned.label || planned.type;

    const { node, warning } = buildNode(planned.type, randomUUID(), label, position, planned.params ?? {});

    if (warning) warnings.push(warning);

    nodes.push(node);
    idToName.set(id, node.name);
  });

  // ── Build connections ────────────────────────────────────────────────────────
  const connections: N8nWorkflow['connections'] = {};
  const nodeNames = new Set(nodes.map(n => n.name));

  for (const conn of plan.connections ?? []) {
    const fromName = idToName.get(conn.from) ?? conn.from;
    const toName   = idToName.get(conn.to)   ?? conn.to;

    if (!nodeNames.has(fromName)) {
      warnings.push(`Connection source "${conn.from}" not found — skipped.`);
      continue;
    }
    if (!nodeNames.has(toName)) {
      warnings.push(`Connection target "${conn.to}" not found — skipped.`);
      continue;
    }

    if (!connections[fromName]) connections[fromName] = { main: [] };

    const branch = conn.branch ?? 0;
    while (connections[fromName].main.length <= branch) {
      connections[fromName].main.push([]);
    }
    connections[fromName].main[branch].push({ node: toName, type: 'main', index: 0 });
  }

  return {
    workflow: {
      name: plan.name || 'Generated Workflow',
      nodes,
      connections,
      active: false,
      settings: {},
      tags: [],
    },
    warnings,
  };
}

/**
 * Parse the LLM output as a WorkflowPlan.
 * Returns null if the output doesn't look like a valid plan.
 */
export function parsePlan(raw: string): WorkflowPlan | null {
  try {
    const stripped = raw
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    const match = stripped.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const obj = JSON.parse(match[0]) as Record<string, unknown>;

    // Must have nodes array with at least one node that has a "type" field
    if (!Array.isArray(obj['nodes']) || obj['nodes'].length === 0) return null;
    const firstNode = obj['nodes'][0] as Record<string, unknown>;
    if (!firstNode['type']) return null;

    // Looks like a valid plan
    return obj as unknown as WorkflowPlan;
  } catch {
    return null;
  }
}
