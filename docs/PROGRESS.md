# Daily Progress Tracker

## 2025-12-30 - Bug Fixes & Stability

### Completed
- [x] Fixed TypeScript build errors for tldraw v4 API changes
- [x] Fixed `loadSnapshot`/`getSnapshot` moved from `editor.store` to `editor`
- [x] Fixed type imports with `verbatimModuleSyntax` enabled
- [x] Fixed null checks in useEmbedding and useDuplicateCheck hooks
- [x] Fixed idb-keyval naming conflict with Zustand's `get` in useVectorIndex
- [x] Fixed TLShapeId type casting in DuplicateWarning component
- [x] Added defensive null checks in IdeaCardUtil methods
- [x] Added `?reset` URL parameter for clearing corrupted IndexedDB data
- [x] Added snapshot validation to prevent loading corrupted data
- [x] Added defensive check for toolbar tool registration

### Files Modified
- `src/main.tsx` - Added reset parameter support for clearing IndexedDB
- `src/hooks/usePersistence.ts` - Fixed API, added snapshot validation
- `src/hooks/useEmbedding.ts` - Added null checks
- `src/hooks/useDuplicateCheck.ts` - Added null checks, fixed TLShapeId types
- `src/store/useVectorIndex.ts` - Fixed idb-keyval import naming conflict
- `src/shapes/IdeaCardUtil.tsx` - Added defensive null checks, removed unused imports
- `src/shapes/IdeaCardShape.ts` - Fixed type-only imports
- `src/components/DuplicateWarning.tsx` - Fixed TLShapeId type casting
- `src/workers/embedding.worker.ts` - Removed unused variable
- `src/App.tsx` - Added defensive check for toolbar tool

### Notes
- Use `?reset` in URL to clear all stored data if app crashes
- Snapshot validation automatically detects and clears corrupted data
- All tldraw v4 API changes addressed

---

## 2025-12-30 - Phase 3: Duplicate Detection

### Completed
- [x] Created in-memory vector index with IndexedDB persistence
- [x] Implemented cosine similarity and findSimilar functions
- [x] Created useDuplicateCheck hook for automatic detection
- [x] Built DuplicateWarning component with tooltip and navigation
- [x] Updated IdeaCardUtil with visual duplicate/similar indicators
- [x] Integrated vector index sync with tldraw store

### Files Created
- `src/store/useVectorIndex.ts` - Zustand store for vector index
- `src/store/index.ts` - Store exports
- `src/lib/similarity.ts` - Cosine similarity functions
- `src/hooks/useDuplicateCheck.ts` - Duplicate detection hook
- `src/components/DuplicateWarning.tsx` - Warning tooltip component
- `src/components/index.ts` - Component exports

### Files Modified
- `src/App.tsx` - Added vector index sync and duplicate check hooks
- `src/shapes/IdeaCardUtil.tsx` - Added duplicate warning visuals
- `src/lib/index.ts` - Added similarity exports
- `src/hooks/index.ts` - Added duplicate check exports

### Notes
- Thresholds: 0.92 (duplicate/red), 0.85 (similar/orange)
- Orange border + badge for similar cards (85-92%)
- Red border + badge for duplicate cards (>92%)
- Hover tooltip shows similar card preview
- "Go to card" navigates and selects the similar card
- "Dismiss" clears the warning (can be triggered again if re-embedded)
- Vector index persisted to IndexedDB key: `semanticanvas-vector-index`

### Next Steps
- Phase 4: Search & Discovery (semantic search, related cards sidebar)

---

## 2025-12-30 - Phase 2: Embedding Pipeline

### Completed
- [x] Created embedding Web Worker with Xenova/all-MiniLM-L6-v2
- [x] Implemented embedding pipeline with queue system
- [x] Created useEmbedding hook for automatic card embedding
- [x] Added model loading indicator with progress bar
- [x] Added per-card embedding status indicators
- [x] Defined IdeaCardMeta schema with embedding fields
- [x] Created constants file with configuration values

### Files Created
- `src/workers/embedding.worker.ts` - Web Worker for embedding generation
- `src/lib/constants.ts` - Configuration constants
- `src/lib/embeddings.ts` - Embedding pipeline singleton
- `src/lib/index.ts` - Library exports
- `src/hooks/useEmbedding.ts` - Auto-embed on card changes
- `src/hooks/useModelLoader.ts` - Model loading state management
- `src/types/index.ts` - TypeScript interfaces for meta schema

### Files Modified
- `src/App.tsx` - Added model loading UI and embedding hook
- `src/shapes/IdeaCardUtil.tsx` - Added embedding status indicators
- `src/hooks/index.ts` - Added new hook exports

### Notes
- Model: Xenova/all-MiniLM-L6-v2 (384 dimensions, quantized)
- Embeddings generated in Web Worker (non-blocking)
- Debounced 500ms after typing stops
- Blue pulsing dot: embedding in progress
- Green dot: embedding complete
- Full-screen overlay during initial model load (<10% progress)
- Subtle status bar for model loading after initial load

---

## 2025-12-30 - Phase 1: Foundation

### Completed
- [x] Replaced default Vite+React template with full-screen tldraw canvas
- [x] Created custom IdeaCard shape with title and content fields
- [x] Implemented IdeaCardUtil with rendering, bounds, and editing support
- [x] Registered custom shape and tool with tldraw
- [x] Added IndexedDB persistence using idb-keyval

### Files Created
- `src/shapes/IdeaCardShape.ts` - Shape type definition
- `src/shapes/IdeaCardUtil.tsx` - Shape rendering and behavior
- `src/shapes/index.ts` - Shape exports
- `src/tools/IdeaCardTool.ts` - Tool for creating IdeaCards
- `src/tools/index.ts` - Tool exports
- `src/hooks/usePersistence.ts` - IndexedDB persistence hook
- `src/hooks/index.ts` - Hook exports

### Files Modified
- `src/App.tsx` - Integrated tldraw with custom shapes and persistence
- `src/index.css` - Full-screen canvas styling

### Files Removed
- `src/App.css` - Unused default styles

### Notes
- IdeaCard has sticky-note appearance with cream background
- Double-click to edit title/content
- Canvas state auto-saves with 500ms debounce
- Storage key: `semanticanvas-snapshot`
