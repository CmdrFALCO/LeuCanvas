import { embeddingPipeline } from './embeddings'
import { findSimilar } from './similarity'
import { CONFIG } from './constants'
import type { VectorEntry, SimilarityResult } from '../types'

export interface RetrievedContext {
  cards: SimilarityResult[]
  contextText: string
}

/**
 * Retrieve relevant cards for a user query using semantic search.
 * Returns top-k cards that are above the minimum similarity threshold.
 */
export async function retrieveContext(
  query: string,
  vectorEntries: VectorEntry[],
  topK: number = CONFIG.RAG_TOP_K,
  minSimilarity: number = CONFIG.RAG_MIN_SIMILARITY
): Promise<RetrievedContext> {
  if (!query.trim() || vectorEntries.length === 0) {
    return { cards: [], contextText: '' }
  }

  try {
    // Generate embedding for the query
    const queryEmbedding = await embeddingPipeline.embed(`rag-${Date.now()}`, query)

    if (queryEmbedding.length === 0) {
      return { cards: [], contextText: '' }
    }

    // Find similar cards
    const similar = findSimilar(queryEmbedding, vectorEntries, topK)

    // Filter by minimum similarity
    const relevantCards = similar.filter((card) => card.score >= minSimilarity)

    // Build context text for the LLM
    const contextText = buildContextText(relevantCards)

    return { cards: relevantCards, contextText }
  } catch (error) {
    console.error('RAG retrieval failed:', error)
    return { cards: [], contextText: '' }
  }
}

/**
 * Build a formatted context string from retrieved cards.
 */
function buildContextText(cards: SimilarityResult[]): string {
  if (cards.length === 0) {
    return ''
  }

  const cardTexts = cards.map((card, index) => {
    const [title, ...contentLines] = card.text.split('\n')
    const content = contentLines.join('\n').trim()
    const similarity = Math.round(card.score * 100)

    return `[Card ${index + 1}] (${similarity}% relevant)
Title: ${title || 'Untitled'}
Content: ${content || 'No content'}
---`
  })

  return `Here are the user's relevant idea cards:

${cardTexts.join('\n\n')}`
}

/**
 * Build the messages array for the LLM with RAG context.
 */
export function buildRAGMessages(
  userMessage: string,
  context: RetrievedContext,
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  systemPrompt: string = CONFIG.DEFAULT_SYSTEM_PROMPT
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = []

  // System message with context
  let systemContent = systemPrompt
  if (context.contextText) {
    systemContent += `\n\n${context.contextText}`
  }
  messages.push({ role: 'system', content: systemContent })

  // Add chat history (limit to last 10 exchanges to manage context window)
  const recentHistory = chatHistory.slice(-20) // Last 10 pairs
  for (const msg of recentHistory) {
    messages.push({ role: msg.role, content: msg.content })
  }

  // Add current user message
  messages.push({ role: 'user', content: userMessage })

  return messages
}
