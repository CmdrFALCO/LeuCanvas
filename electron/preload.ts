import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // File System
  exportNotes: (notes: any) => ipcRenderer.invoke('fs:exportNotes', notes),
  importPending: () => ipcRenderer.invoke('fs:importPending'),

  // Shortcuts from main
  onQuickCapture: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('shortcut:quickCapture', handler);
    return () => ipcRenderer.removeListener('shortcut:quickCapture', handler);
  },
  onSearch: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('shortcut:search', handler);
    return () => ipcRenderer.removeListener('shortcut:search', handler);
  },

  // Info
  isElectron: true,
  platform: process.platform
});
