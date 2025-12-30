import { useEffect, useRef } from 'react'
import type { Editor, TLShapeId } from 'tldraw'
import { useVectorIndex } from '../store'
import { findSimilar } from '../lib/similarity'
import { CONFIG } from '../lib/constants'
import type { IdeaCardShape } from '../shapes/IdeaCardShape'
import type { IdeaCardMeta } from '../types'

/**
 * Hook that checks for duplicates after embeddings are generated.
 * Updates card.meta with duplicateOf and similarityScore when similar cards are found.
 */
export function useDuplicateCheck(editor: Editor | null) {
  const { getAllEntries, isLoaded } = useVectorIndex()
  // Track which cards we've already checked to avoid redundant checks
  const checkedEmbeddings = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    if (!editor || !isLoaded) return

    // Subscribe to store changes to detect when embeddings are added
    const unsubscribe = editor.store.listen(
      (entry) => {
        // Check updated shapes for new embeddings
        for (const [from, to] of Object.values(entry.changes.updated)) {
          if (to.typeName === 'shape' && (to as IdeaCardShape).type === 'idea-card') {
            const shape = to as IdeaCardShape
            const meta = shape.meta as Partial<IdeaCardMeta> | undefined
            const fromMeta = (from as IdeaCardShape).meta as Partial<IdeaCardMeta> | undefined

            // Check if embedding was just added or updated
            const hasNewEmbedding =
              meta?.embedding &&
              meta.embedding.length > 0 &&
              meta.embeddedAt &&
              (!fromMeta?.embeddedAt || meta.embeddedAt !== fromMeta.embeddedAt)

            if (hasNewEmbedding) {
              // Check if we've already processed this embedding
              const lastChecked = checkedEmbeddings.current.get(shape.id)
              if (lastChecked === meta.embeddedAt) {
                continue
              }

              // Mark as checked
              checkedEmbeddings.current.set(shape.id, meta.embeddedAt!)

              // Perform duplicate check
              checkForDuplicates(shape, meta.embedding!)
            }
          }
        }
      },
      { scope: 'document' }
    )

    function checkForDuplicates(shape: IdeaCardShape, embedding: number[]) {
      const queryVector = new Float32Array(embedding)
      const allEntries = getAllEntries()

      // Find similar cards (top 1 is enough for duplicate detection)
      const similar = findSimilar(queryVector, allEntries, 1, shape.id)

      if (similar.length === 0) {
        // No similar cards found, clear any existing duplicate info
        clearDuplicateInfo(shape)
        return
      }

      const topMatch = similar[0]

      if (topMatch.score >= CONFIG.DUPLICATE_THRESHOLD) {
        // High similarity - mark as duplicate
        updateDuplicateInfo(shape, topMatch.id, topMatch.score)
      } else if (topMatch.score >= CONFIG.SIMILAR_THRESHOLD) {
        // Moderate similarity - mark as similar
        updateDuplicateInfo(shape, topMatch.id, topMatch.score)
      } else {
        // Below threshold - clear duplicate info
        clearDuplicateInfo(shape)
      }
    }

    function updateDuplicateInfo(shape: IdeaCardShape, duplicateOfId: string, score: number) {
      if (!editor) return

      const currentMeta = (editor.getShape(shape.id)?.meta ?? {}) as Partial<IdeaCardMeta>

      // Only update if values changed
      if (currentMeta.duplicateOf === duplicateOfId && currentMeta.similarityScore === score) {
        return
      }

      editor.updateShape({
        id: shape.id,
        type: 'idea-card',
        meta: {
          ...currentMeta,
          duplicateOf: duplicateOfId,
          similarityScore: score,
        },
      })
    }

    function clearDuplicateInfo(shape: IdeaCardShape) {
      if (!editor) return

      const currentMeta = (editor.getShape(shape.id)?.meta ?? {}) as Partial<IdeaCardMeta>

      // Only update if there was duplicate info to clear
      if (currentMeta.duplicateOf === null && currentMeta.similarityScore === null) {
        return
      }

      editor.updateShape({
        id: shape.id,
        type: 'idea-card',
        meta: {
          ...currentMeta,
          duplicateOf: null,
          similarityScore: null,
        },
      })
    }

    return () => {
      unsubscribe()
    }
  }, [editor, isLoaded, getAllEntries])
}

/**
 * Hook to dismiss duplicate warning for a specific card.
 */
export function useDismissDuplicate(editor: Editor | null) {
  return (cardId: TLShapeId) => {
    if (!editor) return

    const shape = editor.getShape(cardId)
    if (!shape || shape.type !== 'idea-card') return

    const currentMeta = (shape.meta ?? {}) as Partial<IdeaCardMeta>

    editor.updateShape({
      id: cardId,
      type: 'idea-card',
      meta: {
        ...currentMeta,
        duplicateOf: null,
        similarityScore: null,
      },
    })
  }
}
