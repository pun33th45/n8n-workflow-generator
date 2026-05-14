/**
 * Node Registry — every entry is a verified, execution-safe n8n node template.
 * Builders take simplified params from the LLM plan and return complete, valid n8n JSON.
 * The LLM never touches raw n8n schema details.
 */
import { randomUUID } from 'crypto';
import type { N8nNode } from './n8n-types';

export type SimpleParams = Record<string, unknown>;
export type NodeBuilder = (
  id: string,
  label: string,
  position: [number, number],
  params: SimpleParams
) => N8nNode;

// ── Helpers ───────────────────────────────────────────────────────────────────

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}
function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// ── Trigger nodes ─────────────────────────────────────────────────────────────

const manualTrigger: NodeBuilder = (id, label, position) => ({
  id,
  name: label,
  type: 'n8n-nodes-base.manualTrigger',
  typeVersion: 1,
  position,
  parameters: {},
});

const scheduleTrigger: NodeBuilder = (id, label, position, p) => {
  let interval: object[];

  if (p['cron']) {
    interval = [{ field: 'cronExpression', expression: str(p['cron'], '0 9 * * *') }];
  } else if (p['every'] || p['interval']) {
    const amount = num(p['every'] ?? p['interval'], 1);
    const unit = str(p['unit'], 'hours');
    const fieldMap: Record<string, string> = {
      seconds: 'seconds', minutes: 'minutes', hours: 'hours', days: 'days', weeks: 'weeks',
    };
    const field = fieldMap[unit] ?? 'hours';
    interval = [{ field, [`${field}Interval`]: amount }];
  } else {
    // Parse human hints like "every day at 8 AM"
    interval = [{ field: 'cronExpression', expression: '0 9 * * *' }];
  }

  return {
    id, name: label,
    type: 'n8n-nodes-base.scheduleTrigger',
    typeVersion: 1.2,
    position,
    parameters: { rule: { interval } },
  };
};

const webhook: NodeBuilder = (id, label, position, p) => ({
  id, name: label,
  type: 'n8n-nodes-base.webhook',
  typeVersion: 2,
  position,
  parameters: {
    httpMethod: str(p['method'], 'POST').toUpperCase(),
    path: str(p['path'], 'webhook'),
    authentication: 'none',
    responseMode: 'onReceived',
    options: {},
  },
});

// ── Action nodes ──────────────────────────────────────────────────────────────

const httpRequest: NodeBuilder = (id, label, position, p) => {
  const base: Record<string, unknown> = {
    method: str(p['method'], 'GET').toUpperCase(),
    url: str(p['url'], 'https://example.com'),
    authentication: 'none',
    options: {},
  };

  if (p['body']) {
    base['sendBody'] = true;
    base['contentType'] = 'json';
    base['specifyBody'] = 'json';
    base['jsonBody'] = typeof p['body'] === 'string' ? p['body'] : JSON.stringify(p['body']);
  }
  if (p['headers']) {
    base['sendHeaders'] = true;
    base['headerParameters'] = {
      parameters: Object.entries(p['headers'] as Record<string, string>).map(([name, value]) => ({ name, value })),
    };
  }

  return {
    id, name: label,
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position,
    parameters: base,
  };
};

const setNode: NodeBuilder = (id, label, position, p) => {
  const data = (p['data'] ?? p['fields'] ?? p['values'] ?? {}) as Record<string, unknown>;

  const assignments = Object.entries(data).map(([name, value]) => ({
    id: randomUUID(),
    name,
    value,
    type: typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string',
  }));

  return {
    id, name: label,
    type: 'n8n-nodes-base.set',
    typeVersion: 3.4,
    position,
    parameters: {
      assignments: { assignments },
      options: {},
    },
  };
};

const codeNode: NodeBuilder = (id, label, position, p) => ({
  id, name: label,
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position,
  parameters: {
    language: 'javaScript',
    jsCode: str(p['code'] ?? p['jsCode'], 'return items;'),
  },
});

