# Technical Decisions

## 2025-12-31 (Session 7 - UI Layout Fix & Windows Build)

### Decision: Dedicated header bar instead of floating buttons

**Context**: Custom UI buttons (hamburger menu, Search, Chat) were overlapping tldraw's native toolbar, covering important icons.

**Choice**: Create a fixed 48px header bar above the canvas area

**Alternatives Considered**:
- Adjust button positioning to avoid toolbar - Fragile, toolbar layout may change
- Hide tldraw's toolbar entirely - Loses useful functionality
- Use tldraw's component override for toolbar - Complex, may break with updates

**Rationale**:
- Clear separation between custom controls and tldraw UI
- Consistent header across all states (search open, chat open, etc.)
- Layout uses flex-column, pushing canvas below header naturally
- tldraw operates in its own contained area without interference

---

### Decision: Move ImportExportMenu logic into App.tsx

**Context**: ImportExportMenu was a separate component with its own absolute positioning that conflicted with new header layout.

**Choice**: Inline the import/export logic directly in App.tsx's HeaderToolbar

**Alternatives Considered**:
- Refactor ImportExportMenu to accept position props - Extra complexity
- Keep ImportExportMenu and render in header - Component doing too little
- Create new HeaderMenu component - Unnecessary abstraction

**Rationale**:
- Simpler code with fewer component boundaries
- Header already manages menu open state
- Import dialog can use App's showSuccess/showError directly
- Removed one file from components/index.ts exports

---

### Decision: Disable Windows code signing in electron-builder

**Context**: Windows build failed due to symlink permission errors when extracting winCodeSign tools.

**Choice**: Add `"signAndEditExecutable": false` to win config in electron-builder.json5

**Alternatives Considered**:
- Run build as Administrator - User inconvenience, security concerns
- Enable Windows Developer Mode - Requires system settings change
- Use different code signing approach - Overkill for personal project

**Rationale**:
- Build completes successfully without Admin rights
- App still works, just shows SmartScreen warning on first run
- Can add proper signing later with certificate
- Common workaround for open-source Electron apps

---

### Known Issue: winCodeSign Symlink Permission Error

**Context**: electron-builder downloads winCodeSign tools that contain macOS symlinks, which Windows can't create without Admin/Developer Mode.

**Symptom**: Build fails with "Cannot create symbolic link: A required privilege is not held by the client"

**Root Cause**: The winCodeSign archive contains darwin-specific symlinks (libcrypto.dylib, libssl.dylib) that 7-Zip tries to create even on Windows.

**Solution**: Add to electron-builder.json5:
```json
{
  "win": {
    "signAndEditExecutable": false
  }
}
```

**Prevention**: For signed releases, either:
1. Build on a machine with Admin rights
2. Enable Windows Developer Mode (Settings > For developers)
3. Set up proper code signing certificate

---

## 2025-12-31 (Session 6 - Electron Desktop App)

### Decision: electron-vite instead of plain Electron + Vite

**Context**: Need to bundle React app with Electron main/preload processes.

**Choice**: electron-vite package for unified build tooling

**Alternatives Considered**:
- Manual Vite + Electron configuration - Complex, error-prone
- electron-forge - More opinionated, heavier
- electron-builder only - No dev server integration

**Rationale**:
- Single config file for main, preload, and renderer
- Hot reload for renderer in dev mode
- Built-in externalization of Electron dependencies
- Works with existing Vite React setup

---

### Decision: app.isPackaged for dev mode detection

**Context**: Need to load dev server URL in development, file in production.

**Choice**: Check `app.isPackaged` property

**Alternatives Considered**:
- `process.env.NODE_ENV` - Not reliably set in Electron
- `process.env.VITE_DEV_SERVER_URL` - electron-vite doesn't set this
- `process.env.ELECTRON_RENDERER_URL` - Only works with some configs

**Rationale**:
- Electron's built-in property, always accurate
- Works regardless of build tool configuration
- Simple boolean check, no string parsing
- Works in all Electron versions

---

### Decision: Global shortcuts via Electron instead of browser

**Context**: Quick Capture (Ctrl+Shift+N) and Search (Ctrl+Shift+K) should work globally.

**Choice**: Use Electron's `globalShortcut.register()` in main process

**Alternatives Considered**:
- Browser keyboard events - Only work when window is focused
- OS-level hook libraries - Platform-specific, complex
- Always-on-top window - Annoying UX

**Rationale**:
- Works even when window is hidden/minimized
- Cross-platform support built-in
- Can show window and trigger IPC event in one action
- Unregistered automatically on quit

---

### Decision: System tray with minimize-to-tray

**Context**: App should be quickly accessible without taking taskbar space.

**Choice**: System tray icon with context menu, window hides on close

