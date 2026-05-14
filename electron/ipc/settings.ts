import { ipcMain, app, shell } from 'electron';
import {
  setApiKey, hasApiKey, getProvider, clearApiKey,
  getTheme, setTheme, getHistory, clearHistory,
} from '../storage/keystore';
import type { AIProvider } from '../../lib/ipc-types';

// Format-only validation — no live API calls so quota is never consumed on save
function validate(provider: AIProvider, key: string): void {
  const k = key.trim();
  switch (provider) {
    case 'gemini':
      if (!/^AIza[A-Za-z0-9_-]{35}$/.test(k))
        throw new Error('Invalid Gemini key. Should start with "AIza" and be 39 characters (get one at aistudio.google.com).');
      break;
    case 'openai':
      if (!/^sk-[A-Za-z0-9_-]{20,}$/.test(k))
        throw new Error('Invalid OpenAI key. Should start with "sk-" (get one at platform.openai.com/api-keys).');
      break;
    case 'claude':
      if (!/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(k))
        throw new Error('Invalid Anthropic key. Should start with "sk-ant-" (get one at console.anthropic.com).');
      break;
    case 'groq':
      if (!/^gsk_[A-Za-z0-9]{20,}$/.test(k))
        throw new Error('Invalid Groq key. Should start with "gsk_" (get one free at console.groq.com).');
      break;
    default:
      throw new Error('Unknown provider');
  }
}

export function registerSettingsHandlers(): void {
  ipcMain.handle('ipc:has-api-key', () => hasApiKey());

  ipcMain.handle('ipc:save-api-key', (_e, provider: AIProvider, key: string) => {
    try {
      validate(provider, key);
      setApiKey(key, provider);
      return { valid: true };
    } catch (err: unknown) {
      return { valid: false, error: err instanceof Error ? err.message : 'Validation failed' };
    }
  });

  ipcMain.handle('ipc:validate-api-key', (_e, provider: AIProvider, key: string) => {
    try {
      validate(provider, key);
      return { valid: true };
    } catch (err: unknown) {
      return { valid: false, error: err instanceof Error ? err.message : 'Validation failed' };
    }
  });

  ipcMain.handle('ipc:get-settings', () => ({
    provider: getProvider() as AIProvider,
    hasApiKey: hasApiKey(),
    theme: getTheme(),
  }));

  ipcMain.handle('ipc:save-settings', (_e, settings: { provider?: AIProvider; theme?: string }) => {
    if (settings.theme) setTheme(settings.theme);
  });

  ipcMain.handle('ipc:clear-api-key', () => clearApiKey());

  ipcMain.handle('ipc:get-history', () => getHistory());

  ipcMain.handle('ipc:clear-history', () => clearHistory());

  ipcMain.handle('ipc:get-version', () => app.getVersion());

  ipcMain.handle('ipc:open-external', (_e, url: string) => shell.openExternal(url));
}
