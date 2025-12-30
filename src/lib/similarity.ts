import type { VectorEntry, SimilarityResult } from '../types'

/**
 * Calculate cosine similarity between two vectors.
 * Assumes vectors are already normalized (which MiniLM outputs are).
 * Returns a value between -1 and 1, where 1 means identical.
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`)
  }

  let dotProduct = 0
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
  }

  // Since MiniLM outputs normalized vectors, we can skip magnitude calculation
  // For non-normalized vectors, we would need:
  // const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
  // const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))
  // return dotProduct / (magnitudeA * magnitudeB)

  return dotProduct
}

/**
 * Find the top-k most similar entries to a query vector.
 * Excludes the entry with the given excludeId (typically the query card itself).
 */
export function findSimilar(
  query: Float32Array,
  index: VectorEntry[],
  topK: number,
  excludeId?: string
): SimilarityResult[] {
  console.log('[findSimilar] Called with excludeId:', excludeId)
  console.log('[findSimilar] Index has', index.length, 'entries')

  if (query.length === 0 || index.length === 0) {
    return []
  }

  // Calculate similarity for all entries
  const results: SimilarityResult[] = []

  for (const entry of index) {
    // Skip the query card itself - use String() to ensure consistent comparison
    // (TLShapeId is a branded string type, this ensures we compare raw strings)
    const entryIdStr = String(entry.id)
    const excludeIdStr = excludeId ? String(excludeId) : null
    const isMatch = excludeIdStr !== null && entryIdStr === excludeIdStr
    console.log('[findSimilar] Comparing:', { entryId: entryIdStr, excludeId: excludeIdStr, isMatch })
    if (isMatch) {
      console.log('[findSimilar] SKIPPING self-match')
      continue
    }

    // Skip entries without valid embeddings
    if (!entry.embedding || entry.embedding.length === 0) {
      continue
    }

    const score = cosineSimilarity(query, entry.embedding)
    results.push({
      id: entry.id,
      score,
      text: entry.text,
    })
  }

  // Sort by similarity (descending) and take top-k
  results.sort((a, b) => b.score - a.score)
  return results.slice(0, topK)
}

/**
 * Find entries above a similarity threshold.
 * Useful for duplicate detection.
 */
export function findAboveThreshold(
  query: Float32Array,
  index: VectorEntry[],
  threshold: number,
  excludeId?: string
): SimilarityResult[] {
  if (query.length === 0 || index.length === 0) {
    return []
  }

  const results: SimilarityResult[] = []

  for (const entry of index) {
    // Skip the query card itself
    if (excludeId && entry.id === excludeId) {
      continue
    }

    // Skip entries without valid embeddings
    if (!entry.embedding || entry.embedding.length === 0) {
      continue
    }

    const score = cosineSimilarity(query, entry.embedding)
    if (score >= threshold) {
      results.push({
        id: entry.id,
        score,
        text: entry.text,
      })
    }
  }

  // Sort by similarity (descending)
  results.sort((a, b) => b.score - a.score)
  return results
}
