import { randomUUID } from 'crypto';
import type { N8nNode, N8nWorkflow } from './n8n-types';

// Correct typeVersions for modern n8n (1.x+)
const TYPE_VERSIONS: Record<string, number> = {
  'n8n-nodes-base.manualTrigger': 1,
  'n8n-nodes-base.webhook': 2,
  'n8n-nodes-base.scheduleTrigger': 1.2,
  'n8n-nodes-base.httpRequest': 4.2,
  'n8n-nodes-base.set': 3.4,
  'n8n-nodes-base.code': 2,
  'n8n-nodes-base.if': 2,
  'n8n-nodes-base.switch': 3,
  'n8n-nodes-base.merge': 3,
  'n8n-nodes-base.wait': 1.1,
  'n8n-nodes-base.splitInBatches': 3,
  'n8n-nodes-base.dateTime': 2,
  'n8n-nodes-base.gmail': 2.1,
  'n8n-nodes-base.emailSend': 2.1,
  'n8n-nodes-base.slack': 2.3,
  'n8n-nodes-base.telegram': 1.2,
  'n8n-nodes-base.notion': 2.2,
  'n8n-nodes-base.googleSheets': 4.5,
  'n8n-nodes-base.airtable': 2.1,
  'n8n-nodes-base.noOp': 1,
};

// ── Repair helpers ────────────────────────────────────────────────────────────

function repairScheduleTrigger(params: Record<string, unknown>): Record<string, unknown> {
  // Already correct: has rule.interval array
  const rule = params['rule'] as Record<string, unknown> | undefined;
  if (rule && Array.isArray(rule['interval'])) return params;

  // Detect old formats and normalise to rule.interval
  let expression = '';

  // Old: { "cronExpression": "0 8 * * *" }
  if (typeof params['cronExpression'] === 'string') {
    expression = params['cronExpression'];
  }
  // Old: { "triggerTimes": { "item": [{ "hour": 8, "minute": 0 }] } }
  else if (params['triggerTimes']) {
    const tt = params['triggerTimes'] as Record<string, unknown>;
    const items = tt['item'] as Array<Record<string, unknown>> | undefined;
    if (items?.[0]) {
      const h = (items[0]['hour'] as number) ?? 0;
      const m = (items[0]['minute'] as number) ?? 0;
      expression = `${m} ${h} * * *`;
    }
  }
  // Old: { "interval": 60, "unit": "minutes" }
  else if (typeof params['interval'] === 'number') {
    const unit = (params['unit'] as string) || 'minutes';
    const map: Record<string, string> = { minutes: 'minutes', hours: 'hours', days: 'days' };
    const field = map[unit] || 'minutes';
    return {
      rule: {
        interval: [{ field, [`${field}Interval`]: params['interval'] }],
      },
    };
  }

  if (expression) {
    return { rule: { interval: [{ field: 'cronExpression', expression }] } };
  }

  // Fallback: every day at 9 AM
  return { rule: { interval: [{ field: 'cronExpression', expression: '0 9 * * *' }] } };
}

function repairSetNode(params: Record<string, unknown>): Record<string, unknown> {
  // Already correct v3.4 schema
  if (params['assignments'] && typeof params['assignments'] === 'object') {
    const a = params['assignments'] as Record<string, unknown>;
    if (Array.isArray(a['assignments'])) return params;
  }

  const pairs: Array<{ name: string; value: unknown }> = [];

  // Old v1/v2: { values: { string: [{name, value}] } }
  const values = params['values'] as Record<string, unknown> | undefined;
  if (values) {
    // { values: { string: [{name,value}], number: [...] } }
    for (const [_type, arr] of Object.entries(values)) {
      if (Array.isArray(arr)) {
        for (const item of arr as Array<Record<string, unknown>>) {
          if (typeof item['name'] === 'string') {
            pairs.push({ name: item['name'], value: item['value'] ?? '' });
          }
        }
      } else if (typeof arr === 'string' || typeof arr === 'number') {
        // { values: { message: "hello" } } — hallucinated flat format
        pairs.push({ name: _type, value: arr });
      }
    }
  }

  // Old v3 fields.values format
  const fields = params['fields'] as Record<string, unknown> | undefined;
  if (fields && Array.isArray(fields['values'])) {
    for (const item of fields['values'] as Array<Record<string, unknown>>) {
      const name = item['name'] as string;
      const val = item['stringValue'] ?? item['numberValue'] ?? item['booleanValue'] ?? '';
      if (name) pairs.push({ name, value: val });
    }
  }

  // Flat top-level keys (hallucinated: { set: { message: "hello" } })
  if (pairs.length === 0) {
    for (const [k, v] of Object.entries(params)) {
      if (!['mode', 'options', 'include', 'assignments'].includes(k)) {
        pairs.push({ name: k, value: v });
      }
    }
  }

  return {
    assignments: {
      assignments: pairs.map(p => ({
        id: randomUUID(),
        name: p.name,
        value: p.value,
        type: typeof p.value === 'number' ? 'number' : typeof p.value === 'boolean' ? 'boolean' : 'string',
      })),
    },
    options: {},
  };
}

