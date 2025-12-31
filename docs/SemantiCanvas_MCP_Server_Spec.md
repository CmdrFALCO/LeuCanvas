# SemantiCanvas MCP Server Integration

## Specification for Claude Code Implementation

**Date:** December 31, 2024
**Phase:** MCP Server Integration
**Status:** IMPLEMENTED (2025-12-31)

---

## Implementation Status

| Component | Status | Location |
|-----------|--------|----------|
| Package setup | Done | `mcp-server/package.json` |
| TypeScript config | Done | `mcp-server/tsconfig.json` |
| Types | Done | `mcp-server/src/types.ts` |
| Storage layer | Done | `mcp-server/src/lib/storage.ts` |
| Similarity functions | Done | `mcp-server/src/lib/similarity.ts` |
| MCP Server + Tools | Done | `mcp-server/src/index.ts` |
| Build | Done | `mcp-server/dist/` |
| Test data | Done | `~/.semanticanvas/notes.json` |
| Documentation | Done | `mcp-server/README.md` |

### Implemented Tools
- `search_notes` - Semantic search with similarity threshold
- `create_note` - Create note with duplicate detection
- `get_note` - Retrieve note by ID
- `find_related` - Find related notes by ID or text
- `list_notes` - List/filter notes with pagination

### Quick Start
```bash
cd mcp-server
npm install
npm run build
npx @modelcontextprotocol/inspector node dist/index.js
```

---

## Overview

Create an MCP (Model Context Protocol) server that exposes SemantiCanvas knowledge base to Claude Desktop, Claude Code, and other MCP-compatible clients. This enables AI assistants to search, read, and create notes in the user's semantic knowledge base.

---

## Architecture Decision

### Challenge
SemantiCanvas runs in the browser with IndexedDB storage. MCP servers run as Node.js processes. We need a bridge between them.

### Solution: File-Based Sync
The simplest and most robust approach for MVP:

1. **Export Path**: SemantiCanvas exports notes to `~/.semanticanvas/notes.json`
2. **MCP Server**: Reads from this JSON file, generates embeddings on startup
3. **Auto-Sync**: SemantiCanvas auto-exports on changes (debounced)
4. **Write-Back**: MCP server writes new notes to a `pending.json`, browser app imports on next load

```
┌─────────────────────┐         ┌─────────────────────┐
│   SemantiCanvas     │         │    MCP Server       │
│   (Browser App)     │         │    (Node.js)        │
├─────────────────────┤         ├─────────────────────┤
│                     │  write  │                     │
│   IndexedDB ────────┼────────►│  notes.json         │
│                     │         │       │             │
│                     │  read   │       ▼             │
│   pending.json ◄────┼─────────│  Vector Index       │
│                     │         │  (in-memory)        │
└─────────────────────┘         └─────────────────────┘
```

---

## Project Structure

Create a new directory for the MCP server as a separate package:

```
semanticanvas/
├── src/                      # Existing browser app
├── mcp-server/               # NEW: MCP server package
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts          # Entry point
│   │   ├── server.ts         # MCP server setup
│   │   ├── tools/
│   │   │   ├── searchNotes.ts
│   │   │   ├── createNote.ts
│   │   │   ├── getNote.ts
│   │   │   ├── findRelated.ts
│   │   │   └── listNotes.ts
│   │   ├── resources/
│   │   │   └── notesResource.ts
│   │   ├── lib/
│   │   │   ├── storage.ts    # JSON file read/write
│   │   │   ├── embeddings.ts # Transformers.js wrapper
│   │   │   └── similarity.ts # Cosine similarity
│   │   └── types.ts
│   └── README.md
└── package.json              # Root workspace
```

---

## MCP Server Tools

### 1. `search_notes`
Semantic search across all notes.

```typescript
{
  name: 'search_notes',
  title: 'Search Notes',
  description: 'Semantically search through your knowledge base',
  inputSchema: {
    query: z.string().describe('Search query'),
    limit: z.number().optional().default(10).describe('Max results'),
    minSimilarity: z.number().optional().default(0.5).describe('Minimum similarity threshold (0-1)')
  },
  outputSchema: {
    results: z.array(z.object({
      id: z.string(),
      title: z.string(),
      content: z.string(),
      similarity: z.number(),
      tags: z.array(z.string())
    }))
  }
}
```

### 2. `create_note`
Create a new idea card.

```typescript
{
  name: 'create_note',
  title: 'Create Note',
  description: 'Create a new note in your knowledge base',
  inputSchema: {
    title: z.string().optional().describe('Note title'),
    content: z.string().describe('Note content'),
    tags: z.array(z.string()).optional().describe('Tags for the note')
  },
  outputSchema: {
    id: z.string(),
    title: z.string(),
    content: z.string(),
    createdAt: z.string(),
    duplicateWarning: z.object({
      isDuplicate: z.boolean(),
      similarNote: z.object({
        id: z.string(),
        title: z.string(),
        similarity: z.number()
      }).optional()
    }).optional()
  }
}
```

