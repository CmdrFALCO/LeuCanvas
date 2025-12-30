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

  // LLM / Chat
  RAG_TOP_K: 5,                    // Number of cards to retrieve for context
  RAG_MIN_SIMILARITY: 0.50,       // Minimum similarity for RAG retrieval
  LLM_DEFAULT_MODEL: 'gpt-4o-mini',
  LLM_DEFAULT_MAX_TOKENS: 1024,
  LLM_DEFAULT_TEMPERATURE: 0.7,
  LLM_API_KEY_STORAGE: 'semanticanvas-api-key',
  DEFAULT_SYSTEM_PROMPT: `You are a helpful assistant for SemantiCanvas, a visual knowledge canvas application.
You have access to the user's idea cards which contain their notes and thoughts.
When relevant cards are provided as context, use them to give informed, contextual answers.
Be concise and helpful. If the context doesn't contain relevant information, say so.
Format your responses with markdown when appropriate.`,
} as const
