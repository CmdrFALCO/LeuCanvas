# LLM-Powered Semantic Search Tools for Visual Idea Capture

**AFFiNE emerges as the only open source tool combining infinite canvas, built-in vector embeddings, and semantic search—though no tool offers duplicate detection out of the box.** For organizations requiring this specific capability, extending existing projects or building on tldraw represents the most viable path. The landscape reveals a fundamental gap: visual canvas tools lack semantic intelligence, while semantic search tools lack visual interfaces.

## How the field divides into distinct approaches

Open source tools for LLM-powered idea capture cluster into three architectural paradigms, each with trade-offs against the core requirements of visual interface, semantic search, and duplicate detection.

**Canvas-first tools** like tldraw, Excalidraw, and DeepNotes provide excellent infinite canvas experiences but have no semantic capabilities. These tools treat content as visual objects without understanding meaning. **Search-first tools** like Khoj and txtai offer sophisticated RAG pipelines with bi-encoder/cross-encoder architectures but present list-based interfaces. **Hybrid tools** attempting both remain rare—AFFiNE stands alone with its Edgeless whiteboard mode backed by pgvector embeddings, though this integration remains beta quality for self-hosted deployments.

The architectural divide reflects different engineering priorities: canvas tools optimize for real-time rendering and collaboration, while semantic tools optimize for embedding quality and retrieval precision. Bridging these requires significant integration work that most projects haven't undertaken.

## Project-by-project evaluation against requirements

### AFFiNE scores highest overall

**Visual interface**: Full infinite canvas via "Edgeless Mode" built on tldraw, featuring sticky notes, shapes, connectors, mind maps, and frame containers. Cards support multiple visual styles including textured backgrounds and paper effects.

**Semantic search**: Uses **pgvector** extension for PostgreSQL storing embeddings, with configurable providers including Gemini (default for embeddings) and OpenAI. The `doc_semantic_search` function enables meaning-level matching across documents. Implementation quality is **beta** for self-hosted instances—full feature parity with their cloud service not yet achieved.

**Duplicate detection**: Not implemented, but highly feasible to add given existing pgvector infrastructure. Would require a background job comparing new content embeddings against existing vectors with threshold-based alerts.

**Self-hosted**: Docker Compose deployment available with PostgreSQL + Redis containers. Core philosophy is "you always own your data," though full AI features require server-side indexer service rather than pure local operation.

**Capture friction**: Medium—quick note creation available in canvas mode with one-click conversion between document and whiteboard views. Mobile apps exist for iOS and Android.

### Reor excels at local-first semantic search

**Visual interface**: Traditional markdown editor, Obsidian-like. **No infinite canvas**. File tree sidebar with related notes panel showing semantic connections.

**Semantic search**: Excellent implementation using **LanceDB** (embedded vector database) and **Transformers.js** running `Xenova/all-MiniLM-L6-v2` (384 dimensions) entirely in-browser. Notes are chunked, embedded locally, and stored in LanceDB within the vault directory. Cosine similarity powers the related notes feature.

**Duplicate detection**: Not implemented, but the architecture makes extension straightforward—query the vector DB with new content before insertion.

**Self-hosted**: **100% local** with no cloud dependencies. Embedding models run on-device via Transformers.js. LLM integration through Ollama or Llama.cpp.

**Capture friction**: Medium—desktop app focused, requires opening the application to create notes. Not optimized for fleeting thoughts.

### Blinko provides lowest capture friction

**Visual interface**: **Card-based/post-it style** timeline view distinguishing between "Blinko" (quick thoughts) and "Note" (longer content). No infinite canvas—chronological feed with tag-based filtering.

**Semantic search**: PostgreSQL with **pgvector** handles vector storage. Embedding models configurable through OpenAI or Ollama (e.g., `mxbai-embed-large`, `nomic-embed-text`). RAG pipeline via `@mastra/rag` with optional reranker support (`bge-reranker-v2-m3`).

