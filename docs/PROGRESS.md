# Daily Progress Tracker

## 2025-12-30 - Session 2: UI Polish & Bug Fixes

### Completed
- [x] Fixed IdeaCard tool not appearing in toolbar (missing `overrides` prop)
- [x] Fixed double-click to edit not working (event propagation issue)
- [x] Fixed duplicate detection self-matching bug (card matching itself)
- [x] Added Clear Canvas button with confirmation dialog
- [x] Added canvas/vector index sync on load (prevents stale data)
- [x] Added debug logging for duplicate detection pipeline

### Files Modified
- `src/App.tsx` - Added UI overrides for IdeaCard tool, Clear Canvas button, ConfirmDialog component
- `src/shapes/IdeaCardUtil.tsx` - Added `onDoubleClick` handler, conditional event propagation
- `src/hooks/usePersistence.ts` - Added `clearAll()` function, canvas/vector sync on load
- `src/hooks/useDuplicateCheck.ts` - Added setTimeout for race condition, self-match safety check
- `src/lib/similarity.ts` - Added explicit String() comparison for ID matching
- `src/store/useVectorIndex.ts` - Added debug logging

### Bug Fixes Detail

**IdeaCard Tool Not in Toolbar**
- Root cause: tldraw v4 requires both `tools` prop (behavior) AND `overrides` prop (UI)
- Fix: Added `overrides` with `tools()` function defining icon, label, keyboard shortcut

**Double-Click Edit Not Working**
- Root cause: `onPointerDown={stopEventPropagation}` blocked all events including double-click
- Fix: Made event propagation conditional (`isEditing ? stopEventPropagation : undefined`)
- Fix: Added explicit `onDoubleClick` handler calling `editor.setEditingShape()`

**Duplicate Self-Matching**
- Root cause: Race condition between vector index sync and duplicate check
- Fix: Added `setTimeout(0)` to defer duplicate check until after index sync
- Fix: Added safety check in `updateDuplicateInfo()` to reject self-matches
- Fix: Added explicit `String()` conversion for ID comparison

### New Features

**Clear Canvas Button**
- Location: Top-right corner (floating button)
- Hover effect: Turns red to indicate destructive action
- Confirmation dialog with Cancel/Clear All buttons
- Clears: All IdeaCard shapes, IndexedDB snapshot, vector index

**Canvas/Vector Index Sync**
- On load: If canvas is empty, vector index is cleared
- On load: If snapshot is corrupted, both are cleared
- On load: If no snapshot exists, vector index is cleared
- Prevents stale vector entries from previous sessions

### Notes
- Press `i` to activate IdeaCard tool (keyboard shortcut)
- Debug logs prefixed with `[VectorIndex]`, `[DuplicateCheck]`, `[findSimilar]`
- Clear All also saves empty state to prevent reload issues

---

## 2025-12-30 - Session 1: Bug Fixes & Stability

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
