# SemantiCanvas Electron Packaging

## Specification for Claude Code Implementation

**Date:** December 31, 2024  
**Phase:** Electron Desktop App  
**Estimated Effort:** 3-4 days

---

## Overview

Package SemantiCanvas as a standalone desktop application with:
- Native file system access for automatic MCP sync
- System-wide global hotkeys (Quick Capture from anywhere)
- Tray icon with context menu
- Auto-start on login option
- Cross-platform support (Windows, macOS, Linux)

---

## Architecture Decision

### Approach: electron-vite-react Template

Use the `electron-vite` ecosystem which provides:
- Vite for both main and renderer processes
- Hot reload in development
- Proper TypeScript support
- electron-builder for packaging

### Project Structure Transformation

```
semanticanvas/
├── electron/                    # NEW: Electron main process
│   ├── main.ts                  # Main entry point
│   ├── preload.ts               # Preload script (IPC bridge)
│   ├── ipc/
│   │   ├── index.ts             # IPC handler registration
│   │   ├── fileSystem.ts        # File system operations
│   │   ├── settings.ts          # App settings (auto-launch, etc.)
│   │   └── tray.ts              # Tray menu handlers
│   └── utils/
│       ├── autoLaunch.ts        # Auto-start functionality
│       └── globalShortcuts.ts   # System-wide shortcuts
├── src/                         # Existing React app (renderer)
│   ├── ... (existing files)
│   └── lib/
│       └── electron.ts          # NEW: IPC client wrapper
├── mcp-server/                  # Existing MCP server
├── resources/                   # NEW: App icons & assets
│   ├── icon.ico                 # Windows icon
│   ├── icon.icns                # macOS icon
│   ├── icon.png                 # Linux icon (256x256)
│   └── tray-icon.png            # Tray icon (16x16 or 22x22)
├── electron-builder.json5       # NEW: Build configuration
├── electron.vite.config.ts      # NEW: Electron Vite config
└── package.json                 # Updated with electron deps
```

---

## Key Features

### 1. Native File System Sync

Automatic bidirectional sync between app and `~/.semanticanvas/`:

```typescript
// electron/ipc/fileSystem.ts
import { ipcMain } from 'electron';
import { readFileSync, writeFileSync, existsSync, mkdirSync, watch } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const DATA_DIR = join(homedir(), '.semanticanvas');
const NOTES_FILE = join(DATA_DIR, 'notes.json');
const PENDING_FILE = join(DATA_DIR, 'pending.json');

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// Export notes for MCP server
ipcMain.handle('fs:exportNotes', async (_, notes: any) => {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    notes
  };
  writeFileSync(NOTES_FILE, JSON.stringify(data, null, 2));
  return { success: true, path: NOTES_FILE };
});

// Import pending notes from MCP server
ipcMain.handle('fs:importPending', async () => {
  if (!existsSync(PENDING_FILE)) {
    return { notes: [] };
  }
  const data = JSON.parse(readFileSync(PENDING_FILE, 'utf-8'));
  // Clear pending after import
  writeFileSync(PENDING_FILE, JSON.stringify({ version: 1, notes: [] }));
  return data;
});

// Watch for external changes to pending.json
export function watchPendingFile(callback: () => void) {
  if (existsSync(DATA_DIR)) {
    watch(PENDING_FILE, (eventType) => {
      if (eventType === 'change') {
        callback();
      }
    });
  }
}
```

### 2. Global Shortcuts

System-wide hotkeys that work even when app is minimized:

```typescript
// electron/utils/globalShortcuts.ts
import { globalShortcut, BrowserWindow } from 'electron';

export function registerGlobalShortcuts(mainWindow: BrowserWindow) {
  // Quick Capture: Cmd/Ctrl+Shift+N (global)
  globalShortcut.register('CommandOrControl+Shift+N', () => {
    // Show window if hidden
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
    // Focus window
    mainWindow.focus();
    // Send message to renderer to open Quick Capture modal
    mainWindow.webContents.send('shortcut:quickCapture');
  });

  // Search: Cmd/Ctrl+Shift+K (global, different from in-app Cmd+K)
  globalShortcut.register('CommandOrControl+Shift+K', () => {
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
    mainWindow.focus();
    mainWindow.webContents.send('shortcut:search');
  });
}

export function unregisterGlobalShortcuts() {
  globalShortcut.unregisterAll();
}
```