**Duplicate detection**: Not implemented. PostgreSQL + pgvector architecture well-suited for adding pre-insert similarity checking.

**Self-hosted**: Docker deployment with local Ollama for full privacy. Tauri enables desktop apps across Windows, macOS, Linux, plus mobile.

**Capture friction**: **Low**—designed for "capturing fleeting thoughts instantly." Desktop quick note popup, text selection toolbar, Android share integration, and offline voice recognition via Whisper.

### Khoj offers most sophisticated RAG pipeline

**Visual interface**: Web-based chat interface—**no canvas or visual organization**. List-based search results with conversation threads.

**Semantic search**: Industry-standard two-stage retrieval with **bi-encoder for initial retrieval** (Sentence Transformers) plus **cross-encoder for re-ranking** (`cross-encoder/ms-marco-MiniLM-L-6-v2`). Vector storage via **pgvector**. Supports OpenAI embeddings or local models. Multilingual capability across 50+ languages.

**Duplicate detection**: Not explicit feature, but semantic search naturally surfaces near-duplicates. Extension requires API modification to accept query text and compare against existing embeddings before capture.

**Self-hosted**: Complete self-hosting with Docker. Supports local LLMs via Ollama, llama-cpp-python, or LM Studio. Minimum 8GB RAM, recommended 16GB VRAM for local models.

**Capture friction**: Variable—low friction for existing Obsidian/Emacs users via plugins, higher initial setup complexity for self-hosting.

### Obsidian Smart Connections integrates seamlessly

**Visual interface**: **List-based connections sidebar** within Obsidian. Community plugins add graph visualization (Smart Connections Visualizer). No native canvas—relies on Obsidian's ecosystem.

**Semantic search**: Local JSON file storage for embeddings. Default model **TaylorAI/bge-micro-v2** (384 dimensions) runs via transformers.js with zero API keys required. Block-level granularity enables precise matching. Near-instant search (<50ms) with pre-computed embeddings.

**Duplicate detection**: Implicit through Connections view showing related notes. **Lowest extension difficulty**—already computes similarity for all notes; would need threshold-based flagging and pre-capture hook.

**Self-hosted**: **Zero-setup local operation**—install plugin, immediately functional. All data stays in local `.smart-env/` folder. No telemetry.

**Capture friction**: Very low—standard Obsidian workflow with automatic indexing. Mobile support on both iOS and Android.

### tldraw provides best foundation for custom solutions

**Visual interface**: Mature infinite canvas SDK with **41.7K GitHub stars**. Best-in-class pressure-sensitive ink, rich content embedding, shapes, arrows, and collaboration features.

**Semantic search**: **Not implemented**. However, architecture is highly extensible—shapes store JSON with `meta` property for custom data, reactive `TLStore` supports computed caches and queries, side effects system triggers on create/update events.

**Duplicate detection**: Not implemented. Would add via custom `IdeaShape` with embedding in meta, side effects generating embeddings on creation, and similarity query before insertion.

**Self-hosted**: Built-in local persistence via IndexedDB. Self-hosted multiplayer available via Cloudflare Durable Objects template.

**Capture friction**: Depends on implementation—SDK provides tools, not finished product.

## Architecture comparison across embedding implementations

| Project | Vector Database | Embedding Model | Dimensions | Local Inference |
|---------|-----------------|-----------------|------------|-----------------|
| **AFFiNE** | pgvector (PostgreSQL) | Gemini/OpenAI configurable | Variable | No (requires API) |
| **Reor** | LanceDB (embedded) | all-MiniLM-L6-v2 | 384 | **Yes** (Transformers.js) |
| **Blinko** | pgvector (PostgreSQL) | mxbai-embed-large, nomic-embed-text | Variable | Via Ollama |
| **Khoj** | pgvector (PostgreSQL) | Sentence Transformers + cross-encoder | Variable | **Yes** |
| **Smart Connections** | Local JSON files | bge-micro-v2 | 384 | **Yes** (transformers.js) |
| **tldraw** | None (extensible) | N/A | N/A | N/A |

