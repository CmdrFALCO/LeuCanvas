import { create } from 'zustand'
import { get as idbGet, set as idbSet } from 'idb-keyval'
import type { VectorEntry } from '../types'

const VECTOR_INDEX_KEY = 'semanticanvas-vector-index'

interface VectorIndexState {
  // Index data
  entries: Map<string, VectorEntry>
  isLoaded: boolean

  // Actions
  addEntry: (entry: VectorEntry) => void
  updateEntry: (entry: VectorEntry) => void
  removeEntry: (id: string) => void
  getEntry: (id: string) => VectorEntry | undefined
  getAllEntries: () => VectorEntry[]
  clear: () => void

  // Persistence
  load: () => Promise<void>
  save: () => Promise<void>
}

// Serializable format for IndexedDB
interface SerializedVectorIndex {
  entries: Array<{
    id: string
    embedding: number[]
    text: string
  }>
}

export const useVectorIndex = create<VectorIndexState>((set, get) => ({
  entries: new Map(),
  isLoaded: false,

  addEntry: (entry: VectorEntry) => {
    set((state) => {
      const newEntries = new Map(state.entries)
      newEntries.set(entry.id, entry)
      return { entries: newEntries }
    })
    // Auto-save after modification
    get().save()
  },

  updateEntry: (entry: VectorEntry) => {
    set((state) => {
      const newEntries = new Map(state.entries)
      newEntries.set(entry.id, entry)
      return { entries: newEntries }
    })
    // Auto-save after modification
    get().save()
  },

  removeEntry: (id: string) => {
    set((state) => {
      const newEntries = new Map(state.entries)
      newEntries.delete(id)
      return { entries: newEntries }
    })
    // Auto-save after modification
    get().save()
  },

  getEntry: (id: string) => {
    return get().entries.get(id)
  },

  getAllEntries: () => {
    return Array.from(get().entries.values())
  },

  clear: () => {
    set({ entries: new Map() })
    get().save()
  },

  load: async () => {
    try {
      const data = await idbGet<SerializedVectorIndex>(VECTOR_INDEX_KEY)
      if (data && data.entries) {
        const entries = new Map<string, VectorEntry>()
        for (const entry of data.entries) {
          entries.set(entry.id, {
            id: entry.id,
            embedding: new Float32Array(entry.embedding),
            text: entry.text,
          })
        }
        set({ entries, isLoaded: true })
      } else {
        set({ isLoaded: true })
      }
    } catch (error) {
      console.error('Failed to load vector index:', error)
      set({ isLoaded: true })
    }
  },

  save: async () => {
    try {
      const { entries } = get()
      const serialized: SerializedVectorIndex = {
        entries: Array.from(entries.values()).map((entry) => ({
          id: entry.id,
          embedding: Array.from(entry.embedding),
          text: entry.text,
        })),
      }
      await idbSet(VECTOR_INDEX_KEY, serialized)
    } catch (error) {
      console.error('Failed to save vector index:', error)
    }
  },
}))

// Hook to sync vector index with tldraw store
import { useEffect } from 'react'
import type { Editor } from 'tldraw'
import type { IdeaCardShape } from '../shapes/IdeaCardShape'
import type { IdeaCardMeta } from '../types'

export function useVectorIndexSync(editor: Editor | null) {
  const { addEntry, updateEntry, removeEntry, load, isLoaded } = useVectorIndex()

  // Load index on mount
  useEffect(() => {
    if (!isLoaded) {
      load()
    }
  }, [isLoaded, load])

  // Sync with tldraw store
  useEffect(() => {
    if (!editor || !isLoaded) return

    // Initial sync: add all existing cards with embeddings
    const shapes = editor.getCurrentPageShapes()
    for (const shape of shapes) {
      if (shape.type === 'idea-card') {
        const ideaCard = shape as IdeaCardShape
        const meta = ideaCard.meta as Partial<IdeaCardMeta> | undefined
        if (meta?.embedding && meta.embedding.length > 0) {
          const text = `${ideaCard.props.title}\n${ideaCard.props.content}`.trim()
          updateEntry({
            id: ideaCard.id,
            embedding: new Float32Array(meta.embedding),
            text,
          })
        }
      }
    }

    // Subscribe to store changes
    const unsubscribe = editor.store.listen(
      (entry) => {
        // Handle added shapes
        for (const record of Object.values(entry.changes.added)) {
          if (record.typeName === 'shape' && (record as IdeaCardShape).type === 'idea-card') {
            const shape = record as IdeaCardShape
            const meta = shape.meta as Partial<IdeaCardMeta> | undefined
            if (meta?.embedding && meta.embedding.length > 0) {
              const text = `${shape.props.title}\n${shape.props.content}`.trim()
              addEntry({
                id: shape.id,
                embedding: new Float32Array(meta.embedding),
                text,
              })
            }
          }
        }

        // Handle updated shapes
        for (const [, to] of Object.values(entry.changes.updated)) {
          if (to.typeName === 'shape' && (to as IdeaCardShape).type === 'idea-card') {
            const shape = to as IdeaCardShape
            const meta = shape.meta as Partial<IdeaCardMeta> | undefined
            if (meta?.embedding && meta.embedding.length > 0) {
              const text = `${shape.props.title}\n${shape.props.content}`.trim()
              updateEntry({
                id: shape.id,
                embedding: new Float32Array(meta.embedding),
                text,
              })
            }
          }
        }

        // Handle removed shapes
        for (const record of Object.values(entry.changes.removed)) {
          if (record.typeName === 'shape' && (record as IdeaCardShape).type === 'idea-card') {
            removeEntry(record.id)
          }
        }
      },
      { scope: 'document' }
    )

    return () => {
      unsubscribe()
    }
  }, [editor, isLoaded, addEntry, updateEntry, removeEntry])
}
