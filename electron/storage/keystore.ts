import { safeStorage, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

interface HistoryItem {
  id: string;
  description: string;
  timestamp: number;
  nodeCount: number;
}

interface Store {
  encryptedKey?: string;
  provider?: string;
  theme?: string;
  history?: HistoryItem[];
}

function getStorePath(): string {
  const dir = path.join(app.getPath('userData'), 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'store.json');
}

function read(): Store {
  try {
    const p = getStorePath();
    if (!fs.existsSync(p)) return {};
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as Store;
  } catch {
    return {};
  }
}

function write(data: Store): void {
  fs.writeFileSync(getStorePath(), JSON.stringify(data, null, 2), 'utf-8');
}

export function getApiKey(): string | null {
  const data = read();
  if (!data.encryptedKey) return null;
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(data.encryptedKey, 'base64'));
    }
    // Fallback obfuscation for environments without OS keychain
    return Buffer.from(data.encryptedKey, 'base64').toString('utf-8');
  } catch {
    return null;
  }
}

export function setApiKey(key: string, provider: string): void {
  const data = read();
  data.encryptedKey = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(key).toString('base64')
    : Buffer.from(key).toString('base64');
  data.provider = provider;
  write(data);
}

export function hasApiKey(): boolean {
  return Boolean(read().encryptedKey);
}

export function getProvider(): string {
  return read().provider ?? 'gemini';
}

export function clearApiKey(): void {
  const data = read();
  delete data.encryptedKey;
  delete data.provider;
  write(data);
}

export function getTheme(): string {
  return read().theme ?? 'dark';
}

export function setTheme(theme: string): void {
  const data = read();
  data.theme = theme;
  write(data);
}

export function getHistory(): HistoryItem[] {
  return read().history ?? [];
}

export function addToHistory(entry: HistoryItem): void {
  const data = read();
  const existing = data.history ?? [];
  data.history = [entry, ...existing.filter(h => h.id !== entry.id)].slice(0, 20);
  write(data);
}

export function clearHistory(): void {
  const data = read();
  data.history = [];
  write(data);
}
