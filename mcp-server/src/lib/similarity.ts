/**
 * Compute cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Find the top K most similar embeddings to a query embedding
 */
export function findTopK(
  queryEmbedding: number[],
  embeddings: Map<string, number[]>,
  k: number,
  excludeIds: string[] = []
): { id: string; similarity: number }[] {
  const results: { id: string; similarity: number }[] = [];

  for (const [id, embedding] of embeddings) {
    if (excludeIds.includes(id)) continue;
    results.push({ id, similarity: cosineSimilarity(queryEmbedding, embedding) });
  }

  return results.sort((a, b) => b.similarity - a.similarity).slice(0, k);
}
