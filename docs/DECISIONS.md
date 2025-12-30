# Technical Decisions

## 2025-12-30 (Bug Fixes)

### Decision: URL parameter for data reset

**Context**: Corrupted IndexedDB data can crash the app before React renders, making UI reset buttons inaccessible.

**Choice**: Check for `?reset` URL parameter in main.tsx before rendering

**Alternatives Considered**:
- Browser DevTools manual deletion - Requires user knowledge of IndexedDB
- Automatic reset on error - Could lose valid data
- Service worker intercept - Adds complexity

**Rationale**:
- Works even when app crashes during render
- User-initiated, preserves data by default
- Simple to communicate: "add ?reset to URL"
- Clears both snapshot and vector index keys

---

### Decision: Snapshot validation before loading

**Context**: Invalid shape data in persisted snapshots causes runtime errors.

**Choice**: Validate snapshot structure before calling `editor.loadSnapshot()`

**Alternatives Considered**:
- Try-catch around loadSnapshot - Error happens inside tldraw, hard to recover
- Schema migration - Complex, overkill for corruption
- Always fresh start - Loses user data

**Rationale**:
- Catches corrupted shapes (missing props)
- Auto-deletes invalid data, starts fresh
- Prevents crash loop
- Minimal performance overhead

---

### Decision: Defensive null checks in shape utils

**Context**: tldraw may call shape methods with undefined shape in edge cases.

**Choice**: Add `if (!shape?.props)` guards in component(), indicator(), onResize(), onEditEnd()

**Alternatives Considered**:
- Trust tldraw always passes valid shape - Causes crashes
- ErrorBoundary wrapping - Doesn't prevent the error, just catches it
- Type assertions - Hides the problem

**Rationale**:
- Graceful degradation (return null or default)
- Zero runtime cost when shape is valid
- Protects against edge cases during loading/unloading
- TypeScript satisfied with explicit checks

---

## 2025-12-30 (Phase 3)

### Decision: Zustand for vector index state management

**Context**: Need to manage in-memory vector index across components.

**Choice**: Zustand store with IndexedDB persistence

**Alternatives Considered**:
- React context - Re-renders on every change
- Plain module singleton - No reactive updates
- tldraw store - Would couple index to canvas too tightly

**Rationale**:
- Selective subscriptions (only re-render when needed)
- Simple API with hooks
- Easy persistence integration
- Already in project dependencies

---

### Decision: Separate vector index from tldraw store

**Context**: Where to store embedding vectors for similarity search.

**Choice**: Separate Zustand store synced via `useVectorIndexSync`

**Alternatives Considered**:
- Store in shape.meta only - Would need to iterate all shapes for search
- Store in tldraw's global state - Not designed for this use case
- External database - Overkill for client-side app

**Rationale**:
- Fast O(n) similarity search without shape iteration
- Clear separation between canvas state and search index
- Can optimize index structure independently
- Sync hook keeps them in sync automatically

---

### Decision: Cosine similarity via dot product

**Context**: How to calculate similarity between embeddings.

**Choice**: Simple dot product (vectors are pre-normalized)

**Alternatives Considered**:
- Full cosine formula with magnitude - Unnecessary computation
- Euclidean distance - Different semantic meaning
- Approximate nearest neighbor (ANN) - Overkill for <1000 cards

**Rationale**:
- MiniLM outputs normalized vectors
- Dot product = cosine similarity for unit vectors
- O(d) where d=384 dimensions
- Fast enough for real-time checks

---

### Decision: Check only top-1 match for duplicate detection

**Context**: How many similar cards to check when detecting duplicates.

**Choice**: Query top-1 match only

**Alternatives Considered**:
- Top-k matches - More info but adds complexity
- All matches above threshold - Could be many on large canvases

**Rationale**:
- Duplicate detection only needs the closest match
- Simpler UX (one warning per card)
- Performance: stops after finding best match
- Related cards (top-k) saved for Phase 4 sidebar

---

### Decision: Warning badge positioned below card

**Context**: Where to show duplicate/similar warning.

**Choice**: Badge below card, outside card bounds