function repairTelegram(params: Record<string, unknown>): Record<string, unknown> {
  const fixed: Record<string, unknown> = { ...params };

  // Ensure resource + operation
  if (!fixed['resource']) fixed['resource'] = 'message';
  if (!fixed['operation']) fixed['operation'] = 'sendMessage';

  // `message` → `text`
  if (fixed['message'] !== undefined && fixed['text'] === undefined) {
    fixed['text'] = fixed['message'];
    delete fixed['message'];
  }
  // `content` → `text`
  if (fixed['content'] !== undefined && fixed['text'] === undefined) {
    fixed['text'] = fixed['content'];
    delete fixed['content'];
  }

  if (!fixed['additionalFields']) fixed['additionalFields'] = {};
  return fixed;
}

function repairHttpRequest(params: Record<string, unknown>): Record<string, unknown> {
  const fixed: Record<string, unknown> = { ...params };

  // Normalize method to uppercase
  if (typeof fixed['method'] === 'string') {
    fixed['method'] = (fixed['method'] as string).toUpperCase();
  } else {
    fixed['method'] = 'GET';
  }

  // `uri` → `url`
  if (fixed['uri'] !== undefined && fixed['url'] === undefined) {
    fixed['url'] = fixed['uri'];
    delete fixed['uri'];
  }

  if (!fixed['options']) fixed['options'] = {};
  if (!fixed['authentication']) fixed['authentication'] = 'none';

  return fixed;
}

function repairGmail(params: Record<string, unknown>): Record<string, unknown> {
  const fixed: Record<string, unknown> = { ...params };
  if (!fixed['resource']) fixed['resource'] = 'message';
  if (!fixed['operation']) fixed['operation'] = 'send';

  // `to` → `sendTo`
  if (fixed['to'] !== undefined && fixed['sendTo'] === undefined) {
    fixed['sendTo'] = fixed['to'];
    delete fixed['to'];
  }
  // `body` / `content` → `message`
  if (fixed['body'] !== undefined && fixed['message'] === undefined) {
    fixed['message'] = fixed['body'];
    delete fixed['body'];
  }
  if (!fixed['emailType']) fixed['emailType'] = 'text';
  return fixed;
}

function repairSlack(params: Record<string, unknown>): Record<string, unknown> {
  const fixed: Record<string, unknown> = { ...params };
  if (!fixed['resource']) fixed['resource'] = 'message';
  if (!fixed['operation']) fixed['operation'] = 'post';
  if (!fixed['select']) fixed['select'] = 'channel';

  // Normalise channel field
  const channel = fixed['channel'] ?? fixed['channelId'];
  if (channel !== undefined && typeof fixed['channelId'] !== 'object') {
    fixed['channelId'] = { __rl: true, value: channel, mode: 'name' };
    delete fixed['channel'];
  }

  // `message` → `text`
  if (fixed['message'] !== undefined && fixed['text'] === undefined) {
    fixed['text'] = fixed['message'];
    delete fixed['message'];
  }

  if (!fixed['otherOptions']) fixed['otherOptions'] = {};
  return fixed;
}

function repairWebhook(params: Record<string, unknown>): Record<string, unknown> {
  const fixed: Record<string, unknown> = { ...params };

  // `method` → `httpMethod`
  if (fixed['method'] !== undefined && fixed['httpMethod'] === undefined) {
    fixed['httpMethod'] = (fixed['method'] as string).toUpperCase();
    delete fixed['method'];
  }
  if (!fixed['httpMethod']) fixed['httpMethod'] = 'POST';
  if (!fixed['path']) fixed['path'] = 'webhook';
  if (!fixed['responseMode']) fixed['responseMode'] = 'onReceived';
  if (!fixed['authentication']) fixed['authentication'] = 'none';
  if (!fixed['options']) fixed['options'] = {};
  return fixed;
}

function repairIf(params: Record<string, unknown>): Record<string, unknown> {
  // Already has v2 conditions structure
  const cond = params['conditions'] as Record<string, unknown> | undefined;
  if (cond && Array.isArray(cond['conditions'])) {
    // Ensure all conditions have IDs
    const conditions = cond['conditions'] as Array<Record<string, unknown>>;
    cond['conditions'] = conditions.map(c => ({
      id: c['id'] ?? randomUUID(),
      ...c,
    }));
    if (!cond['combinator']) cond['combinator'] = 'and';
    if (!cond['options']) cond['options'] = { caseSensitive: true, leftValue: '', typeValidation: 'strict' };
    return { ...params, options: params['options'] ?? {} };
  }

  // Old v1 format or flat format — build a passthrough condition
  return {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
      conditions: [
        {
          id: randomUUID(),
          leftValue: '={{ $json.value }}',
          rightValue: '',
          operator: { type: 'string', operation: 'notEmpty' },
        },
      ],
      combinator: 'and',
    },
    options: {},
  };
}