**Best embedding implementation**: Khoj's bi-encoder + cross-encoder architecture represents current best practice, sacrificing some speed for significantly better retrieval quality. Reor and Smart Connections offer the best pure local experience with Transformers.js running entirely in-browser.

**Most extensible for duplicate detection**: Smart Connections has the lowest barrier—similarity computation already runs for all notes, needing only threshold configuration and pre-capture hook. Reor's LanceDB architecture is similarly straightforward. pgvector-based tools (AFFiNE, Blinko, Khoj) require database query modification but have robust infrastructure.

## Building a minimal tldraw-based solution

Creating a custom tool combining tldraw canvas with semantic deduplication requires integrating several components. The tldraw Agent Starter Kit provides the foundation.

### Core components needed

**1. Custom IdeaCardShape** extending tldraw's shape system:
- Properties: `content` (text), `embedding` (Float32Array), `embeddingModel` (string), `createdAt` (timestamp)
- Custom `ShapeUtil` class handling rendering, default props, and migrations

**2. Embedding pipeline** triggered by store side effects:
- On shape create/update: extract text content, generate embedding via local model (Transformers.js) or API
- Store embedding in shape's `meta` property or external index
- Options: Transformers.js for local (all-MiniLM-L6-v2), OpenAI API for quality

**3. Vector search layer**:
- In-memory: Use `store.createComputedCache()` to maintain similarity index
- Persistent: Sync to LanceDB, Qdrant, or pgvector for larger scale
- Query interface: Find shapes with cosine similarity above threshold

**4. Deduplication UI**:
- Pre-capture check: Before creating new card, query for similar existing content
- Threshold configuration: Allow user to set sensitivity (e.g., 0.85 cosine similarity)
- Modal or sidebar showing similar existing ideas with options to link, merge, or proceed

**5. Quick capture interface**:
- Global hotkey or floating button for rapid idea entry
- Auto-positioning on canvas (smart placement near related ideas)
- Optional: Voice-to-text via Whisper for hands-free capture

### Technical complexity estimate

| Component | Complexity | Effort |
|-----------|------------|--------|
| Custom IdeaCardShape | Low | 1-2 days |
| Embedding pipeline (Transformers.js) | Medium | 2-3 days |
| In-memory similarity search | Medium | 2-3 days |
| Pre-capture deduplication UI | Medium | 3-4 days |
| Local persistence (IndexedDB) | Low | 1 day |
| External vector DB integration | Medium-High | 3-5 days |
| Quick capture UX polish | Medium | 2-3 days |

**Total estimate for MVP**: 2-3 weeks for a developer familiar with React and tldraw. Key decision points include embedding model choice (local vs API trade-off) and persistence strategy (in-memory for small scale vs external DB for thousands of ideas).

### Recommended implementation path

1. Start with **tldraw Agent Starter Kit** (`npm create tldraw@latest` → select "agent")
2. Create custom `IdeaCardShape` with basic text content
3. Add **Transformers.js** embedding generation in store side effect
4. Build similarity search using `store.createComputedCache()` with cosine similarity
5. Add pre-creation similarity check with UI warning modal
6. Polish quick capture flow with keyboard shortcuts and smart positioning

## Conclusion

**No existing tool fully meets all requirements**, but viable paths exist. For immediate use, **AFFiNE** provides the closest match with its Edgeless canvas and pgvector semantic search—accept beta quality for self-hosted AI features. For maximum local-first control, combine **Reor** (semantic search) with manual canvas workflows, or extend **Smart Connections** within Obsidian's ecosystem.

For organizations willing to invest development effort, building on **tldraw** offers the most promising long-term architecture. The SDK's extensibility, React foundation, and existing AI starter kits reduce integration complexity. A minimal viable implementation combining tldraw canvas with Transformers.js embeddings and pre-capture similarity checking is achievable in 2-3 weeks, producing a tool no current open source project offers: visual infinite canvas with intelligent duplicate detection.