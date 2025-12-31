# Claude Code Prompt: SemantiCanvas MCP Server

## Quick Context
SemantiCanvas is a local-first infinite canvas for semantic note-taking at `C:\Projects\LeuCanvas-1`. It stores notes in IndexedDB with embeddings from Transformers.js (all-MiniLM-L6-v2, 384 dims).

**Goal:** Create an MCP server so Claude Desktop can search, read, and create notes.

---

## Task 1: Initialize MCP Server Package

```
cd C:\Projects\LeuCanvas-1
mkdir mcp-server
cd mcp-server
npm init -y
npm install @modelcontextprotocol/sdk @xenova/transformers zod
npm install -D typescript @types/node tsx
```

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext", 
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

Update `package.json`:
```json
{
  "name": "semanticanvas-mcp",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "semanticanvas-mcp": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts"
  }
}
```

---

## Task 2: Create Core Files

### src/types.ts
```typescript
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

export interface PendingNotes {
  version: number;
  notes: Omit<Note, 'x' | 'y' | 'width' | 'height' | 'color' | 'embedding'>[];
}
```

### src/lib/storage.ts
- Read notes from `~/.semanticanvas/notes.json`
- Store embeddings in memory Map
- Generate embeddings for notes without them using Transformers.js
- Write new notes to `~/.semanticanvas/pending.json`

### src/lib/similarity.ts
```typescript
export function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function findTopK(
  queryEmbedding: number[],
  embeddings: Map<string, number[]>,
  k: number,
  excludeIds: string[] = []
): { id: string; similarity: number }[] {
  const results: { id: string; similarity: number }[] = [];
  
  for (const [id, embedding] of embeddings) {
    if (excludeIds.includes(id)) continue;
    results.push({ id, similarity: cosineSimilarity(queryEmbedding, embedding) });
  }
  
  return results.sort((a, b) => b.similarity - a.similarity).slice(0, k);
}
```

---

## Task 3: Implement MCP Server

