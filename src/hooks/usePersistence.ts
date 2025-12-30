import { useEffect, useState, useCallback } from 'react'
import { get, set, del } from 'idb-keyval'
import type { Editor, TLStoreSnapshot } from 'tldraw'

const STORAGE_KEY = 'semanticanvas-snapshot'
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
          } else {
            console.warn('Corrupted snapshot detected, starting fresh')
            await del(STORAGE_KEY)
          }
        }
      } catch (error) {
        console.error('Failed to load canvas state:', error)
        // Clear corrupted data
        try {
          await del(STORAGE_KEY)
        } catch {
          // Ignore deletion errors
        }
      } finally {
        setIsLoading(false)
      }
    }

    loadSavedSnapshot()
  }, [editor])

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

  return { isLoading, saveNow }
}
