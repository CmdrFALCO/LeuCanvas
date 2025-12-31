# Technical Architecture

## Project Structure

```
semanticanvas/
├── src/
│   ├── shapes/              # Custom tldraw shapes
│   │   ├── IdeaCardShape.ts     # Type definitions
│   │   ├── IdeaCardUtil.tsx     # Rendering & behavior
│   │   └── index.ts
│   ├── tools/               # Custom tldraw tools
│   │   ├── IdeaCardTool.ts      # IdeaCard creation tool
│   │   └── index.ts
│   ├── hooks/               # React hooks
│   │   ├── usePersistence.ts    # IndexedDB persistence
│   │   ├── useEmbedding.ts      # Auto-embed cards
│   │   ├── useModelLoader.ts    # Model loading state
│   │   ├── useDuplicateCheck.ts # Duplicate detection
│   │   ├── useHotkeys.ts        # Keyboard shortcuts
│   │   └── index.ts
│   ├── workers/             # Web Workers
│   │   └── embedding.worker.ts  # Embedding generation
│   ├── lib/                 # Core libraries
│   │   ├── constants.ts         # Configuration
│   │   ├── embeddings.ts        # Embedding pipeline
│   │   ├── similarity.ts        # Cosine similarity
│   │   └── index.ts
│   ├── store/               # State management
│   │   ├── useVectorIndex.ts    # Vector index store
│   │   └── index.ts
│   ├── components/          # React components
│   │   ├── DuplicateWarning.tsx # Warning tooltip
│   │   ├── SearchPanel.tsx      # Semantic search sidebar
│   │   ├── RelatedSidebar.tsx   # Related cards sidebar
│   │   ├── QuickCapture.tsx     # Quick capture modal
│   │   ├── ChatPanel.tsx        # AI chat sidebar
│   │   ├── ApiSettings.tsx      # LLM API settings modal
│   │   ├── Toast.tsx            # Toast notifications
│   │   └── index.ts
│   ├── types/               # TypeScript types
│   │   └── index.ts             # Shared interfaces
│   ├── App.tsx              # Main app with tldraw
│   ├── main.tsx             # Entry point
│   └── index.css            # Global styles
├── docs/                    # Documentation
└── package.json
```

## Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Canvas | tldraw | 4.2.1 |
| UI Framework | React | 19.2.0 |
| State Management | Zustand | 5.0.9 |
| Persistence | idb-keyval | 6.2.2 |
| Embeddings | @xenova/transformers | 2.17.2 |
| Build Tool | Vite | 7.2.4 |
| Language | TypeScript | 5.9.3 |

## Custom Shape: IdeaCard

### Properties
```typescript
interface IdeaCardProps {
  title: string    // Card title
  content: string  // Card content/notes
  w: number        // Width (default: 280, min: 180)
  h: number        // Height (default: 180, min: 120)
}
```

### Meta (stored in shape.meta)
```typescript
interface IdeaCardMeta {
  embedding: number[] | null     // 384-dim vector
  embeddingModel: string | null  // Model identifier
  embeddedAt: number | null      // Timestamp
  duplicateOf: string | null     // Similar card ID
  similarityScore: number | null // 0-1 similarity
  createdAt: number              // Creation time
  updatedAt: number              // Last update
  isEmbedding?: boolean          // Currently embedding
}
```

### Features
- Extends `BaseBoxShapeUtil` for box-based behavior
- Editable via double-click (explicit `onDoubleClick` handler)
- Resizable with minimum dimensions
- Sticky-note visual style
- Visual embedding status indicators
- Duplicate/similar warning with navigation

## Custom Tool Registration (tldraw v4)

In tldraw v4, custom tools require TWO registrations:

### 1. Behavior Registration (`tools` prop)
```typescript
const customTools = [IdeaCardTool]  // StateNode class

<Tldraw tools={customTools} />
```

### 2. UI Registration (`overrides` prop)
```typescript
const overrides: TLUiOverrides = {
  tools(editor, tools) {
    tools['idea-card'] = {
      id: 'idea-card',
      icon: 'tool-note',
      label: 'Idea Card',
      kbd: 'i',  // Keyboard shortcut
      onSelect: () => editor.setCurrentTool('idea-card'),
    }
    return tools
  },
}

<Tldraw overrides={overrides} />
```

### 3. Toolbar Display (`components` prop)
```typescript
function CustomToolbar() {
  const tools = useTools()
  return (
    <DefaultToolbar>
      <TldrawUiMenuItem {...tools['idea-card']} />
      <DefaultToolbarContent />
    </DefaultToolbar>
  )
}

<Tldraw components={{ Toolbar: CustomToolbar }} />
```

## Embedding Pipeline

