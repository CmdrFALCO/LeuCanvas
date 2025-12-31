import type { Editor, TLShapeId } from 'tldraw'
import { createShapeId } from 'tldraw'
import type { ExportData, ExportedCard } from './export'
import type { IdeaCardWithMeta } from '../types'
import { CONFIG } from './constants'

export type ImportMode = 'replace' | 'merge'

export interface ImportResult {
  success: boolean
  importedCount: number
  skippedCount: number
  error?: string
}

export interface ValidationResult {
  valid: boolean
  cardCount: number
  hasEmbeddings: boolean
  version: string
  exportedAt: string
  errors: string[]
}

/**
 * Validate the structure and content of import data
 */
export function validateImportData(data: unknown): ValidationResult {
  const errors: string[] = []

  // Check basic structure
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      cardCount: 0,
      hasEmbeddings: false,
      version: '',
      exportedAt: '',
      errors: ['Invalid data: not an object'],
    }
  }

  const exportData = data as Partial<ExportData>

  // Check version
  if (!exportData.version) {
    errors.push('Missing version field')
  } else if (exportData.version !== '1.0') {
    errors.push(`Unsupported version: ${exportData.version}`)
  }

  // Check exportedAt
  if (!exportData.exportedAt) {
    errors.push('Missing exportedAt field')
  }

  // Check cards array
  if (!exportData.cards) {
    errors.push('Missing cards array')
  } else if (!Array.isArray(exportData.cards)) {
    errors.push('Cards field is not an array')
  }

  // If basic structure is invalid, return early
  if (errors.length > 0) {
    return {
      valid: false,
      cardCount: 0,
      hasEmbeddings: false,
      version: exportData.version || '',
      exportedAt: exportData.exportedAt || '',
      errors,
    }
  }

  // Validate each card
  const cards = exportData.cards as ExportedCard[]
  let hasEmbeddings = false

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]
    const cardErrors = validateCard(card, i)
    errors.push(...cardErrors)

    if (card.embedding && card.embedding.length > 0) {
      hasEmbeddings = true
    }
  }

  return {
    valid: errors.length === 0,
    cardCount: cards.length,
    hasEmbeddings,
    version: exportData.version || '',
    exportedAt: exportData.exportedAt || '',
    errors,
  }
}

/**
 * Validate a single card's structure
 */
function validateCard(card: Partial<ExportedCard>, index: number): string[] {
  const errors: string[] = []
  const prefix = `Card[${index}]`

  if (typeof card.title !== 'string') {
    errors.push(`${prefix}: missing or invalid title`)
  }
  if (typeof card.content !== 'string') {
    errors.push(`${prefix}: missing or invalid content`)
  }
  if (typeof card.x !== 'number' || isNaN(card.x)) {
    errors.push(`${prefix}: missing or invalid x position`)
  }
  if (typeof card.y !== 'number' || isNaN(card.y)) {
    errors.push(`${prefix}: missing or invalid y position`)
  }
  if (typeof card.width !== 'number' || isNaN(card.width) || card.width <= 0) {
    errors.push(`${prefix}: missing or invalid width`)
  }
  if (typeof card.height !== 'number' || isNaN(card.height) || card.height <= 0) {
    errors.push(`${prefix}: missing or invalid height`)
  }

  // Optional fields validation
  if (card.embedding !== undefined) {
    if (!Array.isArray(card.embedding)) {
      errors.push(`${prefix}: embedding is not an array`)
    } else if (card.embedding.length !== CONFIG.EMBEDDING_DIMENSIONS) {
      errors.push(`${prefix}: embedding has wrong dimensions (${card.embedding.length} vs ${CONFIG.EMBEDDING_DIMENSIONS})`)
    }
  }

  return errors
}

/**
 * Parse JSON file content
 */
export function parseImportFile(jsonString: string): { data: ExportData | null; error?: string } {
  try {
    const data = JSON.parse(jsonString)
    return { data }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON'
    return { data: null, error: `Failed to parse JSON: ${message}` }
  }
}

/**
 * Calculate bounding box of existing cards
 */
function getExistingBounds(editor: Editor): { maxX: number; maxY: number } | null {
  const shapes = editor.getCurrentPageShapes()
  const ideaCards = shapes.filter((shape) => shape.type === 'idea-card')

  if (ideaCards.length === 0) {
    return null
  }

  let maxX = -Infinity
  let maxY = -Infinity

  for (const card of ideaCards) {
    const cardRight = card.x + ((card as IdeaCardWithMeta).props?.w || CONFIG.DEFAULT_CARD_WIDTH)
    const cardBottom = card.y + ((card as IdeaCardWithMeta).props?.h || CONFIG.DEFAULT_CARD_HEIGHT)
    maxX = Math.max(maxX, cardRight)
    maxY = Math.max(maxY, cardBottom)
  }

  return { maxX, maxY }
}

/**
 * Import cards into the editor
 */
export async function importCards(
  editor: Editor,
  data: ExportData,
  mode: ImportMode,
  clearAll?: () => Promise<void>
): Promise<ImportResult> {
  try {
    // In replace mode, clear existing cards first
    if (mode === 'replace' && clearAll) {
      await clearAll()
    }

    // Calculate position offset for merge mode
    let offsetX = 0
    let offsetY = 0

    if (mode === 'merge') {
      const bounds = getExistingBounds(editor)
      if (bounds) {
        // Place new cards to the right of existing ones with some padding
        offsetX = bounds.maxX + 100
        offsetY = 0
      }
    }

    let importedCount = 0
    let skippedCount = 0

    // Import each card
    for (const card of data.cards) {
      try {
        // Generate new ID to avoid conflicts
        const newId = createShapeId() as TLShapeId

        // Create the shape with meta
        editor.createShape({
          id: newId,
          type: 'idea-card',
          x: card.x + offsetX,
          y: card.y + offsetY,
          props: {
            title: card.title,
            content: card.content,
            w: card.width || CONFIG.DEFAULT_CARD_WIDTH,
            h: card.height || CONFIG.DEFAULT_CARD_HEIGHT,
          },
          meta: {
            embedding: card.embedding || null,
            embeddingModel: card.embedding ? CONFIG.EMBEDDING_MODEL : null,
            embeddedAt: card.embedding ? Date.now() : null,
            duplicateOf: null,
            similarityScore: null,
            createdAt: card.createdAt || Date.now(),
            updatedAt: card.updatedAt || Date.now(),
          },
        })

        importedCount++
      } catch (error) {
        console.error('Failed to import card:', card.id, error)
        skippedCount++
      }
    }

    return {
      success: true,
      importedCount,
      skippedCount,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error during import'
    console.error('Import failed:', error)
    return {
      success: false,
      importedCount: 0,
      skippedCount: 0,
      error: message,
    }
  }
}

/**
 * Read a file and return its content as string
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}