### 3. `get_note`
Get a specific note by ID.

```typescript
{
  name: 'get_note',
  title: 'Get Note',
  description: 'Retrieve a specific note by ID',
  inputSchema: {
    id: z.string().describe('Note ID')
  },
  outputSchema: {
    id: z.string(),
    title: z.string(),
    content: z.string(),
    tags: z.array(z.string()),
    createdAt: z.string(),
    updatedAt: z.string()
  }
}
```

### 4. `find_related`
Find notes related to a given note or text.

```typescript
{
  name: 'find_related',
  title: 'Find Related Notes',
  description: 'Find notes semantically related to a given note or text',
  inputSchema: {
    noteId: z.string().optional().describe('ID of note to find relations for'),
    text: z.string().optional().describe('Text to find related notes for'),
    limit: z.number().optional().default(5)
  },
  outputSchema: {
    relatedNotes: z.array(z.object({
      id: z.string(),
      title: z.string(),
      content: z.string(),
      similarity: z.number()
    }))
  }
}
```

### 5. `list_notes`
List all notes with optional filtering.

```typescript
{
  name: 'list_notes',
  title: 'List Notes',
  description: 'List all notes, optionally filtered by tags',
  inputSchema: {
    tags: z.array(z.string()).optional().describe('Filter by tags'),
    limit: z.number().optional().default(50),
    offset: z.number().optional().default(0)
  },
  outputSchema: {
    notes: z.array(z.object({
      id: z.string(),
      title: z.string(),
      preview: z.string(), // First 100 chars
      tags: z.array(z.string()),
      createdAt: z.string()
    })),
    total: z.number()
  }
}
```

---

## MCP Resources

### `notes://list`
List all notes as a resource.

### `notes://{id}`
Individual note as a resource (using ResourceTemplate).

---

## Data Schema

### notes.json Format

```typescript
interface NotesExport {
  version: 1;
  exportedAt: string; // ISO timestamp
  notes: Array<{
    id: string;
    title: string;
    content: string;
    tags: string[];
    color: string;
    x: number;
    y: number;
    width: number;
    height: number;
    embedding: number[] | null; // 384-dim vector
    createdAt: string;
    updatedAt: string;
  }>;
}
```

### pending.json Format (for write-back)

```typescript
interface PendingNotes {
  version: 1;
  notes: Array<{
    id: string;
    title: string;
    content: string;
    tags: string[];
    createdAt: string;
  }>;
}
```

---

## Implementation Steps

### Step 1: Create MCP Server Package

```bash
cd semanticanvas
mkdir -p mcp-server/src/{tools,resources,lib}
cd mcp-server
npm init -y
npm install @modelcontextprotocol/sdk @xenova/transformers zod
npm install -D typescript @types/node tsx
```

### Step 2: Configure TypeScript

```json
// mcp-server/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

### Step 3: Implement Core Server

```typescript
// mcp-server/src/index.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools } from './tools/index.js';
import { registerResources } from './resources/index.js';
import { loadNotes, initEmbeddings } from './lib/storage.js';

async function main() {
  // Initialize embedding model
  console.error('Loading embedding model...');
  await initEmbeddings();
  
  // Load notes from JSON file
  console.error('Loading notes...');
  await loadNotes();
  
  // Create MCP server
  const server = new McpServer({
    name: 'semanticanvas',
    version: '1.0.0'
  });
  
  // Register tools and resources
  registerTools(server);
  registerResources(server);
  
  // Connect via stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('SemantiCanvas MCP Server running');
}

main().catch(console.error);
```

### Step 4: Implement Storage Layer

```typescript
// mcp-server/src/lib/storage.ts
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { pipeline } from '@xenova/transformers';

const DATA_DIR = join(homedir(), '.semanticanvas');
const NOTES_FILE = join(DATA_DIR, 'notes.json');
const PENDING_FILE = join(DATA_DIR, 'pending.json');

let embedder: any = null;
let notes: Map<string, Note> = new Map();
let embeddings: Map<string, number[]> = new Map();

export async function initEmbeddings() {
  embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
    quantized: true
  });
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const output = await embedder(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

export async function loadNotes() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  
  if (!existsSync(NOTES_FILE)) {
    return;
  }
  
  const data = JSON.parse(readFileSync(NOTES_FILE, 'utf-8'));
  
  for (const note of data.notes) {
    notes.set(note.id, note);
    
    // Use existing embedding or generate new one
    if (note.embedding) {
      embeddings.set(note.id, note.embedding);
    } else {
      const text = `${note.title} ${note.content}`.trim();
      embeddings.set(note.id, await generateEmbedding(text));
    }
  }
}