### Architecture
```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   tldraw    │────▶│  useEmbedding    │────▶│ EmbeddingPipeline│
│   Store     │     │  (debounce 500ms)│     │   (singleton)    │
└─────────────┘     └──────────────────┘     └────────┬────────┘
                                                      │
                                                      ▼
                                             ┌─────────────────┐
                                             │  Web Worker     │
                                             │  Transformers.js│
                                             │  MiniLM-L6-v2   │
                                             └─────────────────┘
```

### Components

**embedding.worker.ts**
- Runs in Web Worker (non-blocking)
- Loads quantized MiniLM-L6-v2 model
- Processes embed requests with {id, text}
- Returns {id, vector} (384-dim Float32Array)
- Reports loading progress

**embeddings.ts**
- Singleton `EmbeddingPipeline` class
- Manages worker lifecycle
- Queue system for embedding requests
- Progress callback for UI updates
- Promise-based API

**useEmbedding.ts**
- Listens to tldraw store for IdeaCard changes
- Debounces 500ms after typing stops
- Updates shape.meta with embedding
- Tracks content hash to avoid re-embedding

**useModelLoader.ts**
- Manages model loading state
- Tracks progress percentage
- Auto-initializes on mount

### Configuration
```typescript
const CONFIG = {
  EMBEDDING_MODEL: 'Xenova/all-MiniLM-L6-v2',
  EMBEDDING_DIMENSIONS: 384,
  EMBEDDING_DEBOUNCE_MS: 500,
  DUPLICATE_THRESHOLD: 0.92,    // Red alert
  SIMILAR_THRESHOLD: 0.85,      // Orange warning
  RELATED_THRESHOLD: 0.70,      // Show in sidebar
}
```

## Vector Index & Similarity

### Architecture
```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   tldraw    │────▶│ useVectorIndexSync│────▶│  useVectorIndex │
│   Store     │     │  (sync on change)│     │  (Zustand store)│
└─────────────┘     └──────────────────┘     └────────┬────────┘
                                                      │
      ┌───────────────────────────────────────────────┘
      │
      ▼
┌─────────────────┐     ┌──────────────────┐
│ useDuplicateCheck│────▶│   findSimilar    │
│ (after embedding)│     │ (cosine similarity)
└────────┬────────┘     └──────────────────┘
         │
         ▼
┌─────────────────┐
│  Update card    │
│  meta with      │
│  duplicate info │
└─────────────────┘
```

### Components

**useVectorIndex.ts** (Zustand store)
- In-memory Map<string, VectorEntry>
- Auto-persists to IndexedDB
- Methods: addEntry, updateEntry, removeEntry, getAllEntries
- Key: `semanticanvas-vector-index`

**similarity.ts**
- `cosineSimilarity(a, b)` - Dot product (vectors are normalized)
- `findSimilar(query, index, topK, excludeId)` - Top-k search
- `findAboveThreshold(query, index, threshold, excludeId)` - Filter by score

**useDuplicateCheck.ts**
- Listens for new embeddings (checks embeddedAt timestamp)
- Queries vector index for similar cards
- Updates card.meta.duplicateOf and similarityScore
- Thresholds: 0.92 (duplicate), 0.85 (similar)

**DuplicateWarning.tsx**
- Badge below card showing similarity percentage
- Hover tooltip with similar card preview
- "Go to card" button (selects and zooms)
- "Dismiss" button (clears warning)

