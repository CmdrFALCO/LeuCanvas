#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  initEmbeddings,
  loadNotes,
  getNotes,
  getEmbeddings,
  generateEmbedding,
  addPendingNote,
} from './lib/storage.js';
import { findTopK } from './lib/similarity.js';

async function main() {
  console.error('SemantiCanvas MCP: Loading embedding model...');
  await initEmbeddings();

  console.error('SemantiCanvas MCP: Loading notes...');
  await loadNotes();

  const server = new McpServer({
    name: 'semanticanvas',
    version: '1.0.0',
  });

  // Tool: search_notes
  server.tool(
    'search_notes',
    {
      query: z.string().describe('Search query'),
      limit: z.number().optional().default(10).describe('Max results to return'),
      minSimilarity: z.number().optional().default(0.5).describe('Minimum similarity threshold (0-1)'),
    },
    async ({ query, limit, minSimilarity }) => {
      const queryEmbedding = await generateEmbedding(query);
      const results = findTopK(queryEmbedding, getEmbeddings(), limit ?? 10);
      const notes = getNotes();

      const filtered = results
        .filter((r) => r.similarity >= (minSimilarity ?? 0.5))
        .map((r) => {
          const note = notes.get(r.id)!;
          return {
            id: note.id,
            title: note.title,
            content: note.content,
            tags: note.tags,
            similarity: Math.round(r.similarity * 100) / 100,
          };
        });

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ results: filtered }, null, 2) }],
      };
    }
  );

  // Tool: create_note
  server.tool(
    'create_note',
    {
      title: z.string().optional().default('').describe('Note title'),
      content: z.string().describe('Note content'),
      tags: z.array(z.string()).optional().default([]).describe('Tags for the note'),
    },
    async ({ title, content, tags }) => {
      const text = `${title} ${content}`.trim();
      const embedding = await generateEmbedding(text);

      // Check for duplicates
      const similar = findTopK(embedding, getEmbeddings(), 1);
      const notes = getNotes();

      let duplicateWarning = null;
      if (similar.length > 0 && similar[0].similarity > 0.92) {
        const dupNote = notes.get(similar[0].id)!;
        duplicateWarning = {
          isDuplicate: true,
          similarNote: {
            id: dupNote.id,
            title: dupNote.title,
            similarity: Math.round(similar[0].similarity * 100) / 100,
          },
        };
      }

      const newNote = await addPendingNote({
        title: title ?? '',
        content,
        tags: tags ?? [],
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                id: newNote.id,
                title: newNote.title,
                content: newNote.content,
                createdAt: newNote.createdAt,
                duplicateWarning,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // Tool: get_note
  server.tool(
    'get_note',
    {
      id: z.string().describe('Note ID'),
    },
    async ({ id }) => {
      const note = getNotes().get(id);
      if (!note) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Note not found' }) }] };
      }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(note, null, 2) }],
      };
    }
  );

  // Tool: find_related
  server.tool(
    'find_related',
    {
      noteId: z.string().optional().describe('ID of note to find relations for'),
      text: z.string().optional().describe('Text to find related notes for'),
      limit: z.number().optional().default(5).describe('Max results to return'),
    },
    async ({ noteId, text, limit }) => {
      let queryEmbedding: number[];
      let excludeIds: string[] = [];

      if (noteId) {
        const embedding = getEmbeddings().get(noteId);
        if (!embedding) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Note not found' }) }] };
        }
        queryEmbedding = embedding;
        excludeIds = [noteId];
      } else if (text) {
        queryEmbedding = await generateEmbedding(text);
      } else {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Provide noteId or text' }) }],
        };
      }

      const results = findTopK(queryEmbedding, getEmbeddings(), limit ?? 5, excludeIds);
      const notes = getNotes();

      const relatedNotes = results.map((r) => {
        const note = notes.get(r.id)!;
        return {
          id: note.id,
          title: note.title,
          content: note.content,
          similarity: Math.round(r.similarity * 100) / 100,
        };
      });

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ relatedNotes }, null, 2) }],
      };
    }
  );

  // Tool: list_notes
  server.tool(
    'list_notes',
    {
      tags: z.array(z.string()).optional().describe('Filter by tags'),
      limit: z.number().optional().default(50).describe('Max results to return'),
      offset: z.number().optional().default(0).describe('Offset for pagination'),
    },
    async ({ tags, limit, offset }) => {
      let notesList = Array.from(getNotes().values());

      if (tags && tags.length > 0) {
        notesList = notesList.filter((n) => tags.some((tag) => n.tags.includes(tag)));
      }

      const total = notesList.length;
      const paginated = notesList.slice(offset ?? 0, (offset ?? 0) + (limit ?? 50));

      const results = paginated.map((n) => ({
        id: n.id,
        title: n.title,
        preview: n.content.slice(0, 100) + (n.content.length > 100 ? '...' : ''),
        tags: n.tags,
        createdAt: n.createdAt,
      }));

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ notes: results, total }, null, 2) }],
      };
    }
  );

  // Connect via stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('SemantiCanvas MCP Server running');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
