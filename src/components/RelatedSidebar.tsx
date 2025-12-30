import { useState, useEffect, useCallback } from 'react'
import type { Editor } from 'tldraw'
import { findSimilar } from '../lib/similarity'
import { useVectorIndex } from '../store/useVectorIndex'
import { CONFIG } from '../lib/constants'
import type { SimilarityResult, IdeaCardMeta } from '../types'
import type { IdeaCardShape } from '../shapes/IdeaCardShape'

interface RelatedSidebarProps {
  editor: Editor | null
  isCollapsed: boolean
  onToggleCollapse: () => void
}

export function RelatedSidebar({ editor, isCollapsed, onToggleCollapse }: RelatedSidebarProps) {
  const [selectedCard, setSelectedCard] = useState<IdeaCardShape | null>(null)
  const [relatedCards, setRelatedCards] = useState<SimilarityResult[]>([])
  const getAllEntries = useVectorIndex((state) => state.getAllEntries)

  // Track selected card changes
  useEffect(() => {
    if (!editor) return

    const updateSelectedCard = () => {
      const selectedIds = editor.getSelectedShapeIds()

      if (selectedIds.length === 1) {
        const shape = editor.getShape(selectedIds[0])
        if (shape && shape.type === 'idea-card') {
          setSelectedCard(shape as IdeaCardShape)
          return
        }
      }

      setSelectedCard(null)
      setRelatedCards([])
    }

    // Initial check
    updateSelectedCard()

    // Subscribe to selection changes
    const unsubscribe = editor.store.listen(
      () => {
        updateSelectedCard()
      },
      { scope: 'session' }
    )

    return () => {
      unsubscribe()
    }
  }, [editor])

  // Update related cards when selection changes
  useEffect(() => {
    if (!selectedCard) {
      setRelatedCards([])
      return
    }

    const meta = selectedCard.meta as Partial<IdeaCardMeta> | undefined
    const embedding = meta?.embedding

    if (!embedding || embedding.length === 0) {
      setRelatedCards([])
      return
    }

    // Find related cards
    const entries = getAllEntries()
    const embeddingArray = new Float32Array(embedding)
    const similar = findSimilar(
      embeddingArray,
      entries,
      CONFIG.RELATED_TOP_K,
      String(selectedCard.id)
    )

    // Filter by threshold
    const aboveThreshold = similar.filter((r) => r.score >= CONFIG.RELATED_THRESHOLD)
    setRelatedCards(aboveThreshold)
  }, [selectedCard, getAllEntries])

  // Subscribe to store changes to update when cards change
  useEffect(() => {
    if (!editor || !selectedCard) return

    const unsubscribe = editor.store.listen(
      (entry) => {
        // Check if our selected card was updated
        for (const [, to] of Object.values(entry.changes.updated)) {
          if (to.typeName === 'shape' && to.id === selectedCard.id) {
            setSelectedCard(to as IdeaCardShape)
          }
        }
      },
      { scope: 'document' }
    )

    return () => {
      unsubscribe()
    }
  }, [editor, selectedCard])

  const handleCardClick = useCallback((id: string) => {
    if (!editor) return

    const shape = editor.getShape(id as any)
    if (!shape) return

    editor.select(id as any)
    editor.zoomToSelection({ animation: { duration: 300 } })
  }, [editor])

  // Don't render if collapsed and no card selected
  if (isCollapsed && !selectedCard) return null

  // Collapsed state - just show toggle button
  if (isCollapsed) {
    return (
      <div
        style={{
          width: 40,
          height: '100%',
          backgroundColor: '#fafafa',
          borderLeft: '1px solid #e5e5e5',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          paddingTop: 16,
          zIndex: 100,
        }}
      >
        <button
          onClick={onToggleCollapse}
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            border: '1px solid #ddd',
            backgroundColor: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            color: '#666',
          }}
          title="Show Related Cards"
        >
          ◀
        </button>
      </div>
    )
  }

  // No card selected
  if (!selectedCard) {
    return (
      <div
        style={{
          width: 280,
          height: '100%',
          backgroundColor: '#fafafa',
          borderLeft: '1px solid #e5e5e5',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 100,
        }}
      >
        <div
          style={{
            padding: '16px',
            borderBottom: '1px solid #e5e5e5',
            backgroundColor: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#333' }}>
            Related Cards
          </h3>
          <button
            onClick={onToggleCollapse}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              color: '#666',
              fontSize: 14,
            }}
            title="Collapse sidebar"
          >
            ▶
          </button>
        </div>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            textAlign: 'center',
            color: '#999',
            fontSize: 13,
          }}
        >
          Select a card to see related ideas
        </div>
      </div>
    )
  }

  const meta = selectedCard.meta as Partial<IdeaCardMeta> | undefined
  const hasEmbedding = meta?.embedding && meta.embedding.length > 0

  return (
    <div
      style={{
        width: 280,
        height: '100%',
        backgroundColor: '#fafafa',
        borderLeft: '1px solid #e5e5e5',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 100,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid #e5e5e5',
          backgroundColor: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#333' }}>
          Related Cards
        </h3>
        <button
          onClick={onToggleCollapse}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            color: '#666',
            fontSize: 14,
          }}
          title="Collapse sidebar"
        >
          ▶
        </button>
      </div>

      {/* Selected card info */}
      <div
        style={{
          padding: '12px 16px',
          backgroundColor: CONFIG.DEFAULT_CARD_COLOR,
          borderBottom: '1px solid #e5e5e5',
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: '#666',
            marginBottom: 4,
          }}
        >
          Selected:
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: '#333',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {selectedCard.props.title || 'Untitled'}
        </div>
      </div>

      {/* Related cards list */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px',
        }}
      >
        {!hasEmbedding && (
          <div
            style={{
              padding: 16,
              textAlign: 'center',
              color: '#999',
              fontSize: 13,
            }}
          >
            Card embedding not ready
          </div>
        )}

        {hasEmbedding && relatedCards.length === 0 && (
          <div
            style={{
              padding: 16,
              textAlign: 'center',
              color: '#999',
              fontSize: 13,
            }}
          >
            No related cards found
          </div>
        )}

        {relatedCards.map((card) => (
          <button
            key={card.id}
            onClick={() => handleCardClick(card.id)}
            style={{
              width: '100%',
              padding: '12px',
              marginBottom: 8,
              backgroundColor: 'white',
              border: '1px solid #e5e5e5',
              borderRadius: 8,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f5f5f5'
              e.currentTarget.style.borderColor = '#ccc'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'white'
              e.currentTarget.style.borderColor = '#e5e5e5'
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: '#333',
                marginBottom: 4,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {card.text.split('\n')[0] || 'Untitled'}
            </div>
            <div
              style={{
                fontSize: 12,
                color: '#666',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginBottom: 6,
              }}
            >
              {card.text.split('\n').slice(1).join(' ').slice(0, 80) || 'No content'}
            </div>
            <div
              style={{
                fontSize: 11,
                color: getSimilarityColor(card.score),
                fontWeight: 500,
              }}
            >
              {Math.round(card.score * 100)}% similar
            </div>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '8px 16px',
          borderTop: '1px solid #e5e5e5',
          backgroundColor: 'white',
          fontSize: 11,
          color: '#999',
          textAlign: 'center',
        }}
      >
        Top {CONFIG.RELATED_TOP_K} cards above {CONFIG.RELATED_THRESHOLD * 100}% similarity
      </div>
    </div>
  )
}

function getSimilarityColor(score: number): string {
  if (score >= CONFIG.DUPLICATE_THRESHOLD) return '#dc2626' // Red
  if (score >= CONFIG.SIMILAR_THRESHOLD) return '#f59e0b' // Orange
  if (score >= CONFIG.RELATED_THRESHOLD) return '#10b981' // Green
  return '#6b7280' // Gray
}
