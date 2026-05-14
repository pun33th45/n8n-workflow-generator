/**
 * Workflow Validator & Sanitizer
 * Validates assembled workflows before export and removes invalid data.
 */
import type { N8nWorkflow, N8nNode } from './n8n-types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Known valid n8n node types (execution-safe, built-in)
const VALID_TYPES = new Set([
  'n8n-nodes-base.manualTrigger',
  'n8n-nodes-base.scheduleTrigger',
  'n8n-nodes-base.webhook',
  'n8n-nodes-base.httpRequest',
  'n8n-nodes-base.set',
  'n8n-nodes-base.code',
  'n8n-nodes-base.if',
  'n8n-nodes-base.switch',
  'n8n-nodes-base.merge',
  'n8n-nodes-base.wait',
  'n8n-nodes-base.noOp',
  'n8n-nodes-base.splitInBatches',
  'n8n-nodes-base.dateTime',
  'n8n-nodes-base.gmail',
  'n8n-nodes-base.emailSend',
  'n8n-nodes-base.slack',
  'n8n-nodes-base.telegram',
  'n8n-nodes-base.discord',
  'n8n-nodes-base.googleSheets',
  'n8n-nodes-base.notion',
  'n8n-nodes-base.airtable',
]);

// Required parameters per node type
const REQUIRED_PARAMS: Record<string, string[]> = {
  'n8n-nodes-base.httpRequest': ['url'],
  'n8n-nodes-base.gmail': ['sendTo', 'subject'],
  'n8n-nodes-base.emailSend': ['toEmail', 'subject'],
  'n8n-nodes-base.slack': ['channelId', 'text'],
  'n8n-nodes-base.telegram': ['chatId', 'text'],
  'n8n-nodes-base.discord': ['channelId', 'content'],
};

// Trigger node types — a workflow must start with one
const TRIGGER_TYPES = new Set([
  'n8n-nodes-base.manualTrigger',
  'n8n-nodes-base.scheduleTrigger',
  'n8n-nodes-base.webhook',
]);

export function validateWorkflow(wf: N8nWorkflow): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!wf.nodes || wf.nodes.length === 0) {
    errors.push('Workflow has no nodes.');
    return { valid: false, errors, warnings };
  }

  const nodeNames = new Set(wf.nodes.map(n => n.name));
  const nodeIds   = new Set(wf.nodes.map(n => n.id));
  const seenIds   = new Set<string>();
  const seenNames = new Set<string>();

  // ── Node-level checks ──────────────────────────────────────────────────────
  for (const node of wf.nodes) {
    // Unique ID
    if (!node.id) {
      errors.push(`Node "${node.name}" is missing an ID.`);
    } else if (seenIds.has(node.id)) {
      errors.push(`Duplicate node ID "${node.id}" on node "${node.name}".`);
    } else {
      seenIds.add(node.id);
    }

    // Unique name
    if (seenNames.has(node.name)) {
      errors.push(`Duplicate node name "${node.name}".`);
    } else {
      seenNames.add(node.name);
    }

    // Valid type
    if (!VALID_TYPES.has(node.type)) {
      errors.push(
        `Node "${node.name}" uses unknown type "${node.type}". This node cannot execute. ` +
        `Supported types: ${[...VALID_TYPES].join(', ')}.`
      );
    }

    // Required params
    const required = REQUIRED_PARAMS[node.type] ?? [];
    for (const param of required) {
      const val = (node.parameters as Record<string, unknown>)[param];
      if (val === undefined || val === null || val === '') {
        warnings.push(
          `Node "${node.name}" (${node.type}) is missing required parameter "${param}". ` +
          `The workflow will import but this node may fail at execution.`
        );
      }
    }

    // Position sanity
    if (!Array.isArray(node.position) || node.position.length !== 2) {
      warnings.push(`Node "${node.name}" has an invalid position — will be auto-corrected.`);
    }
  }

  // ── Trigger check ──────────────────────────────────────────────────────────
  const hasTrigger = wf.nodes.some(n => TRIGGER_TYPES.has(n.type));
  if (!hasTrigger) {
    warnings.push('Workflow has no trigger node. Add a Manual Trigger, Schedule Trigger, or Webhook to execute.');
  }

  // ── Connection checks ─────────────────────────────────────────────────────
  for (const [fromName, conn] of Object.entries(wf.connections ?? {})) {
    if (!nodeNames.has(fromName)) {
      errors.push(`Connection references non-existent source node "${fromName}".`);
      continue;
    }
    for (const branch of conn.main ?? []) {
      for (const edge of branch ?? []) {
        if (!nodeNames.has(edge.node)) {
          errors.push(
            `Connection from "${fromName}" targets non-existent node "${edge.node}".`
          );
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/** Remove undefined/null values, normalize positions, strip unknown top-level keys */
export function sanitizeWorkflow(wf: N8nWorkflow): N8nWorkflow {
  const nodes: N8nNode[] = wf.nodes.map((node, idx) => {
    // Fix position
    const pos: [number, number] =
      Array.isArray(node.position) && node.position.length === 2
        ? [Number(node.position[0]) || 250 + idx * 220, Number(node.position[1]) || 300]
        : [250 + idx * 220, 300];

    // Deep-clean parameters: remove undefined/null leaves
    const params = deepClean(node.parameters ?? {}) as Record<string, unknown>;

    return {
      id:          node.id,
      name:        node.name,
      type:        node.type,
      typeVersion: node.typeVersion,
      position:    pos,
      parameters:  params,
    };
  });

  // Clean connections: remove empty branches
  const connections: N8nWorkflow['connections'] = {};
  for (const [from, conn] of Object.entries(wf.connections ?? {})) {
    const main = (conn.main ?? []).map(branch =>
      (branch ?? []).filter(e => e && e.node)
    ).filter(branch => branch.length > 0);
    if (main.length > 0) connections[from] = { main };
  }

  return {
    name:        wf.name || 'Generated Workflow',
    nodes,
    connections,
    active:      false,
    settings:    wf.settings ?? {},
    tags:        wf.tags ?? [],
  };
}

function deepClean(obj: unknown): unknown {
  if (obj === null || obj === undefined) return undefined;
  if (Array.isArray(obj)) return obj.map(deepClean).filter(v => v !== undefined);
  if (typeof obj === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const c = deepClean(v);
      if (c !== undefined) cleaned[k] = c;
    }
    return cleaned;
  }
  return obj;
}
