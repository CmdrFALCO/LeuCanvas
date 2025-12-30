import type { IdeaCardShape } from '../shapes/IdeaCardShape'

// Meta information stored on IdeaCard shapes
export interface IdeaCardMeta {
  // Embedding data
  embedding: number[] | null        // 384-dim vector (stored as array for JSON serialization)
  embeddingModel: string | null     // Model identifier (e.g., 'Xenova/all-MiniLM-L6-v2')
  embeddedAt: number | null         // Timestamp when embedding was generated

  // Duplicate detection
  duplicateOf: string | null        // ID of similar card
  similarityScore: number | null    // 0-1 similarity score

  // Timestamps
  createdAt: number                 // Creation timestamp
  updatedAt: number                 // Last update timestamp

  // UI state
  isEmbedding?: boolean             // Currently generating embedding
}

// Helper type for IdeaCard with typed meta
export type IdeaCardWithMeta = IdeaCardShape & {
  meta: IdeaCardMeta
}

// Default meta values
export function createDefaultMeta(): IdeaCardMeta {
  const now = Date.now()
  return {
    embedding: null,
    embeddingModel: null,
    embeddedAt: null,
    duplicateOf: null,
    similarityScore: null,
    createdAt: now,
    updatedAt: now,
  }
}

// Vector entry for similarity search
export interface VectorEntry {
  id: string                        // Card ID reference
  embedding: Float32Array           // 384-dim normalized vector
  text: string                      // Original text (for debug)
}

// Similarity search result
export interface SimilarityResult {
  id: string                        // Matching card ID
  score: number                     // Cosine similarity (0-1)
  text: string                      // Preview text
}
