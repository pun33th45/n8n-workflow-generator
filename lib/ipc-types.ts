import type { N8nWorkflow } from './n8n-types';

export type AIProvider = 'gemini' | 'openai' | 'claude' | 'groq';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface GenerateResult {
  workflow?: N8nWorkflow;
  error?: string;
  warnings?: string[];
}

export interface AppSettings {
  provider: AIProvider;
  hasApiKey: boolean;
  theme: 'dark' | 'light';
}

export interface HistoryEntry {
  id: string;
  description: string;
  timestamp: number;
  nodeCount: number;
}

export interface ElectronAPI {
  generateWorkflow: (description: string) => Promise<GenerateResult>;
  hasApiKey: () => Promise<boolean>;
  saveApiKey: (provider: AIProvider, key: string) => Promise<ValidationResult>;
  validateApiKey: (provider: AIProvider, key: string) => Promise<ValidationResult>;
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: Partial<Pick<AppSettings, 'provider' | 'theme'>>) => Promise<void>;
  getHistory: () => Promise<HistoryEntry[]>;
  clearHistory: () => Promise<void>;
  getVersion: () => Promise<string>;
  openExternal: (url: string) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
