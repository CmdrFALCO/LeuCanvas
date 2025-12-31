# SemantiCanvas

A local-first infinite canvas for semantic note-taking. Create visual knowledge maps with AI-powered duplicate detection and semantic search.

## Features

- **Infinite Canvas**: Full-screen tldraw canvas with custom IdeaCard shapes
- **Semantic Embeddings**: Client-side embedding generation using Xenova/all-MiniLM-L6-v2 (384 dims)
- **Duplicate Detection**: Automatic similar card detection with visual warnings
- **Local-First**: IndexedDB persistence for canvas state and vector index
- **Non-Blocking ML**: Web Worker for background embedding inference
- **Search & RAG**: Semantic search and AI chat with retrieval-augmented generation
- **Export/Import**: JSON backup for canvas state

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Architecture

```
src/
├── components/          # React components
│   └── DuplicateWarning.tsx
├── hooks/               # Custom React hooks
│   ├── useEmbedding.ts
│   └── useModelLoader.ts
├── lib/                 # Utility libraries
│   └── embeddings.ts
├── shapes/              # tldraw custom shapes
│   ├── IdeaCardShape.ts
│   └── index.ts
├── store/               # Zustand state management
│   └── index.ts
├── tools/               # tldraw custom tools
│   ├── IdeaCardTool.ts
│   └── index.ts
├── types/               # TypeScript type definitions
│   └── index.ts
├── workers/             # Web Workers
│   └── embedding.worker.ts
└── main.tsx             # Entry point
```

## Tech Stack

- **React 19** + **TypeScript** + **Vite**
- **tldraw v4** - Infinite canvas framework
- **Zustand** - State management for vector index
- **@xenova/transformers** - Client-side ML embeddings
- **idb-keyval** - IndexedDB persistence

## MCP Server Integration

SemantiCanvas includes an MCP (Model Context Protocol) server that exposes your knowledge base to Claude Desktop, Claude Code, and other MCP-compatible clients.

### Setup MCP Server

```bash
cd mcp-server
npm install
npm run build
```

### Configure Claude Desktop

Add to `%APPDATA%\Claude\claude_desktop_config.json` (Windows) or `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

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

### MCP Tools

| Tool | Description |
|------|-------------|
| `search_notes` | Semantic search across your knowledge base |
| `create_note` | Create new notes with duplicate detection |
| `get_note` | Retrieve a specific note by ID |
| `find_related` | Find semantically related notes |
| `list_notes` | List/filter notes by tags |

### Data Sync

The browser app and MCP server sync via JSON files:

```
Browser App (IndexedDB)
        |
        | export on changes
        v
~/.semanticanvas/notes.json  <-- MCP server reads
        |
        | MCP creates new notes
        v
~/.semanticanvas/pending.json --> Browser imports
```

### Test with MCP Inspector

```bash
cd mcp-server
npx @modelcontextprotocol/inspector node dist/index.js
```

## Development Phases

1. **Foundation**: tldraw canvas, custom IdeaCard shapes, IndexedDB persistence
2. **Embedding Pipeline**: Web Worker, queue system, progress UI
3. **Duplicate Detection**: Vector index, cosine similarity, visual warnings
4. **Search & RAG**: Semantic search, quick capture, AI chat
5. **MCP Integration**: External AI access to knowledge base

## License

MIT