const ifNode: NodeBuilder = (id, label, position, p) => {
  const opMap: Record<string, { type: string; operation: string }> = {
    equals:      { type: 'string', operation: 'equals' },
    notEquals:   { type: 'string', operation: 'notEquals' },
    contains:    { type: 'string', operation: 'contains' },
    startsWith:  { type: 'string', operation: 'startsWith' },
    endsWith:    { type: 'string', operation: 'endsWith' },
    isEmpty:     { type: 'string', operation: 'isEmpty' },
    isNotEmpty:  { type: 'string', operation: 'isNotEmpty' },
    gt:          { type: 'number', operation: 'gt' },
    gte:         { type: 'number', operation: 'gte' },
    lt:          { type: 'number', operation: 'lt' },
    lte:         { type: 'number', operation: 'lte' },
  };
  const op = opMap[str(p['operator'], 'equals')] ?? opMap['equals'];

  return {
    id, name: label,
    type: 'n8n-nodes-base.if',
    typeVersion: 2,
    position,
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [{
          id: randomUUID(),
          leftValue: str(p['left'], '={{ $json.value }}'),
          rightValue: p['right'] ?? '',
          operator: op,
        }],
        combinator: 'and',
      },
      options: {},
    },
  };
};

const switchNode: NodeBuilder = (id, label, position, p) => {
  const rules = (p['rules'] as Array<{ value: unknown; output: number }> | undefined) ?? [];
  return {
    id, name: label,
    type: 'n8n-nodes-base.switch',
    typeVersion: 3,
    position,
    parameters: {
      mode: 'rules',
      matchType: 'any',
      rules: {
        values: rules.map((r, i) => ({
          conditions: {
            options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
            conditions: [{
              id: randomUUID(),
              leftValue: str(p['on'], '={{ $json.value }}'),
              rightValue: r.value,
              operator: { type: 'string', operation: 'equals' },
            }],
            combinator: 'and',
          },
          renameOutput: false,
          outputKey: String(r.output ?? i),
        })),
      },
      fallbackOutput: 'none',
      options: {},
    },
  };
};

const mergeNode: NodeBuilder = (id, label, position, p) => ({
  id, name: label,
  type: 'n8n-nodes-base.merge',
  typeVersion: 3,
  position,
  parameters: {
    mode: str(p['mode'], 'append'),
    options: {},
  },
});

const waitNode: NodeBuilder = (id, label, position, p) => ({
  id, name: label,
  type: 'n8n-nodes-base.wait',
  typeVersion: 1.1,
  position,
  parameters: {
    unit: str(p['unit'], 'seconds'),
    amount: num(p['amount'] ?? p['seconds'], 30),
  },
});

const noOpNode: NodeBuilder = (id, label, position) => ({
  id, name: label,
  type: 'n8n-nodes-base.noOp',
  typeVersion: 1,
  position,
  parameters: {},
});

// ── Messaging nodes ───────────────────────────────────────────────────────────

const gmail: NodeBuilder = (id, label, position, p) => ({
  id, name: label,
  type: 'n8n-nodes-base.gmail',
  typeVersion: 2.1,
  position,
  parameters: {
    resource: 'message',
    operation: 'send',
    sendTo: str(p['to'] ?? p['sendTo'], 'recipient@example.com'),
    subject: str(p['subject'], 'Automated Email'),
    emailType: 'text',
    message: str(p['body'] ?? p['message'] ?? p['text'], 'Email body'),
  },
});

const emailSend: NodeBuilder = (id, label, position, p) => ({
  id, name: label,
  type: 'n8n-nodes-base.emailSend',
  typeVersion: 2.1,
  position,
  parameters: {
    fromEmail: str(p['from'] ?? p['fromEmail'], 'sender@example.com'),
    toEmail: str(p['to'] ?? p['toEmail'], 'recipient@example.com'),
    subject: str(p['subject'], 'Automated Email'),
    text: str(p['body'] ?? p['text'], 'Email body'),
  },
});

const slack: NodeBuilder = (id, label, position, p) => ({
  id, name: label,
  type: 'n8n-nodes-base.slack',
  typeVersion: 2.3,
  position,
  parameters: {
    resource: 'message',
    operation: 'post',
    select: 'channel',
    channelId: {
      __rl: true,
      value: str(p['channel'] ?? p['channelId'], '#general'),
      mode: 'name',
    },
    text: str(p['text'] ?? p['message'], 'Automated message'),
    otherOptions: {},
  },
});

const telegram: NodeBuilder = (id, label, position, p) => ({
  id, name: label,
  type: 'n8n-nodes-base.telegram',
  typeVersion: 1.2,
  position,
  parameters: {
    resource: 'message',
    operation: 'sendMessage',
    chatId: str(p['chatId'] ?? p['chat_id'], '={{ $json.chatId }}'),
    text: str(p['text'] ?? p['message'], 'Automated message'),   // MUST be "text" not "message"
    additionalFields: {},
  },
});