### 3. Tray Icon

System tray icon with context menu:

```typescript
// electron/ipc/tray.ts
import { Tray, Menu, nativeImage, app, BrowserWindow } from 'electron';
import { join } from 'path';

let tray: Tray | null = null;

export function createTray(mainWindow: BrowserWindow) {
  const iconPath = join(__dirname, '../../resources/tray-icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  
  tray = new Tray(icon);
  tray.setToolTip('SemantiCanvas');
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open SemantiCanvas',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      }
    },
    {
      label: 'Quick Capture',
      accelerator: 'CommandOrControl+Shift+N',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('shortcut:quickCapture');
      }
    },
    {
      label: 'Search Notes',
      accelerator: 'CommandOrControl+Shift+K',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('shortcut:search');
      }
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('open:settings');
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
  
  // Click tray icon to show/hide window
  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
  
  return tray;
}
```

### 4. Auto-Launch on Startup

Using `auto-launch` package:

```typescript
// electron/utils/autoLaunch.ts
import AutoLaunch from 'auto-launch';
import { app } from 'electron';

const autoLauncher = new AutoLaunch({
  name: 'SemantiCanvas',
  isHidden: true // Start minimized to tray
});

export async function isAutoLaunchEnabled(): Promise<boolean> {
  return autoLauncher.isEnabled();
}

export async function setAutoLaunch(enabled: boolean): Promise<void> {
  const isEnabled = await autoLauncher.isEnabled();
  if (enabled && !isEnabled) {
    await autoLauncher.enable();
  } else if (!enabled && isEnabled) {
    await autoLauncher.disable();
  }
}

// Check if app was opened at login (to start minimized)
export function wasOpenedAtLogin(): boolean {
  return app.getLoginItemSettings().wasOpenedAtLogin;
}
```

### 5. Settings Panel (IPC)

```typescript
// electron/ipc/settings.ts
import { ipcMain } from 'electron';
import Store from 'electron-store';
import { setAutoLaunch, isAutoLaunchEnabled } from '../utils/autoLaunch';

const store = new Store({
  defaults: {
    autoLaunch: false,
    minimizeToTray: true,
    globalShortcuts: true,
    syncInterval: 30 // seconds
  }
});

ipcMain.handle('settings:get', async (_, key: string) => {
  return store.get(key);
});

ipcMain.handle('settings:set', async (_, key: string, value: any) => {
  store.set(key, value);
  
  // Handle special settings
  if (key === 'autoLaunch') {
    await setAutoLaunch(value);
  }
  
  return true;
});

ipcMain.handle('settings:getAll', async () => {
  return store.store;
});
```

---

## Main Process Entry Point

```typescript
// electron/main.ts
import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { registerGlobalShortcuts, unregisterGlobalShortcuts } from './utils/globalShortcuts';
import { createTray } from './ipc/tray';
import { wasOpenedAtLogin } from './utils/autoLaunch';
import './ipc/fileSystem';
import './ipc/settings';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false, // Don't show until ready
    icon: join(__dirname, '../resources/icon.png'),
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  // Load the app
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'));
  }

  // Show window when ready (unless auto-launched)
  mainWindow.once('ready-to-show', () => {
    if (!wasOpenedAtLogin()) {
      mainWindow?.show();
    }
  });

  // Minimize to tray instead of closing
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  // Register global shortcuts
  registerGlobalShortcuts(mainWindow);

  // Create tray icon
  createTray(mainWindow);
}

// Single instance lock
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

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  (app as any).isQuitting = true;
});

app.on('will-quit', () => {
  unregisterGlobalShortcuts();
});
```

---

