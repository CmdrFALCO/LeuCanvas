import type { Editor } from 'tldraw'
import type { IdeaCardShape } from '../shapes/IdeaCardShape'
import type { IdeaCardMeta } from '../types'

// Export data structure
export interface ExportedCard {
  id: string
  title: string
  content: string
  x: number
  y: number
  width: number
  height: number
  color: string
  tags: string[]
  createdAt: number
  updatedAt: number
  embedding?: number[]
}

export interface ExportData {
  version: string
  exportedAt: string
  cardCount: number
  cards: ExportedCard[]
}

const EXPORT_VERSION = '1.0'

/**
 * Export all IdeaCards from the canvas to a JSON structure
 */
export function exportCards(editor: Editor, includeEmbeddings: boolean = true): ExportData {
  const shapes = editor.getCurrentPageShapes()
  const ideaCards = shapes.filter((shape) => shape.type === 'idea-card') as IdeaCardShape[]

  const cards: ExportedCard[] = ideaCards.map((card) => {
    const meta = (card.meta as Partial<IdeaCardMeta>) || {}

    const exportedCard: ExportedCard = {
      id: card.id,
      title: card.props.title,
      content: card.props.content,
      x: card.x,
      y: card.y,
      width: card.props.w,
      height: card.props.h,
      color: '#FEF3C7', // Default color (IdeaCards use a fixed color currently)
      tags: [], // Tags not implemented yet, but included for future compatibility
      createdAt: meta.createdAt || Date.now(),
      updatedAt: meta.updatedAt || Date.now(),
    }

    // Include embedding if requested and available
    if (includeEmbeddings && meta.embedding && meta.embedding.length > 0) {
      exportedCard.embedding = Array.isArray(meta.embedding)
        ? meta.embedding
        : Array.from(meta.embedding)
    }

    return exportedCard
  })

  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    cardCount: cards.length,
    cards,
  }
}

/**
 * Generate a filename for the export
 */
export function generateExportFilename(): string {
  const date = new Date()
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `semanticanvas-export-${yyyy}-${mm}-${dd}.json`
}

/**
 * Download the export data as a JSON file
 */
export function downloadExport(data: ExportData, filename?: string): void {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename || generateExportFilename()
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}

/**
 * Export and download all cards from the editor
 */
export function exportAndDownload(
  editor: Editor,
  includeEmbeddings: boolean = true
): { success: boolean; cardCount: number; error?: string } {
  try {
    const data = exportCards(editor, includeEmbeddings)
    downloadExport(data)
    return { success: true, cardCount: data.cardCount }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error during export'
    console.error('Export failed:', error)
    return { success: false, cardCount: 0, error: message }
  }
}