**Alternatives Considered**:
- Always visible taskbar window - Takes space, not always needed
- Close = quit - User loses quick access
- Background service - Overkill for note app

**Rationale**:
- Standard desktop app pattern
- Quick access via tray click or hotkeys
- Quit explicitly via tray menu
- Familiar UX for power users

---

### Decision: Preload script in separate output directory

**Context**: electron-vite outputs main.js and preload.js to different directories.

**Choice**: Accept default `out/preload/preload.js` path, use `../preload/preload.js` from main

**Alternatives Considered**:
- Output both to same directory - Requires config changes, may conflict
- Embed preload code in main - Violates Electron security model
- Use absolute paths - Breaks in different install locations

**Rationale**:
- Follows electron-vite conventions
- Relative path works in dev and production
- Clear separation of process code
- Easy to understand build output structure

---

### Decision: Base64 fallback for tray icon

**Context**: Tray icon file might not exist during development or if resources are missing.

**Choice**: Check file existence, fall back to base64 data URL icon

**Alternatives Considered**:
- Require icon file always - Breaks if missing
- Use Electron's default empty icon - Invisible, confusing
- Skip tray if no icon - Loses functionality

**Rationale**:
- Graceful degradation
- Always shows something visible in tray
- Actual PNG file used when available
- Minimal code overhead

---

### Known Issue: Electron Binary Caching on Windows

**Context**: npm downloads Electron binaries to a global cache. Version mismatches cause runtime errors.

**Symptom**: `electron.app.requestSingleInstanceLock()` returns `undefined`, console shows wrong Node.js version.

