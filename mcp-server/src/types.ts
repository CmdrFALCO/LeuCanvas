export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  embedding: number[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotesExport {
  version: number;
  exportedAt: string;
  notes: Note[];
}

export interface PendingNote {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
}

export interface PendingNotes {
  version: number;
  notes: PendingNote[];
}
