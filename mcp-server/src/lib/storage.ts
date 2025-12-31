import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { pipeline, type FeatureExtractionPipeline } from '@xenova/transformers';
import type { Note, NotesExport, PendingNote, PendingNotes } from '../types.js';

const DATA_DIR = join(homedir(), '.semanticanvas');
const NOTES_FILE = join(DATA_DIR, 'notes.json');
const PENDING_FILE = join(DATA_DIR, 'pending.json');

let embedder: FeatureExtractionPipeline | null = null;
const notes: Map<string, Note> = new Map();
const embeddings: Map<string, number[]> = new Map();

/**
 * Initialize the embedding model (Xenova/all-MiniLM-L6-v2)
 */
export async function initEmbeddings(): Promise<void> {
  embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
    quantized: true,
  }) as FeatureExtractionPipeline;
}

/**
 * Generate an embedding for the given text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!embedder) {
    throw new Error('Embedder not initialized. Call initEmbeddings() first.');
  }
  const output = await embedder(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data as Float32Array);
}

/**
 * Load notes from the JSON file and generate embeddings
 */
export async function loadNotes(): Promise<void> {
  // Ensure data directory exists
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  // Check if notes file exists
  if (!existsSync(NOTES_FILE)) {
    console.error(`No notes file found at ${NOTES_FILE}`);
    return;
  }

  try {
    const data: NotesExport = JSON.parse(readFileSync(NOTES_FILE, 'utf-8'));
    console.error(`Loading ${data.notes.length} notes from ${NOTES_FILE}`);

    for (const note of data.notes) {
      notes.set(note.id, note);

      // Use existing embedding or generate new one
      if (note.embedding && note.embedding.length > 0) {
        embeddings.set(note.id, note.embedding);
      } else {
        const text = `${note.title} ${note.content}`.trim();
        console.error(`Generating embedding for note: ${note.id}`);
        const embedding = await generateEmbedding(text);
        embeddings.set(note.id, embedding);
      }
    }

    console.error(`Loaded ${notes.size} notes with ${embeddings.size} embeddings`);
  } catch (error) {
    console.error('Error loading notes:', error);
  }
}

/**
 * Get all notes
 */
export function getNotes(): Map<string, Note> {
  return notes;
}

/**
 * Get all embeddings
 */
export function getEmbeddings(): Map<string, number[]> {
  return embeddings;
}

/**
 * Add a new note to the pending file for the browser app to import
 */
export async function addPendingNote(noteData: {
  title: string;
  content: string;
  tags: string[];
}): Promise<PendingNote> {
  // Generate unique ID
  const id = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const now = new Date().toISOString();

  const newNote: PendingNote = {
    id,
    title: noteData.title,
    content: noteData.content,
    tags: noteData.tags,
    createdAt: now,
  };

  // Load existing pending notes
  let pendingNotes: PendingNotes = {
    version: 1,
    notes: [],
  };

  if (existsSync(PENDING_FILE)) {
    try {
      pendingNotes = JSON.parse(readFileSync(PENDING_FILE, 'utf-8'));
    } catch {
      // If file is corrupted, start fresh
    }
  }

  // Add new note
  pendingNotes.notes.push(newNote);

  // Ensure data directory exists
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  // Save pending notes
  writeFileSync(PENDING_FILE, JSON.stringify(pendingNotes, null, 2));

  // Also add to in-memory store for immediate availability
  const fullNote: Note = {
    ...newNote,
    color: '#FEF3C7',
    x: 0,
    y: 0,
    width: 280,
    height: 180,
    embedding: null,
    updatedAt: now,
  };
  notes.set(id, fullNote);

  // Generate and store embedding
  const text = `${noteData.title} ${noteData.content}`.trim();
  const embedding = await generateEmbedding(text);
  embeddings.set(id, embedding);

  return newNote;
}
