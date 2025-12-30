import {
  BaseBoxShapeUtil,
  HTMLContainer,
  resizeBox,
  stopEventPropagation,
  useEditor,
} from 'tldraw'
import type { TLResizeInfo } from 'tldraw'
import { ideaCardShapeProps } from './IdeaCardShape'
import type { IdeaCardShape as IdeaCardShapeType } from './IdeaCardShape'
import { useState, useCallback, useRef, useEffect } from 'react'
import type { IdeaCardMeta } from '../types'
import { DuplicateWarning, getDuplicateBorderStyle } from '../components'
import { CONFIG } from '../lib/constants'

// Default dimensions
const DEFAULT_WIDTH = 280
const DEFAULT_HEIGHT = 180

export class IdeaCardUtil extends BaseBoxShapeUtil<IdeaCardShapeType> {
  static override type = 'idea-card' as const
  static override props = ideaCardShapeProps

  getDefaultProps(): IdeaCardShapeType['props'] {
    return {
      title: 'New Idea',
      content: '',
      w: DEFAULT_WIDTH,
      h: DEFAULT_HEIGHT,
    }
  }

  override canEdit() {
    return true
  }

  override canResize() {
    return true
  }

  override onResize(shape: IdeaCardShapeType, info: TLResizeInfo<IdeaCardShapeType>) {
    if (!shape?.props) return shape
    return resizeBox(shape, info)
  }

  override onEditEnd(shape: IdeaCardShapeType) {
    // Defensive check
    if (!shape?.props) return

    // Trim whitespace on edit end
    const title = shape.props.title.trim()
    const content = shape.props.content.trim()

    if (title !== shape.props.title || content !== shape.props.content) {
      this.editor.updateShape<IdeaCardShapeType>({
        id: shape.id,
        type: 'idea-card',
        props: { title, content },
      })
    }
  }

  component(shape: IdeaCardShapeType) {
    // Defensive check - shape should always be defined but guard against edge cases
    if (!shape?.props) {
      return null
    }

    const isEditing = this.editor.getEditingShapeId() === shape.id
    const meta = shape.meta as Partial<IdeaCardMeta> | undefined
    const isEmbedding = meta?.isEmbedding ?? false
    const hasEmbedding = meta?.embedding != null && meta.embedding.length > 0
    const duplicateOf = meta?.duplicateOf ?? null
    const similarityScore = meta?.similarityScore ?? null

    return (
      <IdeaCardComponent
        shape={shape}
        isEditing={isEditing}
        isEmbedding={isEmbedding}
        hasEmbedding={hasEmbedding}
        duplicateOf={duplicateOf}
        similarityScore={similarityScore}
        onUpdateTitle={(title) => {
          this.editor.updateShape<IdeaCardShapeType>({
            id: shape.id,
            type: 'idea-card',
            props: { title },
          })
        }}
        onUpdateContent={(content) => {
          this.editor.updateShape<IdeaCardShapeType>({
            id: shape.id,
            type: 'idea-card',
            props: { content },
          })
        }}
      />
    )
  }

  indicator(shape: IdeaCardShapeType) {
    // Defensive check
    if (!shape?.props) {
      return <rect width={280} height={180} rx={8} ry={8} />
    }

    const meta = shape.meta as Partial<IdeaCardMeta> | undefined
    const similarityScore = meta?.similarityScore

    // Change indicator color based on duplicate status
    let stroke: string | undefined
    if (similarityScore && similarityScore >= CONFIG.DUPLICATE_THRESHOLD) {
      stroke = '#ef4444' // Red for duplicates
    } else if (similarityScore && similarityScore >= CONFIG.SIMILAR_THRESHOLD) {
      stroke = '#f97316' // Orange for similar
    }

    return (
      <rect
        width={shape.props.w}
        height={shape.props.h}
        rx={8}
        ry={8}
        stroke={stroke}
      />
    )
  }
}

// Separate component for the IdeaCard UI
interface IdeaCardComponentProps {
  shape: IdeaCardShapeType
  isEditing: boolean
  isEmbedding: boolean
  hasEmbedding: boolean
  duplicateOf: string | null
  similarityScore: number | null
  onUpdateTitle: (title: string) => void
  onUpdateContent: (content: string) => void
}