const discord: NodeBuilder = (id, label, position, p) => ({
  id, name: label,
  type: 'n8n-nodes-base.discord',
  typeVersion: 2,
  position,
  parameters: {
    resource: 'message',
    operation: 'send',
    guildId: { __rl: true, value: str(p['guildId'], 'GUILD_ID'), mode: 'id' },
    channelId: { __rl: true, value: str(p['channelId'] ?? p['channel'], 'CHANNEL_ID'), mode: 'id' },
    content: str(p['content'] ?? p['message'] ?? p['text'], 'Automated message'),
    options: {},
  },
});

// ── Data nodes ────────────────────────────────────────────────────────────────

const googleSheets: NodeBuilder = (id, label, position, p) => {
  const operation = str(p['operation'], 'append');
  const base: Record<string, unknown> = {
    resource: 'sheet',
    operation,
    documentId: { __rl: true, value: str(p['sheetId'] ?? p['documentId'], 'SHEET_ID'), mode: 'id' },
    sheetName: { __rl: true, value: str(p['sheetName'] ?? 'gid=0'), mode: 'id' },
    options: {},
  };

  if (operation === 'append') {
    base['columns'] = { mappingMode: 'autoMapInputData', value: {} };
  } else if (operation === 'read') {
    base['filtersUI'] = { values: [] };
  }

  return { id, name: label, type: 'n8n-nodes-base.googleSheets', typeVersion: 4.5, position, parameters: base };
};

const notion: NodeBuilder = (id, label, position, p) => {
  const operation = str(p['operation'], 'create');
  return {
    id, name: label,
    type: 'n8n-nodes-base.notion',
    typeVersion: 2.2,
    position,
    parameters: {
      resource: 'databasePage',
      operation,
      databaseId: { __rl: true, value: str(p['databaseId'], 'DATABASE_ID'), mode: 'id' },
      title: str(p['title'] ?? p['name'], '={{ $json.title }}'),
      propertiesUi: { propertyValues: [] },
    },
  };
};

const airtable: NodeBuilder = (id, label, position, p) => {
  const operation = str(p['operation'], 'create');
  return {
    id, name: label,
    type: 'n8n-nodes-base.airtable',
    typeVersion: 2.1,
    position,
    parameters: {
      resource: 'record',
      operation,
      base: { __rl: true, value: str(p['baseId'] ?? p['base'], 'BASE_ID'), mode: 'id' },
      table: { __rl: true, value: str(p['tableId'] ?? p['table'], 'TABLE_ID'), mode: 'id' },
      fields: {
        fieldValues: Object.entries((p['data'] ?? p['fields'] ?? {}) as Record<string, unknown>).map(
          ([fieldId, fieldValue]) => ({ fieldId, fieldValue })
        ),
      },
    },
  };
};

// ── Registry ──────────────────────────────────────────────────────────────────

export const NODE_REGISTRY: Record<string, NodeBuilder> = {
  // Triggers
  manualTrigger,
  manual:          manualTrigger,
  scheduleTrigger,
  schedule:        scheduleTrigger,
  cron:            scheduleTrigger,
  webhook,

  // Logic
  httpRequest,
  http:            httpRequest,
  fetch:           httpRequest,
  set:             setNode,
  setField:        setNode,
  code:            codeNode,
  if:              ifNode,
  condition:       ifNode,
  switch:          switchNode,
  merge:           mergeNode,
  wait:            waitNode,
  noOp:            noOpNode,
  noop:            noOpNode,

  // Messaging
  gmail,
  email:           gmail,
  emailSend,
  smtp:            emailSend,
  slack,
  telegram,
  discord,

  // Data
  googleSheets,
  sheets:          googleSheets,
  notion,
  airtable,
};

/** All supported type aliases the LLM may use */
export const SUPPORTED_TYPES = Object.keys(NODE_REGISTRY);

/** Returns true if we have a builder for this type */
export function isSupported(type: string): boolean {
  return type in NODE_REGISTRY;
}

/** Build a node. Falls back to noOp with descriptive label if type unknown. */
export function buildNode(
  plannedType: string,
  id: string,
  label: string,
  position: [number, number],
  params: SimpleParams
): { node: N8nNode; warning?: string } {
  const builder = NODE_REGISTRY[plannedType];
  if (builder) {
    return { node: builder(id, label, position, params) };
  }
  // Unknown type → noOp placeholder so the workflow still imports
  return {
    node: noOpNode(id, `[Unsupported: ${label}]`, position, {}),
    warning: `Node type "${plannedType}" is not in the registry — replaced with NoOp. Supported: ${SUPPORTED_TYPES.join(', ')}.`,
  };
}
