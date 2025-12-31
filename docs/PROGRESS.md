# Daily Progress Tracker

## 2025-12-31 - Session 6: Electron Desktop App

### Completed
- [x] Created Electron main process with window management
- [x] Created preload script with IPC bridge for renderer
- [x] Implemented global hotkeys (Ctrl+Shift+N, Ctrl+Shift+K)
- [x] Added system tray with context menu and minimize-to-tray
- [x] Single instance enforcement
- [x] File system IPC for MCP server sync
- [x] Created electron-vite configuration
- [x] Created electron-builder configuration for Windows
- [x] Updated App.tsx with Electron shortcut listeners
- [x] Created tray icon (teal 16x16 PNG)

### Files Created
- `electron/main.ts` - Main process with BrowserWindow, tray, global shortcuts, IPC
- `electron/preload.ts` - IPC bridge exposing electronAPI to renderer
- `electron/electron-env.d.ts` - TypeScript declarations for Electron env
- `electron.vite.config.ts` - electron-vite build configuration
- `electron-builder.json5` - Packaging configuration for Windows/Mac/Linux
- `src/lib/electron.ts` - Renderer-side API wrapper and helpers
- `resources/tray-icon.png` - 16x16 teal system tray icon

### Files Modified
- `package.json` - Added electron scripts and dependencies
- `tsconfig.node.json` - Added electron files to include
- `src/App.tsx` - Added Electron shortcut listeners
- `src/lib/index.ts` - Added electron exports

### Architecture

```
Electron Main Process (electron/main.ts)
        |
        |-- BrowserWindow (loads renderer)
        |-- Tray (system tray icon)
        |-- globalShortcut (Ctrl+Shift+N, Ctrl+Shift+K)
        |-- IPC handlers (fs:exportNotes, fs:importPending)
        |
        v
Preload Script (electron/preload.ts)
        |
        |-- contextBridge.exposeInMainWorld('electronAPI', ...)
        |
        v
Renderer Process (src/App.tsx)
        |
        |-- window.electronAPI.onQuickCapture()
        |-- window.electronAPI.onSearch()
        |-- window.electronAPI.exportNotes()
        |-- window.electronAPI.importPending()
```

### Scripts
- `npm run dev:electron` - Development mode with hot reload
- `npm run build:electron` - Build for production
- `npm run package:win` - Package Windows installer (.exe)

### Known Issue: Electron Binary Version Mismatch (Windows)

**Symptom**: `electron.app.requestSingleInstanceLock()` returns undefined, error shows wrong Node.js version (e.g., v18.18.2 instead of v28.0.0).

**Cause**: Windows caches Electron binaries in `%LOCALAPPDATA%\electron\Cache\`. When upgrading Electron versions, npm may reuse the cached old binary even though package.json specifies a newer version.

**Solution**:
```powershell
# Clear Electron cache
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\electron\Cache"

# Reinstall electron
cd C:\Projects\LeuCanvas-1
npm uninstall electron
npm install electron@28.0.0 --save-dev
```

**Verification**:
```bash
node_modules/electron/dist/electron.exe --version
# Should show: v28.0.0
```

### Notes
- Electron v28.0.0 required for ES module compatibility
- Preload script output to `out/preload/preload.js` (path: `../preload/preload.js` from main)
- Dev mode uses `app.isPackaged` check to load `http://localhost:5173`
- Tray icon fallback creates icon from base64 data URL if file missing
- Global shortcuts work even when window is hidden/minimized

---

## 2025-12-31 - Session 5: MCP Server Integration

### Completed
- [x] Created mcp-server package with npm dependencies
- [x] Implemented storage layer with JSON file sync
- [x] Integrated Transformers.js (Xenova/all-MiniLM-L6-v2) for embeddings
- [x] Implemented 5 MCP tools: search_notes, create_note, get_note, find_related, list_notes
- [x] Added duplicate detection on note creation (>92% similarity warning)
- [x] Created test data at ~/.semanticanvas/notes.json
- [x] Built and tested MCP server successfully
- [x] Updated project README with MCP integration docs

### Files Created
- `mcp-server/package.json` - Package config with @modelcontextprotocol/sdk, @xenova/transformers, zod
- `mcp-server/tsconfig.json` - TypeScript configuration for NodeNext modules
- `mcp-server/src/types.ts` - Note, NotesExport, PendingNotes interfaces
- `mcp-server/src/lib/similarity.ts` - cosineSimilarity and findTopK functions
- `mcp-server/src/lib/storage.ts` - JSON file I/O, embeddings, pending notes
- `mcp-server/src/index.ts` - MCP server with stdio transport and 5 tools
- `mcp-server/README.md` - Setup and usage instructions

### Files Modified
- `README.md` - Complete rewrite with project overview and MCP integration docs

