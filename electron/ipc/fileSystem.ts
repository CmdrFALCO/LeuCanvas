import { ipcMain } from 'electron';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const DATA_DIR = join(homedir(), '.semanticanvas');
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