export function getNotes() { return notes; }
export function getEmbeddings() { return embeddings; }

// ... implement addPendingNote, savePendingNotes, etc.
```

### Step 5: Implement Tools

See detailed tool implementations in the tools/ directory.

### Step 6: Update Browser App

Add auto-export feature to SemantiCanvas:

```typescript
// src/lib/mcpSync.ts
export async function exportForMCP() {
  const cards = editor.getCurrentPageShapes()
    .filter(s => s.type === 'idea-card');
  
  const notes = cards.map(card => ({
    id: card.id,
    title: card.props.title,
    content: card.props.content,
    tags: card.props.tags || [],
    color: card.props.color,
    x: card.x,
    y: card.y,
    width: card.props.width,
    height: card.props.height,
    embedding: card.meta.embedding ? Array.from(card.meta.embedding) : null,
    createdAt: card.meta.createdAt,
    updatedAt: card.meta.updatedAt
  }));
  
  const exportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    notes
  };
  
  // In Electron: write to file
  // In browser: use File System Access API or download
}
```

---

## Claude Desktop Configuration

After building, users add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "semanticanvas": {
      "command": "node",
      "args": ["/path/to/semanticanvas/mcp-server/dist/index.js"]
    }
  }
}
```

Or with npx:

```json
{
  "mcpServers": {
    "semanticanvas": {
      "command": "npx",
      "args": ["-y", "semanticanvas-mcp"]
    }
  }
}
```

---

## Testing

### Manual Testing with MCP Inspector

```bash
cd mcp-server
npx @modelcontextprotocol/inspector node dist/index.js
```

### Test Data Setup

Create a test notes.json:

```json
{
  "version": 1,
  "exportedAt": "2024-12-31T00:00:00Z",
  "notes": [
    {
      "id": "test-1",
      "title": "AI Architecture",
      "content": "Vector embeddings enable semantic search by mapping text to high-dimensional space",
      "tags": ["AI", "architecture"],
      "createdAt": "2024-12-30T10:00:00Z",
      "updatedAt": "2024-12-30T10:00:00Z"
    },
    {
      "id": "test-2", 
      "title": "Knowledge Management",
      "content": "Second brain systems help capture and organize fleeting thoughts",
      "tags": ["PKM", "productivity"],
      "createdAt": "2024-12-30T11:00:00Z",
      "updatedAt": "2024-12-30T11:00:00Z"
    }
  ]
}
```

---

## Success Criteria

1. **MCP server starts** without errors via stdio transport
2. **search_notes** returns semantically relevant results
3. **create_note** adds note to pending.json with duplicate detection
4. **find_related** returns notes with similarity scores
5. **list_notes** returns paginated note list
6. **Claude Desktop** can connect and use all tools
7. **Embeddings** load once on startup (not per-request)

---

## PRISM Prompt for Claude Code

```
///┌──┌──▞▞┌───────────────────────
►///▞ SEMANTICANVAS MCP :: SERVER.IMPLEMENTATION ⫸
//▞▞〈Purpose · Rules · Identity · Structure · Motion〉

P:: implement.mcp.server.for.semanticanvas.knowledge.base
R:: typescript · @modelcontextprotocol/sdk · stdio.transport · xenova/transformers · zod.validation
I:: specification.above · existing.semanticanvas.codebase.at.C:\Projects\LeuCanvas-1
S:: create.package → implement.storage → implement.tools → implement.resources → test.with.inspector
M:: output.working.mcp.server · all.five.tools.functional · embeddings.cached.on.startup

:: ∎
```

---

## Files to Create

1. `mcp-server/package.json`
2. `mcp-server/tsconfig.json`
3. `mcp-server/src/index.ts`
4. `mcp-server/src/server.ts`
5. `mcp-server/src/types.ts`
6. `mcp-server/src/lib/storage.ts`
7. `mcp-server/src/lib/embeddings.ts`
8. `mcp-server/src/lib/similarity.ts`
9. `mcp-server/src/tools/index.ts`
10. `mcp-server/src/tools/searchNotes.ts`
11. `mcp-server/src/tools/createNote.ts`
12. `mcp-server/src/tools/getNote.ts`
13. `mcp-server/src/tools/findRelated.ts`
14. `mcp-server/src/tools/listNotes.ts`
15. `mcp-server/src/resources/index.ts`
16. `mcp-server/README.md`

---

*This specification provides Claude Code with everything needed to implement the MCP Server integration.*