**Alternatives Considered**:
- Inside card - Overlaps content
- Top of card - Conflicts with embedding indicator
- Side panel - Requires navigation away from card

**Rationale**:
- Visible without obscuring card content
- Clear association with specific card
- Tooltip expands on hover with full details
- Dismiss button easily accessible

---

### Decision: Two-level threshold (similar vs duplicate)

**Context**: How to categorize similarity results.

**Choice**:
- ≥0.92: Duplicate (red, strong warning)
- ≥0.85: Similar (orange, informational)

**Alternatives Considered**:
- Single threshold - Less nuanced
- Three+ levels - Diminishing returns, confusing UX

**Rationale**:
- Per spec thresholds (0.92, 0.85, 0.70)
- Red = "you probably don't need this card"
- Orange = "you might want to check this"
- Clear visual distinction (color + label)

---

### Decision: Dismiss clears duplicate info but allows re-detection

**Context**: What happens when user dismisses a warning.

**Choice**: Set duplicateOf and similarityScore to null

**Alternatives Considered**:
- Permanent dismiss flag - Complicates logic
- Never dismiss - Annoying UX
- Dismiss until content changes - Hard to track

**Rationale**:
- Simple implementation (just clear the fields)
- If user edits card, it will be re-embedded and re-checked
- User can always dismiss again if warning returns
- No permanent state to manage

---

### Decision: Vector index persistence in IndexedDB

**Context**: Should vector index survive page refresh.

**Choice**: Persist to IndexedDB with auto-save on changes

**Alternatives Considered**:
- Rebuild from embeddings on load - Slow for many cards
- Don't persist - Loses search capability until re-embedded
- Persist with canvas snapshot - Tight coupling

**Rationale**:
- Instant search capability on page load
- Separate key allows independent versioning
- Auto-save ensures consistency
- Minimal storage overhead (384 floats per card)

---

## 2025-12-30 (Phase 2)

### Decision: Web Worker for embedding generation

**Context**: Embedding generation is CPU-intensive and would block the UI thread.

**Choice**: Dedicated Web Worker (`embedding.worker.ts`)

**Alternatives Considered**:
- Main thread with `requestIdleCallback` - Still blocks during computation
- WebAssembly without worker - Same blocking issue
- Server-side embeddings - Violates local-first principle

**Rationale**:
- Complete UI isolation during model inference
- Model loads once, persists in worker memory
- Transformers.js works well in Web Workers
- Natural message-based API for queue handling

---

### Decision: Quantized model for faster loading

**Context**: all-MiniLM-L6-v2 has multiple precision options.

**Choice**: Quantized (8-bit) version via `quantized: true`

**Alternatives Considered**:
- Full precision (FP32) - Larger download, slower load
- FP16 - Middle ground but less browser support

**Rationale**:
- ~4x smaller download size
- Faster initial load (<3s target)
- Minimal quality loss for semantic similarity
- Better memory footprint in browser

---

### Decision: Singleton EmbeddingPipeline pattern

**Context**: Need to manage worker lifecycle and queue across components.

**Choice**: Singleton class with lazy initialization

**Alternatives Considered**:
- React context - Couples embedding to React tree
- Zustand store - Overkill for worker management
- Multiple workers - Complexity, memory overhead

**Rationale**:
- Single worker instance, single model load
- Can be imported anywhere without React
- Queue naturally serializes requests
- Clean API: `embeddingPipeline.embed(id, text)`

---

### Decision: Store embeddings as number[] in meta

**Context**: How to persist embeddings with the shape.

**Choice**: Store as `number[]` in `shape.meta.embedding`

**Alternatives Considered**:
- Separate IndexedDB store - Sync complexity
- Float32Array directly - Not JSON-serializable
- Base64 encoded - Parsing overhead

**Rationale**:
- tldraw automatically persists shape.meta
- JSON-serializable for snapshot storage
- Convert to Float32Array only when needed for computation
- No separate sync logic required

---

### Decision: Content hash for embedding deduplication

**Context**: Avoid re-embedding unchanged content.

**Choice**: Hash `${title}::${content}` and track per card

**Alternatives Considered**:
- Compare embedding timestamps - Miss unchanged edits
- Always re-embed - Wasteful, slow
- Deep equality check - Complex for large content

