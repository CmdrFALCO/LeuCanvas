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
- Editable via double-click
- Resizable with minimum dimensions
- Sticky-note visual style
- Visual embedding status indicators
- Duplicate/similar warning with navigation

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

## Future Architecture (Planned)

### Search & Discovery (Phase 4)
- Semantic search panel with query embedding
- Related cards sidebar for selected card
- Click-to-navigate functionality
- Keyboard shortcut: Cmd/Ctrl+K