function IdeaCardComponent({
  shape,
  isEditing,
  isEmbedding,
  hasEmbedding,
  duplicateOf,
  similarityScore,
  onUpdateTitle,
  onUpdateContent,
}: IdeaCardComponentProps) {
  const editor = useEditor()
  const [title, setTitle] = useState(shape.props.title)
  const [content, setContent] = useState(shape.props.content)
  const titleRef = useRef<HTMLInputElement>(null)
  const contentRef = useRef<HTMLTextAreaElement>(null)

  // Determine if we should show duplicate warning
  const showDuplicateWarning =
    duplicateOf &&
    similarityScore &&
    similarityScore >= CONFIG.SIMILAR_THRESHOLD

  // Sync state with shape props when not editing
  useEffect(() => {
    if (!isEditing) {
      setTitle(shape.props.title)
      setContent(shape.props.content)
    }
  }, [shape.props.title, shape.props.content, isEditing])

  // Focus title input when entering edit mode
  useEffect(() => {
    if (isEditing && titleRef.current) {
      titleRef.current.focus()
      titleRef.current.select()
    }
  }, [isEditing])

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value
    setTitle(newTitle)
    onUpdateTitle(newTitle)
  }, [onUpdateTitle])

  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value
    setContent(newContent)
    onUpdateContent(newContent)
  }, [onUpdateContent])

  const handleDismissDuplicate = useCallback(() => {
    const currentMeta = (shape.meta ?? {}) as Partial<IdeaCardMeta>
    editor.updateShape({
      id: shape.id,
      type: 'idea-card',
      meta: {
        ...currentMeta,
        duplicateOf: null,
        similarityScore: null,
      },
    })
  }, [editor, shape.id, shape.meta])

  // Get border style for duplicate warning
  const duplicateBorderStyle = getDuplicateBorderStyle(similarityScore)

  return (
    <HTMLContainer
      style={{
        width: shape.props.w,
        height: shape.props.h,
        pointerEvents: 'all',
      }}
    >
      <style>
        {`
          @keyframes embedding-pulse {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 1; }
          }
        `}
      </style>
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#fffef0',
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          border: '1px solid #e8e5d0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'visible', // Allow tooltip to overflow
          position: 'relative',
          ...duplicateBorderStyle,
        }}
        onPointerDown={stopEventPropagation}
      >
        {/* Embedding indicator */}
        {isEmbedding && (
          <div
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: '#3b82f6',
              animation: 'embedding-pulse 1s infinite',
              zIndex: 10,
            }}
            title="Generating embedding..."
          />
        )}
        {/* Embedded indicator (subtle checkmark) - hide if there's a duplicate warning */}
        {!isEmbedding && hasEmbedding && !showDuplicateWarning && (
          <div
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: '#22c55e',
              opacity: 0.6,
              zIndex: 10,
            }}
            title="Embedded"
          />
        )}

        {/* Title Section */}
        <div
          style={{
            padding: '12px 14px 8px',
            borderBottom: '1px solid #e8e5d0',
            backgroundColor: '#faf8e8',
            borderRadius: '6px 6px 0 0', // Match parent border radius
          }}
        >
          {isEditing ? (
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={handleTitleChange}
              onPointerDown={stopEventPropagation}
              style={{
                width: '100%',
                border: 'none',
                background: 'transparent',
                fontSize: 15,
                fontWeight: 600,
                color: '#333',
                outline: 'none',
                fontFamily: 'inherit',
              }}
              placeholder="Title..."
            />
          ) : (
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: '#333',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                paddingRight: 16, // Space for indicator
              }}
            >
              {shape.props.title || 'Untitled'}
            </div>
          )}
        </div>

        {/* Content Section */}
        <div
          style={{
            flex: 1,
            padding: '10px 14px 12px',
            overflow: 'hidden',
          }}
        >
          {isEditing ? (
            <textarea
              ref={contentRef}
              value={content}
              onChange={handleContentChange}
              onPointerDown={stopEventPropagation}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                background: 'transparent',
                fontSize: 13,
                color: '#555',
                outline: 'none',
                resize: 'none',
                fontFamily: 'inherit',
                lineHeight: 1.5,
              }}
              placeholder="Add notes..."
            />
          ) : (
            <div
              style={{
                fontSize: 13,
                color: '#555',
                lineHeight: 1.5,
                overflow: 'hidden',
                height: '100%',
              }}
            >
              {shape.props.content || (
                <span style={{ color: '#999', fontStyle: 'italic' }}>
                  Double-click to edit...
                </span>
              )}
            </div>
          )}
        </div>

        {/* Duplicate Warning */}
        {showDuplicateWarning && (
          <DuplicateWarning
            duplicateOfId={duplicateOf}
            similarityScore={similarityScore}
            onDismiss={handleDismissDuplicate}
          />
        )}
      </div>
    </HTMLContainer>
  )
}
