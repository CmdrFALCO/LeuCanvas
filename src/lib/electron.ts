// Type declarations
declare global {
  interface Window {
    electronAPI?: {
      exportNotes: (notes: any[]) => Promise<{ success: boolean; path?: string; error?: string }>;
      importPending: () => Promise<{ notes: any[] }>;
      onQuickCapture: (callback: () => void) => () => void;
      onSearch: (callback: () => void) => () => void;
      isElectron: boolean;
      platform: string;
    };
  }
}

export const isElectron = (): boolean => {
  return typeof window !== 'undefined' && !!window.electronAPI?.isElectron;
};

export const electronAPI = typeof window !== 'undefined' ? window.electronAPI : undefined;

// Export notes to file system (for MCP server)
export async function exportNotesForMCP(notes: any[]): Promise<boolean> {
  if (!electronAPI) return false;
  const result = await electronAPI.exportNotes(notes);
  return result.success;
}

// Import pending notes from MCP server
export async function importPendingNotes(): Promise<any[]> {
  if (!electronAPI) return [];
  const result = await electronAPI.importPending();
  return result.notes || [];
}
