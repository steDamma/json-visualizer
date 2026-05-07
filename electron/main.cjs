/**
 * Electron main process — entry point for the desktop app.
 * Uses CommonJS because Electron's main process requires it.
 *
 * app.isPackaged:
 *   false → running via `npm run electron:dev` (loads Vite dev server)
 *   true  → running from installed/portable build (loads dist/index.html)
 */

const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');

const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      // No preload needed — the app uses only web APIs
    },
    title: 'JSON Visualizer',
    show: false, // Avoid white flash on startup
    backgroundColor: '#0d1117',
  });

  // Show window once fully loaded (avoids white flash)
  win.once('ready-to-show', () => win.show());

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Open external links in the system browser, not in Electron
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  buildMenu();
}

function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Apri file JSON…',
          accelerator: 'CmdOrCtrl+O',
          click: (_item, win) => win?.webContents.executeJavaScript(
            "document.getElementById('btn-open').click()"
          ),
        },
        {
          label: 'Salva',
          accelerator: 'CmdOrCtrl+S',
          click: (_item, win) => win?.webContents.executeJavaScript(
            "document.getElementById('btn-save').click()"
          ),
        },
        { type: 'separator' },
        { role: 'quit', label: 'Esci' },
      ],
    },
    {
      label: 'Modifica',
      submenu: [
        { role: 'undo',      label: 'Annulla' },
        { role: 'redo',      label: 'Ripristina' },
        { type: 'separator' },
        { role: 'cut',       label: 'Taglia' },
        { role: 'copy',      label: 'Copia' },
        { role: 'paste',     label: 'Incolla' },
        { role: 'selectAll', label: 'Seleziona tutto' },
      ],
    },
    {
      label: 'Visualizza',
      submenu: [
        {
          label: 'Formatta JSON',
          accelerator: 'CmdOrCtrl+Shift+F',
          click: (_item, win) => win?.webContents.executeJavaScript(
            "document.getElementById('btn-format').click()"
          ),
        },
        {
          label: 'Espandi tutto',
          click: (_item, win) => win?.webContents.executeJavaScript(
            "document.getElementById('btn-expand-all').click()"
          ),
        },
        {
          label: 'Comprimi tutto',
          click: (_item, win) => win?.webContents.executeJavaScript(
            "document.getElementById('btn-collapse-all').click()"
          ),
        },
        { type: 'separator' },
        { role: 'reload',         label: 'Ricarica' },
        { role: 'toggleDevTools', label: 'Strumenti sviluppatore' },
        { type: 'separator' },
        { role: 'resetZoom',      label: 'Zoom originale' },
        { role: 'zoomIn',         label: 'Zoom avanti' },
        { role: 'zoomOut',        label: 'Zoom indietro' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Schermo intero' },
      ],
    },
    {
      label: '?',
      submenu: [
        {
          label: `JSON Visualizer v${app.getVersion()}`,
          enabled: false,
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
