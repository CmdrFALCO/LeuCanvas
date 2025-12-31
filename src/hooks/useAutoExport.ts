import { useEffect, useRef } from 'react'
import type { Editor } from 'tldraw'
import { isElectron, electronAPI } from '../lib/electron'
import type { IdeaCardShape } from '../shapes/IdeaCardShape'

interface ExportedNote {
  id: string
  title: string
  content: string
  tags: string[]
  color: string
  x: number
  y: number
  width: number
  height: number
  embedding: number[] | null
  createdAt: string
  updatedAt: string
}

const DEBOUNCE_DELAY = 5000 // 5 seconds

export function useAutoExport(editor: Editor | null) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastExportRef = useRef<string>('')

  useEffect(() => {
    if (!editor || !isElectron() || !electronAPI) return

    const exportNotes = () => {
      const shapes = editor.getCurrentPageShapes()
      const ideaCards = shapes.filter(
        (shape): shape is IdeaCardShape => shape.type === 'idea-card'
      )

      const notes: ExportedNote[] = ideaCards.map((card) => {
        const meta = card.meta as {
          embedding?: number[]
          createdAt?: string
          updatedAt?: string
        } | undefined

        return {
          id: card.id,
          title: card.props.title || '',
          content: card.props.content || '',
          tags: [], // Tags not yet implemented in IdeaCard
          color: '#fffef0', // Default color (IdeaCard doesn't have color prop yet)
          x: card.x,
          y: card.y,
          width: card.props.w,
          height: card.props.h,
          embedding: meta?.embedding || null,
          createdAt: meta?.createdAt || new Date().toISOString(),
          updatedAt: meta?.updatedAt || new Date().toISOString()
        }
      })

      // Check if anything changed to avoid unnecessary exports
      const exportHash = JSON.stringify(notes.map(n => ({ id: n.id, title: n.title, content: n.content })))
      if (exportHash === lastExportRef.current) {
        return
      }
      lastExportRef.current = exportHash

      electronAPI!.exportNotes(notes).then((result) => {
        if (result.success) {
          console.log(`[AutoExport] Exported ${notes.length} notes to MCP`)
        } else {
          console.error('[AutoExport] Export failed:', result.error)
        }
      })
    }

    const scheduleExport = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(exportNotes, DEBOUNCE_DELAY)
    }

    // Listen for store changes
    const unsubscribe = editor.store.listen(
      () => {
        scheduleExport()
      },
      { source: 'user', scope: 'document' }
    )

    // Initial export on mount
    scheduleExport()

    return () => {
      unsubscribe()
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [editor])
}
