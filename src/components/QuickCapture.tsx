import { useState, useCallback, useRef, useEffect } from 'react'
import type { Editor } from 'tldraw'
import { createShapeId } from 'tldraw'
import { embeddingPipeline } from '../lib/embeddings'
import { findSimilar } from '../lib/similarity'
import { useVectorIndex } from '../store/useVectorIndex'
import { CONFIG } from '../lib/constants'
import { createDefaultMeta } from '../types'
import type { SimilarityResult } from '../types'

interface QuickCaptureProps {
  editor: Editor | null
  isOpen: boolean
  onClose: () => void
}

export function QuickCapture({ editor, isOpen, onClose }: QuickCaptureProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [similarCards, setSimilarCards] = useState<SimilarityResult[]>([])
  const [isChecking, setIsChecking] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const getAllEntries = useVectorIndex((state) => state.getAllEntries)

  // Focus title input when modal opens
  useEffect(() => {
    if (isOpen && titleInputRef.current) {
      titleInputRef.current.focus()
    }
  }, [isOpen])

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTitle('')
      setContent('')
      setSimilarCards([])
      setIsChecking(false)
    }
  }, [isOpen])

  // Check for duplicates when content changes
  const checkDuplicates = useCallback(async (text: string) => {
    if (!text.trim()) {
      setSimilarCards([])
      return
    }

    setIsChecking(true)
    try {
      const queryVector = await embeddingPipeline.embed(`quickcapture-${Date.now()}`, text)

      if (queryVector.length === 0) {
        setSimilarCards([])
        return
      }

      const entries = getAllEntries()
      const similar = findSimilar(queryVector, entries, 3)
      // Only show cards above similar threshold
      const aboveThreshold = similar.filter((r) => r.score >= CONFIG.SIMILAR_THRESHOLD)
      setSimilarCards(aboveThreshold)
    } catch (error) {
      console.error('Duplicate check failed:', error)
      setSimilarCards([])
    } finally {
      setIsChecking(false)
    }
  }, [getAllEntries])

  // Debounced duplicate check
  const handleContentChange = useCallback((newTitle: string, newContent: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    const combinedText = `${newTitle}\n${newContent}`.trim()

    debounceRef.current = setTimeout(() => {
      checkDuplicates(combinedText)
    }, 500)
  }, [checkDuplicates])

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value
    setTitle(newTitle)
    handleContentChange(newTitle, content)
  }, [content, handleContentChange])

  const handleContentInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value
    setContent(newContent)
    handleContentChange(title, newContent)
  }, [title, handleContentChange])

  const handleSubmit = useCallback(() => {
    if (!editor || !title.trim()) return

    // Get viewport center
    const viewportCenter = editor.getViewportScreenCenter()
    const pagePoint = editor.screenToPage(viewportCenter)

    // Create shape at center
    const shapeId = createShapeId()
    editor.createShape({
      id: shapeId,
      type: 'idea-card',
      x: pagePoint.x - CONFIG.DEFAULT_CARD_WIDTH / 2,
      y: pagePoint.y - CONFIG.DEFAULT_CARD_HEIGHT / 2,
      props: {
        title: title.trim(),
        content: content.trim(),
        w: CONFIG.DEFAULT_CARD_WIDTH,
        h: CONFIG.DEFAULT_CARD_HEIGHT,
      },
      meta: { ...createDefaultMeta() },
    })

    // Select the new card
    editor.select(shapeId)

    // Close modal
    onClose()
  }, [editor, title, content, onClose])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }, [onClose, handleSubmit])

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }, [onClose])

  // Navigate to similar card
  const handleSimilarCardClick = useCallback((id: string) => {
    if (!editor) return

    const shape = editor.getShape(id as any)
    if (!shape) return

    editor.select(id as any)
    editor.zoomToSelection({ animation: { duration: 300 } })
    onClose()
  }, [editor, onClose])

  if (!isOpen) return null

  const hasSimilarCards = similarCards.length > 0
  const hasDuplicates = similarCards.some((c) => c.score >= CONFIG.DUPLICATE_THRESHOLD)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 2000,
      }}
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        style={{
          backgroundColor: 'white',
          borderRadius: 12,
          padding: 24,
          width: 480,
          maxWidth: '90vw',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#333' }}>
            Quick Capture
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              color: '#666',
              fontSize: 20,
              lineHeight: 1,
            }}
            title="Close (Esc)"
          >
            ×
          </button>
        </div>

        {/* Title input */}
        <div style={{ marginBottom: 16 }}>
          <label
            htmlFor="quick-capture-title"
            style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500, color: '#555' }}
          >
            Title
          </label>
          <input
            ref={titleInputRef}
            id="quick-capture-title"
            type="text"
            value={title}
            onChange={handleTitleChange}
            placeholder="Enter a title..."
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #ddd',
              borderRadius: 8,
              fontSize: 14,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Content textarea */}
        <div style={{ marginBottom: 16 }}>
          <label
            htmlFor="quick-capture-content"
            style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500, color: '#555' }}
          >
            Content
          </label>
          <textarea
            id="quick-capture-content"
            value={content}
            onChange={handleContentInputChange}
            placeholder="Enter your idea..."
            rows={4}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #ddd',
              borderRadius: 8,
              fontSize: 14,
              outline: 'none',
              boxSizing: 'border-box',
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Similar cards warning */}
        {isChecking && (
          <div
            style={{
              padding: '10px 12px',
              backgroundColor: '#f5f5f5',
              borderRadius: 8,
              marginBottom: 16,
              fontSize: 13,
              color: '#666',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div
              style={{
                width: 14,
                height: 14,
                border: '2px solid #ddd',
                borderTopColor: '#666',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            Checking for similar cards...
          </div>
        )}

        {!isChecking && hasSimilarCards && (
          <div
            style={{
              padding: 12,
              backgroundColor: hasDuplicates ? '#fef2f2' : '#fffbeb',
              border: `1px solid ${hasDuplicates ? '#fecaca' : '#fde68a'}`,
              borderRadius: 8,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: hasDuplicates ? '#dc2626' : '#d97706',
                marginBottom: 8,
              }}
            >
              {hasDuplicates ? 'Potential duplicate detected!' : 'Similar cards found:'}
            </div>
            {similarCards.map((card) => (
              <button
                key={card.id}
                onClick={() => handleSimilarCardClick(card.id)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '8px 10px',
                  marginBottom: 4,
                  backgroundColor: 'white',
                  border: '1px solid #e5e5e5',
                  borderRadius: 6,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: 12,
                }}
              >
                <span style={{ fontWeight: 500, color: '#333' }}>
                  {card.text.split('\n')[0] || 'Untitled'}
                </span>
                <span
                  style={{
                    marginLeft: 8,
                    color: card.score >= CONFIG.DUPLICATE_THRESHOLD ? '#dc2626' : '#d97706',
                    fontWeight: 500,
                  }}
                >
                  ({Math.round(card.score * 100)}% match)
                </span>
              </button>
            ))}
            <div style={{ fontSize: 11, color: '#666', marginTop: 8 }}>
              Click a card to view it, or continue to create anyway.
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: '1px solid #ddd',
              backgroundColor: 'white',
              cursor: 'pointer',
              fontSize: 14,
              color: '#666',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim()}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              backgroundColor: title.trim() ? '#3b82f6' : '#e5e5e5',
              color: title.trim() ? 'white' : '#999',
              cursor: title.trim() ? 'pointer' : 'not-allowed',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Create Card
          </button>
        </div>

        {/* Keyboard hint */}
        <div
          style={{
            marginTop: 16,
            paddingTop: 12,
            borderTop: '1px solid #eee',
            fontSize: 11,
            color: '#999',
            textAlign: 'center',
          }}
        >
          Press <kbd style={{ padding: '2px 6px', backgroundColor: '#f5f5f5', borderRadius: 4, border: '1px solid #ddd' }}>Ctrl+Enter</kbd> to create, <kbd style={{ padding: '2px 6px', backgroundColor: '#f5f5f5', borderRadius: 4, border: '1px solid #ddd' }}>Esc</kbd> to cancel
        </div>

        <style>
          {`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}
        </style>
      </div>
    </div>
  )
}