### Visual Indicators
| Similarity | Border Color | Badge Color | Label |
|------------|--------------|-------------|-------|
| ≥ 0.92 | Red (#ef4444) | Red | "Duplicate" |
| ≥ 0.85 | Orange (#f97316) | Orange | "Similar" |
| < 0.85 | Normal | None | None |

## Persistence Layer

### Strategy
- **Canvas State**: IndexedDB via idb-keyval
  - Key: `semanticanvas-snapshot`
  - Format: tldraw `TLStoreSnapshot`
- **Vector Index**: IndexedDB via idb-keyval
  - Key: `semanticanvas-vector-index`
  - Format: Serialized VectorEntry array

### Flow
1. On mount: Load canvas snapshot and vector index
2. On card change: Debounce and save snapshot
3. On embedding: Update vector index and persist
4. On refresh: Restore previous state

### Data Recovery
- **URL Reset**: Add `?reset` to URL to clear all stored data
- **Snapshot Validation**: Invalid snapshots are auto-detected and cleared
- **Graceful Degradation**: Corrupted data triggers fresh start instead of crash
- **Clear Canvas Button**: UI button to reset all data with confirmation

### Data Sync
On app load, the persistence layer ensures canvas and vector index stay in sync:
- If canvas is empty (0 IdeaCards) → clear vector index
- If snapshot is corrupted → clear both canvas and vector index
- If no snapshot exists → clear vector index
- Prevents stale vector entries from causing false duplicate matches

### Clear All Flow
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Clear Button   │────▶│  Confirm Dialog  │────▶│   clearAll()    │
│  (top-right)    │     │  (Cancel/Clear)  │     │                 │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
         ┌────────────────────────────────────────────────┼────────────────────────┐
         │                                                │                        │
         ▼                                                ▼                        ▼
┌─────────────────┐                              ┌─────────────────┐      ┌─────────────────┐
│  Delete shapes  │                              │  Clear IndexedDB│      │  Clear Zustand  │
│  from editor    │                              │  (both keys)    │      │  vector index   │
└─────────────────┘                              └─────────────────┘      └─────────────────┘
```

## Error Handling

### Shape Util Safety
All `IdeaCardUtil` methods include defensive checks:
```typescript
component(shape) {
  if (!shape?.props) return null  // Guard against undefined
  // ... render logic
}
```

### Persistence Safety
```typescript
function isValidSnapshot(snapshot): boolean {
  // Validates all shapes have props before loading
  for (const [key, value] of Object.entries(snapshot.store)) {
    if (key.startsWith('shape:') && !value.props) {
      return false  // Corrupted shape detected
    }
  }
  return true
}
```

## Search & Discovery (Phase 4)

### App Layout
```
┌─────────────────────────────────────────────────────────────────┐
│ [☰] [Search]                                         [Chat]    │  <- HeaderToolbar (48px)
├───────────────┬──────────────────────────────┬─────────────────┤
│  SearchPanel  │                              │  RelatedSidebar │
│   (toggle)    │        tldraw Canvas         │   (collapse)    │
│   width:320   │     (with native toolbar)    │    width:280    │
│               │           flex: 1            │                 │
│  - Input      │                              │  - Selected     │
│  - Results    │                              │  - Top 5        │
│               │                              │    related      │
└───────────────┴──────────────────────────────┴─────────────────┘
```

### Layout Structure
The app uses a two-level flex layout:
1. **Outer container** (`flex-direction: column`):
   - HeaderToolbar (fixed 48px height)
   - Main content area (flex: 1)

2. **Main content** (`flex-direction: row`):
   - SearchPanel (320px, toggleable)
   - tldraw Canvas (flex: 1)
   - RelatedSidebar/ChatPanel (280px/400px)

### HeaderToolbar Component
- Fixed height: 48px
- Background: #fafafa with bottom border
- Left side: Hamburger menu (Import/Export dropdown), Search button
- Right side: Chat toggle button
- Keeps custom controls separate from tldraw's native UI

### Components

**SearchPanel.tsx**
- Left sidebar, 320px wide
- Hidden by default, toggle with Ctrl/Cmd+K
- Debounced search input (300ms)
- Embeds query using EmbeddingPipeline
- Calls `findSimilar()` for top-10 results
- Shows: title, preview, similarity percentage
- Click result → `editor.select()` + `editor.zoomToSelection()`

**RelatedSidebar.tsx**
- Right sidebar, 280px wide (40px when collapsed)
- Visible when IdeaCard selected
- Gets embedding from selected card's meta
- Calls `findSimilar()` for top-5 above RELATED_THRESHOLD
- Updates on selection change and card content change
- Click to navigate to related card

**useHotkeys.ts**
- Global keyboard listener
- Detects Mac vs Windows for modifier key
- `Ctrl/Cmd+K` → toggle search panel
- `Ctrl/Cmd+Shift+N` → quick capture (Phase 5 stub)

### Configuration
```typescript
const CONFIG = {
  SEARCH_TOP_K: 10,          // Max search results
  RELATED_TOP_K: 5,          // Max related cards
  RELATED_THRESHOLD: 0.70,   // Min similarity for related
}
```

### Color Coding
| Similarity | Color | Meaning |
|------------|-------|---------|
| ≥ 92% | Red (#dc2626) | Duplicate |
| ≥ 85% | Orange (#f59e0b) | Similar |
| ≥ 70% | Green (#10b981) | Related |
| < 70% | Gray (#6b7280) | Low match |

## Quick Capture (Phase 5)

### QuickCapture.tsx
- Modal overlay triggered by Ctrl/Cmd+Shift+N
- Title input (auto-focused) + Content textarea
- Live duplicate detection during input (debounced 500ms)
- Embeds combined text to check for similar existing cards
- Shows warning banner if similarity ≥ 85%
- Warning includes clickable links to navigate to similar cards
- Creates IdeaCard at viewport center using `editor.getViewportScreenCenter()`
- Keyboard: Ctrl+Enter to create, Esc to cancel

### Flow
```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Hotkey    │────▶│  QuickCapture    │────▶│  Create Shape   │
│ Ctrl+Shift+N│     │  Modal Opens     │     │  at Center      │
└─────────────┘     └────────┬─────────┘     └─────────────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │  Debounced       │
                    │  Duplicate Check │
                    │  (500ms)         │
                    └────────┬─────────┘
                             │
                   ┌─────────┴─────────┐
                   ▼                   ▼
          ┌───────────────┐   ┌───────────────┐
          │  No Matches   │   │  Show Warning │
          │  (create OK)  │   │  (can still   │
          └───────────────┘   │   create)     │
                              └───────────────┘
```

## MCP Server Integration (Phase 6)

### Purpose
Expose SemantiCanvas knowledge base to Claude Desktop, Claude Code, and other MCP-compatible clients for AI-assisted note management.

### Architecture
```
┌─────────────────────────────────────────────────────────────────────┐
│                        MCP Server (Node.js)                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────────┐ │
│  │  stdio       │────▶│  McpServer   │────▶│  Tool Handlers       │ │
│  │  Transport   │     │  (@mcp/sdk)  │     │  (search, create...) │ │
│  └──────────────┘     └──────────────┘     └──────────┬───────────┘ │
│                                                        │             │
│                              ┌─────────────────────────┘             │
│                              ▼                                       │
│                    ┌──────────────────┐                              │
│                    │  Storage Layer   │                              │
│                    │  (storage.ts)    │                              │
│                    └────────┬─────────┘                              │
│                              │                                       │
│         ┌────────────────────┼────────────────────┐                 │
│         ▼                    ▼                    ▼                 │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────────┐       │
│  │ notes.json  │    │ pending.json │    │ Embeddings       │       │
│  │ (read)      │    │ (write)      │    │ (Transformers.js)│       │
│  └─────────────┘    └──────────────┘    └──────────────────┘       │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘

Data Flow:
┌─────────────────────┐         ┌─────────────────────┐
│   SemantiCanvas     │         │    MCP Server       │
│   (Browser App)     │         │    (Node.js)        │
├─────────────────────┤         ├─────────────────────┤
│                     │  write  │                     │
│   IndexedDB ────────┼────────►│  notes.json         │
│                     │         │       │             │
│                     │  read   │       ▼             │
│   pending.json ◄────┼─────────│  Vector Index       │
│                     │         │  (in-memory Map)    │
└─────────────────────┘         └─────────────────────┘
```

### Project Structure
```
mcp-server/
├── package.json           # Dependencies: @modelcontextprotocol/sdk, @xenova/transformers, zod
├── tsconfig.json          # NodeNext module resolution
├── src/
│   ├── index.ts           # Entry point, MCP server setup, tool registration
│   ├── types.ts           # Note, NotesExport, PendingNotes interfaces
│   └── lib/
│       ├── storage.ts     # JSON file I/O, embedding generation
│       └── similarity.ts  # Cosine similarity, findTopK
└── dist/                  # Compiled output
```

### MCP Tools

| Tool | Input | Output |
|------|-------|--------|
| `search_notes` | query, limit?, minSimilarity? | results: {id, title, content, tags, similarity}[] |
| `create_note` | title?, content, tags? | id, title, content, createdAt, duplicateWarning? |
| `get_note` | id | Full note object |
| `find_related` | noteId? or text?, limit? | relatedNotes: {id, title, content, similarity}[] |
| `list_notes` | tags?, limit?, offset? | notes: {id, title, preview, tags, createdAt}[], total |

### Configuration

Data directory: `~/.semanticanvas/`
- `notes.json` - Exported notes from browser app (read by MCP)
- `pending.json` - Notes created via MCP (imported by browser)

Claude Desktop config (`%APPDATA%\Claude\claude_desktop_config.json`):
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

### Embedding Pipeline (MCP Server)

Same model as browser app for consistency:
- Model: `Xenova/all-MiniLM-L6-v2` (384 dimensions, quantized)
- Loaded on server startup via `initEmbeddings()`
- Notes without embeddings get them generated on load
- New notes via `create_note` get embeddings immediately

### Duplicate Detection

On `create_note`:
1. Generate embedding for `${title} ${content}`
2. Find top-1 similar note via `findTopK()`
3. If similarity > 0.92, include `duplicateWarning` in response
4. Note is still created (user can decide to delete)

## Future Enhancements

### Potential Features
- Card color picker during creation/editing
- Bulk card import/export (JSON, Markdown)
- Collaboration (WebSocket sync)
- Card templates
- Tags/categories with filtering
- MCP Resources for direct note access
- Auto-sync on browser app changes (file watcher)