function repairCode(params: Record<string, unknown>): Record<string, unknown> {
  const fixed: Record<string, unknown> = { ...params };
  // Old `functionCode` → `jsCode`
  if (fixed['functionCode'] !== undefined && fixed['jsCode'] === undefined) {
    fixed['jsCode'] = fixed['functionCode'];
    delete fixed['functionCode'];
  }
  if (!fixed['language']) fixed['language'] = 'javaScript';
  if (!fixed['jsCode']) fixed['jsCode'] = 'return items;';
  return fixed;
}

function repairEmailSend(params: Record<string, unknown>): Record<string, unknown> {
  const fixed: Record<string, unknown> = { ...params };
  // `to` → `toEmail`, `from` → `fromEmail`
  if (fixed['to'] && !fixed['toEmail']) { fixed['toEmail'] = fixed['to']; delete fixed['to']; }
  if (fixed['from'] && !fixed['fromEmail']) { fixed['fromEmail'] = fixed['from']; delete fixed['from']; }
  // `body` / `message` → `text`
  if (fixed['body'] && !fixed['text']) { fixed['text'] = fixed['body']; delete fixed['body']; }
  if (fixed['message'] && !fixed['text']) { fixed['text'] = fixed['message']; delete fixed['message']; }
  return fixed;
}

// ── Per-node repair dispatcher ────────────────────────────────────────────────

function repairNodeParams(type: string, params: Record<string, unknown>): Record<string, unknown> {
  switch (type) {
    case 'n8n-nodes-base.scheduleTrigger': return repairScheduleTrigger(params);
    case 'n8n-nodes-base.set':             return repairSetNode(params);
    case 'n8n-nodes-base.telegram':        return repairTelegram(params);
    case 'n8n-nodes-base.httpRequest':     return repairHttpRequest(params);
    case 'n8n-nodes-base.gmail':           return repairGmail(params);
    case 'n8n-nodes-base.slack':           return repairSlack(params);
    case 'n8n-nodes-base.webhook':         return repairWebhook(params);
    case 'n8n-nodes-base.if':              return repairIf(params);
    case 'n8n-nodes-base.code':            return repairCode(params);
    case 'n8n-nodes-base.emailSend':       return repairEmailSend(params);
    default:                               return params;
  }
}

// ── Deprecated node type migration ───────────────────────────────────────────

const TYPE_MIGRATIONS: Record<string, string> = {
  'n8n-nodes-base.function': 'n8n-nodes-base.code',
  'n8n-nodes-base.start': 'n8n-nodes-base.manualTrigger',
};

// ── Main repair export ────────────────────────────────────────────────────────

export function repairWorkflow(workflow: N8nWorkflow): N8nWorkflow {
  const usedIds = new Set<string>();

  const nodes: N8nNode[] = workflow.nodes.map((node, idx) => {
    // Migrate deprecated types
    let type = node.type;
    if (TYPE_MIGRATIONS[type]) type = TYPE_MIGRATIONS[type];

    // Ensure unique ID
    let id = node.id;
    if (!id || usedIds.has(id)) id = randomUUID();
    usedIds.add(id);

    // Ensure valid position
    const position: [number, number] = Array.isArray(node.position) && node.position.length === 2
      ? [Number(node.position[0]) || 250 + idx * 220, Number(node.position[1]) || 300]
      : [250 + idx * 220, 300];

    // Set correct typeVersion
    const typeVersion = TYPE_VERSIONS[type] ?? node.typeVersion ?? 1;

    // Repair parameters
    const params = (node.parameters && typeof node.parameters === 'object')
      ? node.parameters as Record<string, unknown>
      : {};
    const parameters = repairNodeParams(type, params);

    return { ...node, id, type, typeVersion, position, parameters };
  });

  // Validate connections reference existing node names
  const nodeNames = new Set(nodes.map(n => n.name));
  const connections: typeof workflow.connections = {};

  for (const [fromName, conn] of Object.entries(workflow.connections ?? {})) {
    if (!nodeNames.has(fromName)) continue;
    const main = (conn?.main ?? []).map(branch =>
      (branch ?? []).filter(c => nodeNames.has(c.node))
    );
    connections[fromName] = { main };
  }

  return {
    ...workflow,
    nodes,
    connections,
    active: false,
    settings: workflow.settings ?? {},
    tags: workflow.tags ?? [],
  };
}