### src/index.ts
```typescript
#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { initEmbeddings, loadNotes, getNotes, getEmbeddings, generateEmbedding, addPendingNote } from './lib/storage.js';
import { findTopK } from './lib/similarity.js';

async function main() {
  console.error('SemantiCanvas MCP: Loading embedding model...');
  await initEmbeddings();
  
  console.error('SemantiCanvas MCP: Loading notes...');
  await loadNotes();
  
  const server = new McpServer({
    name: 'semanticanvas',
    version: '1.0.0'
  });

  // Tool: search_notes
  server.registerTool(
    'search_notes',
    {
      title: 'Search Notes',
      description: 'Semantically search through your SemantiCanvas knowledge base',
      inputSchema: {
        query: z.string().describe('Search query'),
        limit: z.number().optional().default(10),
        minSimilarity: z.number().optional().default(0.5)
      }
    },
    async ({ query, limit, minSimilarity }) => {
      const queryEmbedding = await generateEmbedding(query);
      const results = findTopK(queryEmbedding, getEmbeddings(), limit || 10);
      const notes = getNotes();
      
      const filtered = results
        .filter(r => r.similarity >= (minSimilarity || 0.5))
        .map(r => {
          const note = notes.get(r.id)!;
          return {
            id: note.id,
            title: note.title,
            content: note.content,
            tags: note.tags,
            similarity: Math.round(r.similarity * 100) / 100
          };
        });
      
      return {
        content: [{ type: 'text', text: JSON.stringify({ results: filtered }, null, 2) }]
      };
    }
  );

  // Tool: create_note
  server.registerTool(
    'create_note',
    {
      title: 'Create Note',
      description: 'Create a new note in SemantiCanvas',
      inputSchema: {
        title: z.string().optional().default(''),
        content: z.string().describe('Note content'),
        tags: z.array(z.string()).optional().default([])
      }
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
            similarity: Math.round(similar[0].similarity * 100) / 100
          }
        };
      }

      const newNote = await addPendingNote({ title: title || '', content, tags: tags || [] });
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            id: newNote.id,
            title: newNote.title,
            content: newNote.content,
            createdAt: newNote.createdAt,
            duplicateWarning
          }, null, 2)
        }]
      };
    }
  );

  // Tool: get_note
  server.registerTool(
    'get_note',
    {
      title: 'Get Note',
      description: 'Get a specific note by ID',
      inputSchema: {
        id: z.string().describe('Note ID')
      }
    },
    async ({ id }) => {
      const note = getNotes().get(id);
      if (!note) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Note not found' }) }] };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(note, null, 2) }]
      };
    }
  );

  // Tool: find_related  
  server.registerTool(
    'find_related',
    {
      title: 'Find Related Notes',
      description: 'Find notes semantically related to a note or text',
      inputSchema: {
        noteId: z.string().optional(),
        text: z.string().optional(),
        limit: z.number().optional().default(5)
      }
    },
    async ({ noteId, text, limit }) => {
      let queryEmbedding: number[];
      let excludeIds: string[] = [];
      
      if (noteId) {
        const embedding = getEmbeddings().get(noteId);
        if (!embedding) {
          return { content: [{ type: 'text', text: JSON.stringify({ error: 'Note not found' }) }] };
        }
        queryEmbedding = embedding;
        excludeIds = [noteId];
      } else if (text) {
        queryEmbedding = await generateEmbedding(text);
      } else {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Provide noteId or text' }) }] };
      }
      
      const results = findTopK(queryEmbedding, getEmbeddings(), limit || 5, excludeIds);
      const notes = getNotes();
      
      const relatedNotes = results.map(r => {
        const note = notes.get(r.id)!;
        return {
          id: note.id,
          title: note.title,
          content: note.content,
          similarity: Math.round(r.similarity * 100) / 100
        };
      });
      
      return {
        content: [{ type: 'text', text: JSON.stringify({ relatedNotes }, null, 2) }]
      };
    }
  );

  // Tool: list_notes
  server.registerTool(
    'list_notes',
    {
      title: 'List Notes',
      description: 'List all notes with optional tag filter',
      inputSchema: {
        tags: z.array(z.string()).optional(),
        limit: z.number().optional().default(50),
        offset: z.number().optional().default(0)
      }
    },
    async ({ tags, limit, offset }) => {
      let notesList = Array.from(getNotes().values());
      
      if (tags && tags.length > 0) {
        notesList = notesList.filter(n => 
          tags.some(tag => n.tags.includes(tag))
        );
      }
      
      const total = notesList.length;
      const paginated = notesList.slice(offset || 0, (offset || 0) + (limit || 50));
      
      const results = paginated.map(n => ({
        id: n.id,
        title: n.title,
        preview: n.content.slice(0, 100) + (n.content.length > 100 ? '...' : ''),
        tags: n.tags,
        createdAt: n.createdAt
      }));
      
      return {
        content: [{ type: 'text', text: JSON.stringify({ notes: results, total }, null, 2) }]
      };
    }
  );

  // Connect via stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('SemantiCanvas MCP Server running');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
```

---

## Task 4: Test

```bash
# Build
npm run build

# Test with MCP Inspector
npx @modelcontextprotocol/inspector node dist/index.js

# Create test data at ~/.semanticanvas/notes.json
```

Test JSON:
```json
{
  "version": 1,
  "exportedAt": "2024-12-31T00:00:00Z",
  "notes": [
    {
      "id": "test-1",
      "title": "Vector Embeddings",
      "content": "Vector embeddings map text to high-dimensional space for semantic search",
      "tags": ["AI", "embeddings"],
      "color": "#FEF3C7",
      "x": 0, "y": 0, "width": 280, "height": 180,
      "embedding": null,
      "createdAt": "2024-12-30T10:00:00Z",
      "updatedAt": "2024-12-30T10:00:00Z"
    },
    {
      "id": "test-2",
      "title": "Knowledge Management",
      "content": "Second brain systems help organize thoughts and surface connections",
      "tags": ["PKM"],
      "color": "#FEF3C7",
      "x": 300, "y": 0, "width": 280, "height": 180,
      "embedding": null,
      "createdAt": "2024-12-30T11:00:00Z",
      "updatedAt": "2024-12-30T11:00:00Z"
    }
  ]
}
```

---

## Task 5: Claude Desktop Config

Add to `%APPDATA%\Claude\claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "semanticanvas": {
      "command": "node",
      "args": ["C:\\Projects\\LeuCanvas-1\\mcp-server\\dist\\index.js"]
    }
  }
}
```

---

## Deliverables Checklist
- [ ] mcp-server package initialized
- [ ] Storage layer reads ~/.semanticanvas/notes.json
- [ ] Embeddings generated with Transformers.js
- [ ] 5 tools: search_notes, create_note, get_note, find_related, list_notes
- [ ] Duplicate detection on create_note
- [ ] Builds successfully with `npm run build`
- [ ] Works with MCP Inspector
- [ ] README.md with setup instructions