**Rationale**:
- Simple string comparison
- Catches all content changes
- Minimal memory overhead (Map of strings)
- Clear invalidation on actual changes

---

### Decision: Two-phase loading indicator

**Context**: Model loading can take 3-10+ seconds on first load.

**Choice**:
- Full overlay when progress < 10%
- Subtle corner indicator for rest of loading

**Alternatives Considered**:
- Always full overlay - Blocks interaction too long
- Always subtle - User might not notice
- No indicator - Confusing UX

**Rationale**:
- Initial phase: user expects loading, show full feedback
- Later phases: model is downloading, let user explore canvas
- Balance between feedback and usability
- Cached model loads faster on subsequent visits

---

### Decision: Visual embedding status on cards

**Context**: Users should know when embeddings are ready.

**Choice**: Small colored dot in top-right corner
- Blue pulsing: embedding in progress
- Green static: embedding complete

**Alternatives Considered**:
- Border glow - Too prominent, distracting
- Icon badge - Takes up too much space
- No indicator - Users can't verify system is working

**Rationale**:
- Minimal visual footprint
- Clear state distinction via color
- Animation draws attention during processing
- Subtle when complete (low opacity green)

---

## 2025-12-30 (Phase 1)

### Decision: Use tldraw v4 instead of v2/v3

**Context**: tldraw has multiple major versions with different APIs.

**Choice**: tldraw v4.2.1 (latest)

**Rationale**:
- Latest API improvements and bug fixes
- Better TypeScript support
- Improved custom shape API with `BaseBoxShapeUtil`
- Active development and documentation

---

### Decision: idb-keyval for persistence instead of raw IndexedDB

**Context**: Need to persist canvas state to survive page refreshes.

**Choice**: idb-keyval

**Alternatives Considered**:
- Raw IndexedDB API - More complex, requires manual transaction handling
- localStorage - Limited to 5-10MB, synchronous, would block UI
- Dexie.js - Full-featured but overkill for simple key-value storage

**Rationale**:
- Simple key-value API (`get`, `set`)
- Promise-based, non-blocking
- Minimal bundle size (~600 bytes)
- Already in project dependencies
- Sufficient for storing tldraw snapshots

---

### Decision: Debounced saves (500ms) instead of immediate

**Context**: Canvas changes can be frequent during drawing/editing.

**Choice**: 500ms debounce on saves

**Rationale**:
- Prevents excessive IndexedDB writes during rapid changes
- Acceptable data loss window (max 500ms of work)
- Reduces potential performance impact
- Good balance between responsiveness and efficiency

---

### Decision: Store full TLStoreSnapshot instead of incremental changes

**Context**: How to represent canvas state in storage.

**Choice**: Full snapshot on each save

**Alternatives Considered**:
- Incremental changes/patches - More complex, requires conflict resolution
- Custom serialization - Maintenance burden, potential compatibility issues

**Rationale**:
- Simple to implement and debug
- tldraw provides `getSnapshot()`/`loadSnapshot()` methods
- Snapshots are relatively small for typical use
- No migration complexity between versions (tldraw handles it)

---

### Decision: IdeaCard as custom shape instead of note shape customization

**Context**: Need card-like elements for ideas on canvas.

**Choice**: Create custom `IdeaCardShape` extending `BaseBoxShapeUtil`

**Alternatives Considered**:
- Customize built-in note shape - Limited flexibility, harder to add semantic features
- Use frame shape - Different visual metaphor, not suited for atomic ideas

**Rationale**:
- Full control over rendering and behavior
- Can add custom properties (embeddings, metadata) later
- Clean separation from tldraw internals
- Sticky-note visual matches mental model of "idea cards"

---

### Decision: Separate shape definition from util

**Context**: How to organize custom shape code.

**Choice**:
- `IdeaCardShape.ts` - Type definitions and prop validators
- `IdeaCardUtil.tsx` - Rendering and behavior logic

**Rationale**:
- Types can be imported without pulling in React/rendering code
- Cleaner separation of concerns
- Easier to test type definitions independently
- Follows tldraw's recommended patterns
