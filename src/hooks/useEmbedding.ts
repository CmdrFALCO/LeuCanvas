import { useEffect, useRef } from 'react'
import type { Editor } from 'tldraw'
import { embeddingPipeline } from '../lib/embeddings'
import { CONFIG } from '../lib/constants'
import type { IdeaCardMeta } from '../types'
import type { IdeaCardShape } from '../shapes'

// Track content hash to avoid re-embedding unchanged content
function hashContent(title: string, content: string): string {
  return `${title}::${content}`
}

export function useEmbedding(editor: Editor | null) {
  // Track debounce timers per card
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  // Track last embedded content hash per card
  const lastEmbeddedHash = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    if (!editor) return

    // Subscribe to store changes
    const unsubscribe = editor.store.listen(
      (entry) => {
        // Only process user-initiated changes
        if (entry.source !== 'user') return

        // Check for IdeaCard changes
        for (const record of Object.values(entry.changes.added)) {
          if (record.typeName === 'shape' && (record as IdeaCardShape).type === 'idea-card') {
            const shape = record as IdeaCardShape
            scheduleEmbedding(shape)
          }
        }

        for (const [, to] of Object.values(entry.changes.updated)) {
          if (to.typeName === 'shape' && (to as IdeaCardShape).type === 'idea-card') {
            const shape = to as IdeaCardShape
            scheduleEmbedding(shape)
          }
        }
      },
      { scope: 'document', source: 'user' }
    )

    function scheduleEmbedding(shape: IdeaCardShape) {
      const { id, props } = shape
      const contentHash = hashContent(props.title, props.content)

      // Skip if content hasn't changed
      if (lastEmbeddedHash.current.get(id) === contentHash) {
        return
      }

      // Clear existing timer
      const existingTimer = debounceTimers.current.get(id)
      if (existingTimer) {
        clearTimeout(existingTimer)
      }

      // Set new timer
      const timer = setTimeout(() => {
        debounceTimers.current.delete(id)
        generateEmbedding(shape, contentHash)
      }, CONFIG.EMBEDDING_DEBOUNCE_MS)

      debounceTimers.current.set(id, timer)
    }

    async function generateEmbedding(shape: IdeaCardShape, contentHash: string) {
      if (!editor) return

      const { id, props } = shape
      const text = `${props.title}\n${props.content}`.trim()

      // Skip empty content
      if (!text) {
        return
      }

      try {
        // Mark as embedding in progress
        const currentMeta = (editor.getShape(id)?.meta ?? {}) as Partial<IdeaCardMeta>
        editor.updateShape({
          id,
          type: 'idea-card',
          meta: {
            ...currentMeta,
            isEmbedding: true,
          },
        })

        // Generate embedding
        const vector = await embeddingPipeline.embed(id, text)

        // Update shape with embedding
        const updatedMeta = (editor.getShape(id)?.meta ?? {}) as Partial<IdeaCardMeta>
        editor.updateShape({
          id,
          type: 'idea-card',
          meta: {
            ...updatedMeta,
            embedding: Array.from(vector),
            embeddingModel: CONFIG.EMBEDDING_MODEL,
            embeddedAt: Date.now(),
            updatedAt: Date.now(),
            isEmbedding: false,
          },
        })

        // Track embedded content
        lastEmbeddedHash.current.set(id, contentHash)
      } catch (error) {
        console.error(`Failed to generate embedding for card ${id}:`, error)

        // Clear embedding state on error
        const errorMeta = (editor.getShape(id)?.meta ?? {}) as Partial<IdeaCardMeta>
        editor.updateShape({
          id,
          type: 'idea-card',
          meta: {
            ...errorMeta,
            isEmbedding: false,
          },
        })
      }
    }

    return () => {
      unsubscribe()
      // Clear all timers
      debounceTimers.current.forEach((timer) => clearTimeout(timer))
      debounceTimers.current.clear()
    }
  }, [editor])
}
