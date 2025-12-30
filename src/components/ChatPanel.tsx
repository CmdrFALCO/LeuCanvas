import { useState, useCallback, useRef, useEffect } from 'react'
import type { Editor } from 'tldraw'
import { useChat, type ChatMessage } from '../hooks/useChat'

interface ChatPanelProps {
  editor: Editor | null
  isOpen: boolean
  onClose: () => void
  onOpenSettings: () => void
}

export function ChatPanel({ editor, isOpen, onClose, onOpenSettings }: ChatPanelProps) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { messages, isLoading, error, sendMessage, clearChat, hasApiKey } = useChat()

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isLoading) return
    const message = input.trim()
    setInput('')
    await sendMessage(message)
  }, [input, isLoading, sendMessage])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape') {
      onClose()
    }
  }, [handleSubmit, onClose])

  const handleCardClick = useCallback((cardId: string) => {
    if (!editor) return
    const shape = editor.getShape(cardId as any)
    if (!shape) return
    editor.select(cardId as any)
    editor.zoomToSelection({ animation: { duration: 300 } })
  }, [editor])

  if (!isOpen) return null

  return (
    <div
      style={{
        width: 380,
        height: '100%',
        backgroundColor: '#fafafa',
        borderLeft: '1px solid #e5e5e5',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #e5e5e5',
          backgroundColor: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#333' }}>
            AI Chat
          </h3>
          {!hasApiKey && (
            <span
              style={{
                fontSize: 10,
                padding: '2px 6px',
                backgroundColor: '#fef3c7',
                color: '#92400e',
                borderRadius: 4,
              }}
            >
              No API Key
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={onOpenSettings}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 6,
              color: '#666',
              borderRadius: 4,
            }}
            title="Settings"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          <button
            onClick={clearChat}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 6,
              color: '#666',
              borderRadius: 4,
            }}
            title="Clear chat"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 6,
              color: '#666',
              borderRadius: 4,
            }}
            title="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 12,
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              color: '#999',
              fontSize: 13,
              padding: 24,
            }}
          >
            {hasApiKey ? (
              <>
                <div style={{ marginBottom: 8 }}>Ask questions about your idea cards</div>
                <div style={{ fontSize: 11, color: '#bbb' }}>
                  The AI will search your cards for relevant context
                </div>
              </>
            ) : (
              <>
                <div style={{ marginBottom: 8 }}>Configure your API key to start chatting</div>
                <button
                  onClick={onOpenSettings}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  Open Settings
                </button>
              </>
            )}
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onCardClick={handleCardClick}
          />
        ))}

        {isLoading && messages[messages.length - 1]?.role === 'user' && (
          <div style={{ display: 'flex', gap: 8, padding: '8px 0' }}>
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: '#3b82f6',
                animation: 'pulse 1s infinite',
              }}
            />
            <span style={{ fontSize: 12, color: '#666' }}>Thinking...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            padding: '8px 12px',
            backgroundColor: '#fef2f2',
            borderTop: '1px solid #fecaca',
            fontSize: 12,
            color: '#dc2626',
          }}
        >
          {error}
        </div>
      )}

      {/* Input */}
      <div
        style={{
          padding: 12,
          borderTop: '1px solid #e5e5e5',
          backgroundColor: 'white',
        }}
      >
        <div style={{ position: 'relative' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={hasApiKey ? "Ask about your cards..." : "Configure API key first..."}
            disabled={!hasApiKey || isLoading}
            rows={2}
            style={{
              width: '100%',
              padding: '10px 12px',
              paddingRight: 44,
              border: '1px solid #ddd',
              borderRadius: 8,
              fontSize: 14,
              outline: 'none',
              boxSizing: 'border-box',
              resize: 'none',
              fontFamily: 'inherit',
              backgroundColor: hasApiKey ? 'white' : '#f9fafb',
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading || !hasApiKey}
            style={{
              position: 'absolute',
              right: 8,
              bottom: 8,
              width: 28,
              height: 28,
              borderRadius: 6,
              border: 'none',
              backgroundColor: input.trim() && hasApiKey ? '#3b82f6' : '#e5e5e5',
              color: input.trim() && hasApiKey ? 'white' : '#999',
              cursor: input.trim() && hasApiKey ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <div style={{ fontSize: 10, color: '#999', marginTop: 6, textAlign: 'center' }}>
          Enter to send • Shift+Enter for new line
        </div>
      </div>

      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}
      </style>
    </div>
  )
}

// Message bubble component
function MessageBubble({
  message,
  onCardClick,
}: {
  message: ChatMessage
  onCardClick: (id: string) => void
}) {
  const isUser = message.role === 'user'

  return (
    <div
      style={{
        marginBottom: 12,
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
      }}
    >
      {/* Context cards indicator */}
      {message.context && message.context.length > 0 && (
        <div
          style={{
            fontSize: 11,
            color: '#666',
            marginBottom: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          {message.context.length} card{message.context.length > 1 ? 's' : ''} used as context
        </div>
      )}

      {/* Message content */}
      <div
        style={{
          maxWidth: '85%',
          padding: '10px 14px',
          borderRadius: 12,
          backgroundColor: isUser ? '#3b82f6' : 'white',
          color: isUser ? 'white' : '#333',
          border: isUser ? 'none' : '1px solid #e5e5e5',
          fontSize: 13,
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {message.content || (
          <span style={{ color: isUser ? 'rgba(255,255,255,0.7)' : '#999' }}>...</span>
        )}
      </div>

      {/* Context cards (expandable) */}
      {message.context && message.context.length > 0 && (
        <ContextCards context={message.context} onCardClick={onCardClick} />
      )}
    </div>
  )
}

// Context cards dropdown
function ContextCards({
  context,
  onCardClick,
}: {
  context: ChatMessage['context']
  onCardClick: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  if (!context) return null

  return (
    <div style={{ marginTop: 4, width: '85%' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          fontSize: 11,
          color: '#666',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '2px 0',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <span style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
          ▶
        </span>
        View referenced cards
      </button>

      {expanded && (
        <div
          style={{
            marginTop: 6,
            padding: 8,
            backgroundColor: '#f9fafb',
            borderRadius: 8,
            border: '1px solid #e5e5e5',
          }}
        >
          {context.map((card) => (
            <button
              key={card.id}
              onClick={() => onCardClick(card.id)}
              style={{
                display: 'block',
                width: '100%',
                padding: '6px 8px',
                marginBottom: 4,
                backgroundColor: 'white',
                border: '1px solid #e5e5e5',
                borderRadius: 4,
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: 11,
              }}
            >
              <div style={{ fontWeight: 500, color: '#333', marginBottom: 2 }}>
                {card.text.split('\n')[0] || 'Untitled'}
              </div>
              <div style={{ color: '#999' }}>
                {Math.round(card.score * 100)}% relevant
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
