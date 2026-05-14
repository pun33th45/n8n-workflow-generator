import { app, BrowserWindow, shell, net, protocol } from 'electron';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { registerWorkflowHandlers } from './ipc/workflow';
import { registerSettingsHandlers } from './ipc/settings';

const isDev = process.env.ELECTRON_DEV === 'true';
const DEV_PORT = process.env.NEXT_DEV_PORT ?? '3579';

// Must be called before app.whenReady()
if (!isDev) {
  protocol.registerSchemesAsPrivileged([
    { scheme: 'app', privileges: { secure: true, standard: true, supportFetchAPI: true } },
  ]);
}

let mainWindow: BrowserWindow | null = null;

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#0e0e10',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  win.once('ready-to-show', () => win.show());

  // Open all external links in the system browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    win.loadURL(`http://localhost:${DEV_PORT}`);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadURL('app://localhost/');
  }

  return win;
}

async function main(): Promise<void> {
  await app.whenReady();

  if (!isDev) {
    // Serve Next.js static export via custom protocol
    protocol.handle('app', (request) => {
      let urlPath = new URL(request.url).pathname;

      if (!urlPath || urlPath === '/') {
        urlPath = '/index.html';
      } else if (!path.extname(urlPath)) {
        // Route like /settings → /settings/index.html (trailingSlash: true)
        urlPath = urlPath.replace(/\/?$/, '/index.html');
      }

      const outDir = path.join(app.getAppPath(), 'out');
      const filePath = path.join(outDir, urlPath);
      return net.fetch(pathToFileURL(filePath).toString());
    });
  }

  registerWorkflowHandlers();
  registerSettingsHandlers();

  mainWindow = createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

main().catch(console.error);