## Preload Script (IPC Bridge)

```typescript
// electron/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // File System
  exportNotes: (notes: any) => ipcRenderer.invoke('fs:exportNotes', notes),
  importPending: () => ipcRenderer.invoke('fs:importPending'),
  
  // Settings
  getSetting: (key: string) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key: string, value: any) => ipcRenderer.invoke('settings:set', key, value),
  getAllSettings: () => ipcRenderer.invoke('settings:getAll'),
  
  // Events from main process
  onQuickCapture: (callback: () => void) => {
    ipcRenderer.on('shortcut:quickCapture', callback);
    return () => ipcRenderer.removeListener('shortcut:quickCapture', callback);
  },
  onSearch: (callback: () => void) => {
    ipcRenderer.on('shortcut:search', callback);
    return () => ipcRenderer.removeListener('shortcut:search', callback);
  },
  onOpenSettings: (callback: () => void) => {
    ipcRenderer.on('open:settings', callback);
    return () => ipcRenderer.removeListener('open:settings', callback);
  },
  onPendingImport: (callback: () => void) => {
    ipcRenderer.on('pending:import', callback);
    return () => ipcRenderer.removeListener('pending:import', callback);
  },
  
  // Platform info
  platform: process.platform,
  isElectron: true
});
```

---

## Renderer Integration

```typescript
// src/lib/electron.ts
declare global {
  interface Window {
    electronAPI?: {
      exportNotes: (notes: any) => Promise<{ success: boolean; path: string }>;
      importPending: () => Promise<{ notes: any[] }>;
      getSetting: (key: string) => Promise<any>;
      setSetting: (key: string, value: any) => Promise<boolean>;
      getAllSettings: () => Promise<Record<string, any>>;
      onQuickCapture: (callback: () => void) => () => void;
      onSearch: (callback: () => void) => () => void;
      onOpenSettings: (callback: () => void) => () => void;
      onPendingImport: (callback: () => void) => () => void;
      platform: string;
      isElectron: boolean;
    };
  }
}

export const isElectron = (): boolean => {
  return !!window.electronAPI?.isElectron;
};

export const electronAPI = window.electronAPI;
```

Update App.tsx to listen for global shortcuts:

```typescript
// In App.tsx, add useEffect:
useEffect(() => {
  if (!window.electronAPI) return;
  
  const unsubQuickCapture = window.electronAPI.onQuickCapture(() => {
    setShowQuickCapture(true);
  });
  
  const unsubSearch = window.electronAPI.onSearch(() => {
    setShowSearch(true);
  });
  
  return () => {
    unsubQuickCapture();
    unsubSearch();
  };
}, []);
```

---

## Build Configuration

### electron-builder.json5

```json5
{
  "$schema": "https://raw.githubusercontent.com/electron-userland/electron-builder/master/packages/app-builder-lib/scheme.json",
  "appId": "com.semanticanvas.app",
  "productName": "SemantiCanvas",
  "directories": {
    "output": "release"
  },
  "files": [
    "dist/**/*",
    "electron/**/*",
    "resources/**/*"
  ],
  "win": {
    "target": ["nsis", "portable"],
    "icon": "resources/icon.ico"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true
  },
  "mac": {
    "target": ["dmg", "zip"],
    "icon": "resources/icon.icns",
    "category": "public.app-category.productivity"
  },
  "linux": {
    "target": ["AppImage", "deb"],
    "icon": "resources/icon.png",
    "category": "Office"
  }
}
```

### electron.vite.config.ts

```typescript
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/main.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/preload.ts')
        }
      }
    }
  },
  renderer: {
    root: '.',
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'index.html')
        }
      }
    },
    plugins: [react()]
  }
});
```

### package.json Updates

