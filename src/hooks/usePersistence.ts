import { useEffect, useState, useCallback } from 'react'
import { get, set, del } from 'idb-keyval'
import type { Editor, TLStoreSnapshot } from 'tldraw'
import { useVectorIndex } from '../store'

const STORAGE_KEY = 'semanticanvas-snapshot'
const VECTOR_INDEX_KEY = 'semanticanvas-vector-index'
const DEBOUNCE_MS = 500

// Validate that the snapshot has valid shape data
function isValidSnapshot(snapshot: TLStoreSnapshot): boolean {
  try {
    if (!snapshot || !snapshot.store) return false

    // Check that all shapes have valid props
    for (const [key, value] of Object.entries(snapshot.store)) {
      if (key.startsWith('shape:')) {
        const shape = value as { props?: unknown }
        if (!shape.props) {
          console.warn('Invalid shape found in snapshot:', key)
          return false
        }
      }
    }
    return true
  } catch {
    return false
  }
}

export function usePersistence(editor: Editor | null) {
  const [isLoading, setIsLoading] = useState(true)
  const clearVectorIndex = useVectorIndex((state) => state.clear)

  // Load snapshot from IndexedDB on mount
  useEffect(() => {
    if (!editor) return

    const currentEditor = editor

    async function loadSavedSnapshot() {
      try {
        const snapshot = await get<TLStoreSnapshot>(STORAGE_KEY)
        if (snapshot) {
          // Validate the snapshot before loading
          if (isValidSnapshot(snapshot)) {
            currentEditor.loadSnapshot(snapshot)

            // Sync check: count IdeaCards in snapshot vs vector index
            const ideaCardCount = Object.keys(snapshot.store).filter(
              (key) => key.startsWith('shape:') &&
                (snapshot.store[key] as { type?: string })?.type === 'idea-card'
            ).length

            // If canvas is empty but vector index might have stale entries, clear it
            if (ideaCardCount === 0) {
              console.log('[Persistence] Canvas empty, clearing vector index for sync')
              await del(VECTOR_INDEX_KEY)
              clearVectorIndex()
            }
          } else {
            console.warn('Corrupted snapshot detected, clearing all data')
            await del(STORAGE_KEY)
            await del(VECTOR_INDEX_KEY)
            clearVectorIndex()
          }
        } else {
          // No snapshot exists - ensure vector index is also clear
          console.log('[Persistence] No snapshot, ensuring vector index is clear')
          await del(VECTOR_INDEX_KEY)
          clearVectorIndex()
        }
      } catch (error) {
        console.error('Failed to load canvas state:', error)
        // Clear all corrupted data
        try {
          await del(STORAGE_KEY)
          await del(VECTOR_INDEX_KEY)
          clearVectorIndex()
        } catch {
          // Ignore deletion errors
        }
      } finally {
        setIsLoading(false)
      }
    }

    loadSavedSnapshot()
  }, [editor, clearVectorIndex])

  // Save snapshot to IndexedDB on changes
  useEffect(() => {
    if (!editor || isLoading) return

    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const saveSnapshot = () => {
      if (timeoutId) clearTimeout(timeoutId)

      timeoutId = setTimeout(async () => {
        try {
          const snapshot = editor.getSnapshot()
          await set(STORAGE_KEY, snapshot)
        } catch (error) {
          console.error('Failed to save canvas state:', error)
        }
      }, DEBOUNCE_MS)
    }

    // Subscribe to store changes
    const unsubscribe = editor.store.listen(saveSnapshot, {
      scope: 'document',
      source: 'user',
    })

    return () => {
      unsubscribe()
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [editor, isLoading])

  // Manual save function for external use
  const saveNow = useCallback(async () => {
    if (!editor) return

    try {
      const snapshot = editor.getSnapshot()
      await set(STORAGE_KEY, snapshot)
    } catch (error) {
      console.error('Failed to save canvas state:', error)
    }
  }, [editor])

  // Clear all data (canvas + vector index)
  const clearAll = useCallback(async () => {
    if (!editor) return

    try {
      // Delete all IdeaCard shapes from the canvas
      const shapes = editor.getCurrentPageShapes()
      const ideaCardIds = shapes
        .filter((shape) => shape.type === 'idea-card')
        .map((shape) => shape.id)

      if (ideaCardIds.length > 0) {
        editor.deleteShapes(ideaCardIds)
      }

      // Clear IndexedDB storage
      await del(STORAGE_KEY)
      await del(VECTOR_INDEX_KEY)

      // Clear vector index in memory
      clearVectorIndex()

      // Save the now-empty state
      const snapshot = editor.getSnapshot()
      await set(STORAGE_KEY, snapshot)

      console.log('[Persistence] Cleared all data')
    } catch (error) {
      console.error('Failed to clear data:', error)
    }
  }, [editor, clearVectorIndex])

  return { isLoading, saveNow, clearAll }
}