**Root Cause**: `%LOCALAPPDATA%\electron\Cache\` contains old binary (e.g., v18.18.2) but package.json specifies newer version (v28.0.0). npm reuses cached binary without version check.

**Solution**: Clear Electron cache and reinstall:
```powershell
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\electron\Cache"
npm uninstall electron && npm install electron@28.0.0 --save-dev
```

**Prevention**: Always verify with `node_modules/electron/dist/electron.exe --version` after install.

---

## 2025-12-31 (Session 5 - MCP Server)

### Decision: File-based sync instead of direct IPC

**Context**: Browser app uses IndexedDB, MCP server is Node.js process. Need to bridge data between them.

**Choice**: JSON files in `~/.semanticanvas/` for data exchange

**Alternatives Considered**:
- WebSocket bridge - Requires browser app always running
- Shared SQLite - Complex setup, browser compatibility issues
- HTTP API from browser - Security concerns, CORS complexity

**Rationale**:
- Simple and robust for MVP
- Works offline, no server dependencies
- Browser exports on changes, MCP reads on startup
- Separate files for read (notes.json) and write (pending.json) avoid conflicts
- User can inspect/backup data easily

---

### Decision: Separate MCP package instead of monorepo integration

**Context**: Where to place MCP server code relative to browser app.

**Choice**: Separate `mcp-server/` directory with own package.json

**Alternatives Considered**:
- Same package with conditional imports - Complex, Node vs browser conflicts
- Shared monorepo with workspace - Overkill for two packages
- Completely separate repo - Harder to maintain together

**Rationale**:
- Clean separation of Node.js and browser code
- Independent dependencies (MCP SDK, Transformers.js for Node)
- Can build/deploy independently
- Shared types could be extracted later if needed

---

### Decision: stdio transport instead of HTTP/SSE

**Context**: How MCP server communicates with Claude Desktop.

**Choice**: StdioServerTransport from @modelcontextprotocol/sdk

**Alternatives Considered**:
- HTTP transport - Requires port management, firewall issues
- SSE transport - More complex setup

**Rationale**:
- Standard for Claude Desktop MCP servers
- No network configuration needed
- Process lifecycle managed by Claude Desktop
- Simple JSON-RPC over stdin/stdout

---

### Decision: In-memory vector index with startup load

**Context**: How to provide fast semantic search in MCP server.

**Choice**: Load all embeddings into Map on startup

**Alternatives Considered**:
- Query from file each time - Too slow for interactive use
- Persistent vector DB (e.g., ChromaDB) - Overkill, adds dependency
- SQLite with vector extension - Complex setup

**Rationale**:
- Fast O(n) search for typical note counts (<1000)
- Simple implementation with Map<string, number[]>
- Reuses similarity.ts logic from browser app
- Startup cost acceptable (3-10s including model load)

---

### Decision: Same embedding model as browser app

**Context**: Which model to use for MCP server embeddings.

**Choice**: Xenova/all-MiniLM-L6-v2 (384 dimensions, quantized)

**Alternatives Considered**:
- Different model for "better" results - Incompatible embeddings
- OpenAI/Anthropic API embeddings - Violates local-first principle

**Rationale**:
- Exact same vectors as browser-generated embeddings
- Can compare MCP-generated and browser-generated embeddings
- No API keys or network required
- Consistent similarity scores across both environments

---

### Decision: Pending.json for write-back instead of direct merge

**Context**: How MCP-created notes get into browser app.

**Choice**: Write new notes to separate pending.json file

**Alternatives Considered**:
- Append to notes.json - Risks corrupting browser export
- Database with conflict resolution - Complex
- Real-time sync - Requires always-on browser

**Rationale**:
- Safe: never modifies browser's export file
- Browser can import pending notes on next load
- Clear separation of concerns
- Easy to implement merge logic in browser later

---

### Decision: Duplicate warning but still create note

**Context**: What happens when MCP create_note detects a similar note.

**Choice**: Create note anyway, return warning in response

**Alternatives Considered**:
- Block creation - Frustrating if similarity is coincidental
- Require confirmation - MCP tools are single-request
- Silent creation - User might not realize duplicate exists

**Rationale**:
- Informative: AI/user knows about potential duplicate
- Non-blocking: note still gets created
- Consistent with browser app behavior (warning, not prevention)
- AI can decide to delete if truly duplicate

---

### Decision: Zod for input validation

**Context**: How to validate MCP tool inputs.

**Choice**: Zod schemas for all tool inputs

**Alternatives Considered**:
- Manual validation - Error-prone, verbose
- JSON Schema directly - Less TypeScript integration
- io-ts - More complex API

**Rationale**:
- MCP SDK has native Zod integration
- Type inference from schemas
- Clear error messages for invalid inputs
- Consistent with modern TypeScript patterns

---

## 2025-12-30 (Session 2 - UI Polish)

### Decision: Clear Canvas button with confirmation

**Context**: Users need a way to reset the canvas and start fresh without using URL parameters or DevTools.

**Choice**: Floating button in top-right corner with modal confirmation dialog

**Alternatives Considered**:
- Menu item in tldraw's menu - Harder to discover
- Keyboard shortcut only - Not intuitive for casual users
- Auto-clear on certain conditions - Too risky

**Rationale**:
- Visible but unobtrusive placement
- Red hover state clearly indicates destructive action
- Confirmation prevents accidental data loss
- Clears both canvas shapes AND vector index atomically

---

### Decision: Canvas/vector index sync on load

**Context**: Vector index can become stale if the app crashes or closes unexpectedly, leading to false duplicate matches.

**Choice**: Clear vector index when canvas is empty or corrupted on load

**Alternatives Considered**:
- Always rebuild index from shapes - Expensive for many cards
- Trust both stores independently - Can cause false duplicates
- Warn user about desync - Adds complexity

**Rationale**:
- Simple rule: empty canvas = empty index
- Prevents ghost entries from causing self-matches
- Automatic, no user intervention needed
- Safe: only clears when canvas is definitively empty

---

### Decision: setTimeout(0) for duplicate check timing

**Context**: Race condition between `useVectorIndexSync` and `useDuplicateCheck` - both listen to same store events.

**Choice**: Defer duplicate check with `setTimeout(0)` to ensure vector index is updated first

**Alternatives Considered**:
- Explicit ordering via shared state - Complex
- Single combined hook - Violates separation of concerns
- Event-based coordination - Overkill

**Rationale**:
- setTimeout(0) defers to next microtask after all sync listeners complete
- Zero-delay is sufficient (not a true async operation)
- Minimal code change, no architectural impact
- Works reliably across all browsers

---

### Decision: Explicit onDoubleClick handler for edit mode

**Context**: tldraw's default double-click handling wasn't triggering edit mode for custom shapes.

**Choice**: Override `onDoubleClick` in ShapeUtil and explicitly call `setEditingShape()`

**Alternatives Considered**:
- Rely on tldraw's default behavior - Wasn't working
- Click handler with timer - Complex, unreliable
- Always-editable mode - Bad UX

**Rationale**:
- Explicit is better than implicit
- Works regardless of tldraw's internal state
- Clear intent in code
- Combined with conditional `stopEventPropagation` for proper event flow

---

### Decision: Separate overrides prop for tool UI

**Context**: IdeaCard tool was registered but not appearing in toolbar.

**Choice**: Use tldraw v4's `overrides` prop to define tool UI separately from behavior

**Alternatives Considered**:
- Hack tldraw internals - Fragile, version-dependent
- Custom toolbar from scratch - Too much work
- Wait for tldraw fix - Not a bug, by design

**Rationale**:
- Follows tldraw v4's intended architecture
- Clean separation: behavior (tools) vs UI (overrides)
- Allows customization of icon, label, keyboard shortcut
- Future-proof as tldraw evolves

---

## 2025-12-30 (Session 1 - Bug Fixes)

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
