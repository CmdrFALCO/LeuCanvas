import { useState, useCallback } from 'react'
import { useEditor } from 'tldraw'
import type { TLShapeId } from 'tldraw'
import { CONFIG } from '../lib/constants'
import type { IdeaCardShape } from '../shapes/IdeaCardShape'

interface DuplicateWarningProps {
  duplicateOfId: string
  similarityScore: number
  onDismiss: () => void
}

export function DuplicateWarning({
  duplicateOfId,
  similarityScore,
  onDismiss,
}: DuplicateWarningProps) {
  const editor = useEditor()
  const [isHovered, setIsHovered] = useState(false)

  const isDuplicate = similarityScore >= CONFIG.DUPLICATE_THRESHOLD
  const similarCard = editor.getShape(duplicateOfId as TLShapeId) as IdeaCardShape | undefined

  const handleNavigate = useCallback(() => {
    if (!similarCard) return

    // Select the similar card and zoom to it
    editor.select(similarCard.id)
    editor.zoomToSelection({ animation: { duration: 300 } })
  }, [editor, similarCard])

  const handleDismiss = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onDismiss()
    },
    [onDismiss]
  )

  if (!similarCard) return null

  const title = similarCard.props.title || 'Untitled'
  const preview =
    similarCard.props.content.length > 60
      ? similarCard.props.content.substring(0, 60) + '...'
      : similarCard.props.content || 'No content'

  const scorePercent = Math.round(similarityScore * 100)

  return (
    <div
      style={{
        position: 'absolute',
        bottom: -8,
        left: '50%',
        transform: 'translateX(-50%) translateY(100%)',
        zIndex: 1000,
        pointerEvents: 'auto',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Tooltip trigger - small badge */}
      <div
        style={{
          padding: '4px 8px',
          backgroundColor: isDuplicate ? '#ef4444' : '#f97316',
          color: 'white',
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 500,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        }}
        onClick={handleNavigate}
      >
        {isDuplicate ? 'Duplicate' : 'Similar'} ({scorePercent}%)
      </div>

      {/* Expanded tooltip on hover */}
      {isHovered && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginTop: 4,
            padding: 12,
            backgroundColor: 'white',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            border: `2px solid ${isDuplicate ? '#ef4444' : '#f97316'}`,
            width: 220,
            zIndex: 1001,
          }}
        >
          {/* Header */}
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: isDuplicate ? '#ef4444' : '#f97316',
              marginBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {isDuplicate ? 'Potential Duplicate' : 'Similar Card Found'}
          </div>

          {/* Similar card info */}
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#333',
              marginBottom: 4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 12,
              color: '#666',
              marginBottom: 12,
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {preview}
          </div>

          {/* Similarity score */}
          <div
            style={{
              fontSize: 11,
              color: '#888',
              marginBottom: 12,
            }}
          >
            {scorePercent}% similar
          </div>

          {/* Actions */}
          <div
            style={{
              display: 'flex',
              gap: 8,
            }}
          >
            <button
              onClick={handleNavigate}
              style={{
                flex: 1,
                padding: '6px 10px',
                backgroundColor: isDuplicate ? '#ef4444' : '#f97316',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Go to card
            </button>
            <button
              onClick={handleDismiss}
              style={{
                flex: 1,
                padding: '6px 10px',
                backgroundColor: '#f3f4f6',
                color: '#666',
                border: 'none',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Get border style based on similarity score
 */
export function getDuplicateBorderStyle(similarityScore: number | null | undefined): React.CSSProperties {
  if (!similarityScore) {
    return {}
  }

  if (similarityScore >= CONFIG.DUPLICATE_THRESHOLD) {
    return {
      border: '2px solid #ef4444',
      boxShadow: '0 0 8px rgba(239, 68, 68, 0.4)',
    }
  }

  if (similarityScore >= CONFIG.SIMILAR_THRESHOLD) {
    return {
      border: '2px solid #f97316',
      boxShadow: '0 0 8px rgba(249, 115, 22, 0.3)',
    }
  }

  return {}
}