```json
{
  "name": "semanticanvas",
  "version": "1.0.0",
  "main": "dist-electron/main.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "package": "electron-vite build && electron-builder",
    "package:win": "electron-vite build && electron-builder --win",
    "package:mac": "electron-vite build && electron-builder --mac",
    "package:linux": "electron-vite build && electron-builder --linux"
  },
  "dependencies": {
    // ... existing deps
    "auto-launch": "^5.0.6",
    "electron-store": "^8.1.0"
  },
  "devDependencies": {
    // ... existing deps
    "electron": "^28.0.0",
    "electron-builder": "^24.9.1",
    "electron-vite": "^2.0.0"
  }
}
```

---

## Implementation Steps

### Step 1: Install Electron Dependencies

```bash
cd C:\Projects\LeuCanvas-1
npm install electron electron-vite electron-builder auto-launch electron-store -D
npm install auto-launch electron-store
```

### Step 2: Create Electron Directory Structure

```bash
mkdir -p electron/ipc electron/utils resources
```

### Step 3: Create Core Files

1. `electron/main.ts` - Main process entry
2. `electron/preload.ts` - IPC bridge
3. `electron/ipc/fileSystem.ts` - File operations
4. `electron/ipc/settings.ts` - Settings management
5. `electron/ipc/tray.ts` - Tray icon
6. `electron/utils/globalShortcuts.ts` - Global hotkeys
7. `electron/utils/autoLaunch.ts` - Auto-start

### Step 4: Create Config Files

1. `electron-builder.json5`
2. `electron.vite.config.ts`
3. Update `package.json`

### Step 5: Update Renderer

1. Create `src/lib/electron.ts` - IPC client wrapper
2. Update `App.tsx` - Listen for global shortcuts
3. Add auto-export on canvas changes
4. Add import from pending on app start

### Step 6: Create App Icons

- `resources/icon.ico` (256x256, Windows)
- `resources/icon.icns` (512x512, macOS)
- `resources/icon.png` (256x256, Linux)
- `resources/tray-icon.png` (16x16 or 22x22)

### Step 7: Test & Build

```bash
# Development
npm run dev

# Build for current platform
npm run package

# Build for specific platform
npm run package:win
```

---

## Auto-Sync Behavior

### On App Start
1. Check for `~/.semanticanvas/pending.json`
2. Import any notes created by MCP server
3. Clear pending file after import

### On Canvas Change (Debounced)
1. Collect all IdeaCards from canvas
2. Export to `~/.semanticanvas/notes.json`
3. MCP server can read updated notes

### File Watcher (Optional Enhancement)
1. Watch `pending.json` for changes
2. Auto-import when MCP creates new notes
3. Show notification to user

---

## Settings Panel UI

Add a new settings component:

```typescript
// src/components/SettingsPanel.tsx
interface Settings {
  autoLaunch: boolean;
  minimizeToTray: boolean;
  globalShortcuts: boolean;
  syncInterval: number;
}

// Settings:
// - [ ] Launch at startup
// - [ ] Minimize to tray when closed
// - [ ] Enable global shortcuts
// - Sync interval: [dropdown: 10s, 30s, 60s, manual]
```

---

## Deliverables Checklist

- [ ] Electron main process with proper window management
- [ ] Preload script with IPC bridge
- [ ] File system sync (export notes, import pending)
- [ ] Global shortcuts (Cmd+Shift+N, Cmd+Shift+K)
- [ ] Tray icon with context menu
- [ ] Auto-launch on startup (optional, configurable)
- [ ] Minimize to tray behavior
- [ ] Single instance enforcement
- [ ] Settings panel with electron-specific options
- [ ] App icons for all platforms
- [ ] electron-builder configuration
- [ ] Working dev mode with hot reload
- [ ] Built installer for Windows (.exe)

---

## Success Criteria

1. App launches and shows tldraw canvas
2. Global Cmd+Shift+N opens Quick Capture from anywhere
3. Closing window minimizes to tray
4. Tray icon shows with working context menu
5. Notes auto-export to `~/.semanticanvas/notes.json`
6. MCP server can read the exported notes
7. App can build to installable .exe/.dmg/.AppImage
8. Auto-launch option works on Windows

---

*This specification provides Claude Code with everything needed to package SemantiCanvas as an Electron desktop application.*
