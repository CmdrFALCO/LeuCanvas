import { app, BrowserWindow, globalShortcut, Tray, Menu, nativeImage, ipcMain } from 'electron';
import { join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';

// Ensure data directory exists
const DATA_DIR = join(homedir(), '.semanticanvas');
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Load app - use app.isPackaged to detect dev mode
  const isDev = !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Minimize to tray instead of quit
  mainWindow.on('close', (event) => {
    if (!(app as any).isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  // Register global shortcuts
  registerShortcuts();

  // Create tray
  createTray();
}

function registerShortcuts() {
  // Global Quick Capture
  globalShortcut.register('CommandOrControl+Shift+N', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('shortcut:quickCapture');
    }
  });

  // Global Search
  globalShortcut.register('CommandOrControl+Shift+K', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('shortcut:search');
    }
  });
}

function createTray() {
  const iconPath = join(__dirname, '../../resources/tray-icon.png');

  // Create tray icon
  let icon;
  if (existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath);
  } else {
    // Create a 16x16 teal square icon as fallback (base64 PNG)
    // This is a simple teal (#14B8A6) colored square
    const tealIconBase64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAH0lEQVQ4y2NkYGD4z0ABYBw1YNSAUQNGDRg1gB4GAACZAAFPV8yqAAAAAElFTkSuQmCC';
    icon = nativeImage.createFromDataURL(`data:image/png;base64,${tealIconBase64}`);
  }

  tray = new Tray(icon);
  tray.setToolTip('SemantiCanvas');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      }
    },
    {
      label: 'Quick Capture',
      accelerator: 'CommandOrControl+Shift+N',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
        mainWindow?.webContents.send('shortcut:quickCapture');
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        (app as any).isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });
}

// Single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// IPC Handlers
const NOTES_FILE = join(DATA_DIR, 'notes.json');
const PENDING_FILE = join(DATA_DIR, 'pending.json');

// Export notes for MCP server
ipcMain.handle('fs:exportNotes', async (_, notes: any[]) => {
  try {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      notes
    };
    writeFileSync(NOTES_FILE, JSON.stringify(data, null, 2));
    return { success: true, path: NOTES_FILE };
  } catch (error) {
    console.error('Export error:', error);
    return { success: false, error: String(error) };
  }
});

// Import pending notes from MCP server
ipcMain.handle('fs:importPending', async () => {
  try {
    if (!existsSync(PENDING_FILE)) {
      return { notes: [] };
    }

    const content = readFileSync(PENDING_FILE, 'utf-8');
    const data = JSON.parse(content);

    // Clear pending after read
    if (data.notes && data.notes.length > 0) {
      writeFileSync(PENDING_FILE, JSON.stringify({ version: 1, notes: [] }));
    }

    return data;
  } catch (error) {
    console.error('Import error:', error);
    return { notes: [] };
  }
});
