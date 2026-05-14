import { contextBridge, ipcRenderer } from 'electron';
import type { AIProvider, ElectronAPI } from '../lib/ipc-types';

const api: ElectronAPI = {
  generateWorkflow: (description: string) =>
    ipcRenderer.invoke('ipc:generate-workflow', description),

  hasApiKey: () =>
    ipcRenderer.invoke('ipc:has-api-key'),

  saveApiKey: (provider: AIProvider, key: string) =>
    ipcRenderer.invoke('ipc:save-api-key', provider, key),

  validateApiKey: (provider: AIProvider, key: string) =>
    ipcRenderer.invoke('ipc:validate-api-key', provider, key),

  getSettings: () =>
    ipcRenderer.invoke('ipc:get-settings'),

  saveSettings: (settings) =>
    ipcRenderer.invoke('ipc:save-settings', settings),

  getHistory: () =>
    ipcRenderer.invoke('ipc:get-history'),

  clearHistory: () =>
    ipcRenderer.invoke('ipc:clear-history'),

  getVersion: () =>
    ipcRenderer.invoke('ipc:get-version'),

  openExternal: (url: string) =>
    ipcRenderer.invoke('ipc:open-external', url),
};

contextBridge.exposeInMainWorld('electronAPI', api);