### Architecture

```
Browser App (IndexedDB)
        |
        | export on changes
        v
~/.semanticanvas/notes.json  <-- MCP server reads on startup
        |
        | MCP creates new notes
        v
~/.semanticanvas/pending.json --> Browser imports on load
```

### MCP Tools Implemented

| Tool | Description |
|------|-------------|
| `search_notes` | Semantic search with minSimilarity threshold |
| `create_note` | Create note with duplicate detection |
| `get_note` | Retrieve note by ID |
| `find_related` | Find related notes by ID or text |
| `list_notes` | List/filter notes by tags with pagination |

### Configuration

Claude Desktop (`%APPDATA%\Claude\claude_desktop_config.json`):
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

### Notes
- MCP server loads embedding model on startup (~3-10s first load)
- Embeddings generated for notes missing them from JSON export
- Pending notes written to separate file for browser app to import
- Server runs via stdio transport for Claude Desktop compatibility

---

## 2025-12-30 - Session 4: Phase 5 Quick Capture & Polish

### Completed
- [x] Created QuickCapture modal component with duplicate detection
- [x] Integrated quick capture with Ctrl/Cmd+Shift+N hotkey
- [x] Added keyboard navigation to SearchPanel (↑↓ + Enter)
- [x] Fixed UI layout issues (search button, sidebar z-index)
- [x] Moved Clear All button to bottom-right to avoid tldraw overlap

### Files Created
- `src/components/QuickCapture.tsx` - Quick capture modal with pre-creation duplicate warning

### Files Modified
- `src/App.tsx` - Added QuickCapture integration, moved search button to top:60
- `src/components/index.ts` - Added QuickCapture export
- `src/components/SearchPanel.tsx` - Added keyboard navigation (arrow keys + Enter)
- `src/components/RelatedSidebar.tsx` - Added z-index:100 to all container variants

### Features

**Quick Capture Modal (F5)**
- Global hotkey: Ctrl/Cmd+Shift+N
- Title input (auto-focused) + Content textarea
- Live duplicate detection as user types (debounced 500ms)
- Shows warning with similar cards before creation
- Click warning to navigate to existing card
- Creates card at viewport center
- Ctrl+Enter to create, Esc to cancel

**Search Panel Improvements**
- Arrow key navigation through results
- Enter to select highlighted result
- Mouse hover updates selection
- Visual highlight for selected result (blue border)
- Footer shows keyboard hints

**Layout Fixes**
- Search button moved to top:60 (below tldraw toolbar)
- Clear All button moved to bottom-right
- Sidebars have z-index:100 (above tldraw style panel)
- Canvas container has overflow:hidden

### Notes
- Phase 5 (final phase) is now complete
- All core features implemented: canvas, embedding, duplicate detection, search, related cards, quick capture
- App is ready for production use

---

## 2025-12-30 - Session 3: Phase 4 Search & Discovery

### Completed
- [x] Created SearchPanel component with semantic search
- [x] Created RelatedSidebar component for related cards
- [x] Created useHotkeys hook for keyboard shortcuts
- [x] Implemented three-column layout (Search | Canvas | Related)
- [x] Added Ctrl+K / Cmd+K shortcut to toggle search panel
- [x] Added search button in toolbar when search panel is closed

### Files Created
- `src/components/SearchPanel.tsx` - Semantic search panel with debounced embedding
- `src/components/RelatedSidebar.tsx` - Shows top-5 related cards for selected card
- `src/hooks/useHotkeys.ts` - Keyboard shortcut handler

### Files Modified
- `src/App.tsx` - Three-column layout, search/sidebar state, hotkeys integration
- `src/components/index.ts` - Added SearchPanel and RelatedSidebar exports
- `src/hooks/index.ts` - Added useHotkeys export
- `src/hooks/usePersistence.ts` - Fixed TypeScript error with store type casting

### Features

**Semantic Search (F4)**
- Left sidebar panel toggled with Ctrl/Cmd+K
- Debounced search input (300ms)
- Embeds query text using same model as cards
- Shows top-10 results with similarity scores
- Click result to navigate and select card
- Color-coded similarity: red (>92%), orange (85-92%), green (70-85%)

**Related Cards Sidebar (F6)**
- Right sidebar visible when IdeaCard is selected
- Shows top-5 semantically related cards above 70% similarity
- Updates when selection changes
- Click to navigate to related card
- Collapsible with toggle button

**Keyboard Shortcuts**
- `Ctrl/Cmd+K` - Toggle search panel
- `Ctrl/Cmd+Shift+N` - Quick capture (Phase 5 stub)

### Next Steps
- Phase 5: Quick Capture (global shortcut, quick input dialog)
- Phase 6: Polish & Performance

---

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
