import { useEffect, useRef, useCallback } from 'react'
import type { Editor } from 'tldraw'
import { createShapeId } from 'tldraw'
import { isElectron, importPendingNotes } from '../lib/electron'

interface PendingNote {
  id: string
  title: string
  content: string
  tags?: string[]
  createdAt: string
}

interface UseImportPendingOptions {
  onSuccess?: (count: number) => void
  onError?: (error: string) => void
}

// Grid layout constants
const CARD_WIDTH = 280
const CARD_HEIGHT = 180
const CARD_GAP = 20
const CARDS_PER_ROW = 4

/**
 * Hook to import pending notes from MCP server on app startup.
 * In Electron, checks ~/.semanticanvas/pending.json for notes created
 * by Claude via MCP, imports them to the canvas, and clears the file.
 */
export function useImportPending(
  editor: Editor | null,
  options: UseImportPendingOptions = {}
) {
  const hasImportedRef = useRef(false)
  const { onSuccess, onError } = options

  // Import function that can be called manually
  const importFromClaude = useCallback(async () => {
    if (!editor || !isElectron()) return { imported: 0 }

    try {
      const notes = await importPendingNotes()

      if (!notes || notes.length === 0) {
        return { imported: 0 }
      }

      // Get viewport center for positioning
      const viewportCenter = editor.getViewportScreenCenter()
      const pageCenter = editor.screenToPage(viewportCenter)

      // Calculate grid starting position (top-left of grid centered on viewport)
      const totalRows = Math.ceil(notes.length / CARDS_PER_ROW)
      const totalCols = Math.min(notes.length, CARDS_PER_ROW)
      const gridWidth = totalCols * CARD_WIDTH + (totalCols - 1) * CARD_GAP
      const gridHeight = totalRows * CARD_HEIGHT + (totalRows - 1) * CARD_GAP
      const startX = pageCenter.x - gridWidth / 2
      const startY = pageCenter.y - gridHeight / 2

      // Create IdeaCard shapes for each note
      const shapes = notes.map((note: PendingNote, index: number) => {
        const row = Math.floor(index / CARDS_PER_ROW)
        const col = index % CARDS_PER_ROW
        const x = startX + col * (CARD_WIDTH + CARD_GAP)
        const y = startY + row * (CARD_HEIGHT + CARD_GAP)

        return {
          id: createShapeId(),
          type: 'idea-card' as const,
          x,
          y,
          props: {
            title: note.title || 'Untitled',
            content: note.content || '',
            w: CARD_WIDTH,
            h: CARD_HEIGHT,
          },
          meta: {
            embedding: null,
            embeddingModel: null,
            embeddedAt: null,
            duplicateOf: null,
            similarityScore: null,
            createdAt: note.createdAt ? new Date(note.createdAt).getTime() : Date.now(),
            updatedAt: Date.now(),
            tags: note.tags || [],
            sourceId: note.id, // Keep reference to MCP note ID
          },
        }
      })

      // Batch create all shapes
      editor.createShapes(shapes)

      // Select the imported shapes
      editor.select(...shapes.map((s) => s.id))

      // Zoom to show all imported shapes
      editor.zoomToSelection()

      onSuccess?.(notes.length)
      return { imported: notes.length }
    } catch (error) {
      console.error('[ImportPending] Error importing notes:', error)
      onError?.(String(error))
      return { imported: 0, error: String(error) }
    }
  }, [editor, onSuccess, onError])

  // Auto-import on startup (only once)
  useEffect(() => {
    if (!editor || !isElectron() || hasImportedRef.current) return

    hasImportedRef.current = true

    // Small delay to ensure editor is fully ready
    const timer = setTimeout(async () => {
      const result = await importFromClaude()
      if (result.imported > 0) {
        console.log(`[ImportPending] Imported ${result.imported} notes from Claude`)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [editor, importFromClaude])

  return { importFromClaude }
}
