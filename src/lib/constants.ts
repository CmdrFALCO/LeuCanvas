export const CONFIG = {
  // Embedding
  EMBEDDING_MODEL: 'Xenova/all-MiniLM-L6-v2',
  EMBEDDING_DIMENSIONS: 384,
  EMBEDDING_DEBOUNCE_MS: 500,

  // Similarity thresholds
  DUPLICATE_THRESHOLD: 0.92,    // Red alert
  SIMILAR_THRESHOLD: 0.85,      // Orange warning
  RELATED_THRESHOLD: 0.70,      // Show in sidebar

  // Search
  SEARCH_TOP_K: 10,
  RELATED_TOP_K: 5,

  // Card defaults
  DEFAULT_CARD_WIDTH: 280,
  DEFAULT_CARD_HEIGHT: 180,
  DEFAULT_CARD_COLOR: '#FEF3C7',  // Warm yellow

  // IndexedDB
  DB_NAME: 'semanticanvas',
  DB_VERSION: 1,
  STORE_NAME: 'canvas-state',

  // Persistence
  STORAGE_KEY: 'semanticanvas-snapshot',
  SAVE_DEBOUNCE_MS: 500,
} as const
