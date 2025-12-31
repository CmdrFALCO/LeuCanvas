import { useState, useCallback, useMemo, useEffect } from 'react'
import { Tldraw, DefaultToolbar, TldrawUiMenuItem, useTools, DefaultToolbarContent } from 'tldraw'
import type { TLComponents, Editor, TLUiOverrides } from 'tldraw'
import 'tldraw/tldraw.css'
import { IdeaCardUtil } from './shapes'
import { IdeaCardTool } from './tools'
import { usePersistence, useEmbedding, useModelLoader, useDuplicateCheck, useHotkeys, useAutoExport } from './hooks'
import { useVectorIndexSync } from './store'
import { SearchPanel, RelatedSidebar, QuickCapture, ChatPanel, ApiSettings, ToastContainer, useToast, ImportExportMenu } from './components'
import { isElectron, electronAPI } from './lib/electron'

// Confirmation dialog component
function ConfirmDialog({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!isOpen) return null

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
      onClick={onCancel}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: 12,
          padding: 24,
          maxWidth: 400,
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 600, color: '#333' }}>
          {title}
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: '#666', lineHeight: 1.5 }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid #ddd',
              backgroundColor: 'white',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: '#ef4444',
              color: 'white',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Clear All
          </button>
        </div>
      </div>
    </div>
  )
}

// Clear canvas button component - positioned bottom-right to avoid tldraw's style panel
function ClearCanvasButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Clear all cards"
      style={{
        position: 'absolute',
        bottom: 12,
        right: 12,
        padding: '8px 12px',
        borderRadius: 6,
        border: '1px solid #e5e5e5',
        backgroundColor: 'white',
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 500,
        color: '#666',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        zIndex: 999,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#fef2f2'
        e.currentTarget.style.borderColor = '#fecaca'
        e.currentTarget.style.color = '#dc2626'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'white'
        e.currentTarget.style.borderColor = '#e5e5e5'
        e.currentTarget.style.color = '#666'
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
      Clear All
    </button>
  )
}

// Custom shapes array
const customShapes = [IdeaCardUtil]

// Custom tools array
const customTools = [IdeaCardTool]

// Custom toolbar with IdeaCard tool
function CustomToolbar() {
  const tools = useTools()
  const ideaCardTool = tools['idea-card']

  return (
    <DefaultToolbar>
      {ideaCardTool && <TldrawUiMenuItem {...ideaCardTool} />}
      <DefaultToolbarContent />
    </DefaultToolbar>
  )
}

// Override components
const components: TLComponents = {
  Toolbar: CustomToolbar,
}

// Loading overlay component
function LoadingOverlay({
  message,
  progress,
}: {
  message: string
  progress?: number
}) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        zIndex: 1000,
        gap: 12,
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 500, color: '#333' }}>
        {message}
      </div>
      {progress !== undefined && progress > 0 && progress < 100 && (
        <div
          style={{
            width: 200,
            height: 4,
            backgroundColor: '#e5e5e5',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              backgroundColor: '#3b82f6',
              transition: 'width 0.2s ease-out',
            }}
          />
        </div>
      )}
    </div>
  )
}

// Model status indicator
function ModelStatus({
  isLoading,
  status,
}: {
  isLoading: boolean
  status: string
}) {
  if (!isLoading) return null

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 12,
        left: 12,
        padding: '6px 12px',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        borderRadius: 6,
        fontSize: 12,
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: '#3b82f6',
          animation: 'pulse 1.5s infinite',
        }}
      />
      {status || 'Loading AI model...'}
    </div>
  )
}

function App() {
  const [editor, setEditor] = useState<Editor | null>(null)
  const [showClearDialog, setShowClearDialog] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isRelatedCollapsed, setIsRelatedCollapsed] = useState(false)
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isApiSettingsOpen, setIsApiSettingsOpen] = useState(false)
  const { isLoading: isPersistenceLoading, clearAll } = usePersistence(editor)
  const { isLoading: isModelLoading, progress, status } = useModelLoader()
  const { toasts, dismissToast, showSuccess, showError } = useToast()

  // Toggle search panel
  const toggleSearch = useCallback(() => {
    setIsSearchOpen((prev) => !prev)
  }, [])

  // Toggle related sidebar
  const toggleRelatedCollapse = useCallback(() => {
    setIsRelatedCollapsed((prev) => !prev)
  }, [])

  // Toggle quick capture modal
  const handleQuickCapture = useCallback(() => {
    setIsQuickCaptureOpen(true)
  }, [])

  // Register hotkeys
  useHotkeys({
    onToggleSearch: toggleSearch,
    onQuickCapture: handleQuickCapture,
  })

  const handleClearClick = useCallback(() => {
    setShowClearDialog(true)
  }, [])

  const handleClearConfirm = useCallback(async () => {
    await clearAll()
    setShowClearDialog(false)
  }, [clearAll])

  const handleClearCancel = useCallback(() => {
    setShowClearDialog(false)
  }, [])

  // Define UI overrides for custom tools
  const overrides = useMemo<TLUiOverrides>(
    () => ({
      tools(editor, tools) {
        tools['idea-card'] = {
          id: 'idea-card',
          icon: 'tool-note',
          label: 'Idea Card',
          kbd: 'i',
          onSelect: () => {
            editor.setCurrentTool('idea-card')
          },
        }
        return tools
      },
    }),
    []
  )

  // Enable embedding generation when editor is ready
  useEmbedding(editor)

  // Sync vector index with tldraw store
  useVectorIndexSync(editor)

  // Listen for Electron global shortcuts
  useEffect(() => {
    if (!isElectron() || !electronAPI) return

    const unsubQuickCapture = electronAPI.onQuickCapture(() => {
      setIsQuickCaptureOpen(true)
    })

    const unsubSearch = electronAPI.onSearch(() => {
      setIsSearchOpen(true)
    })

    return () => {
      unsubQuickCapture()
      unsubSearch()
    }
  }, [])

  // Enable duplicate detection
  useDuplicateCheck(editor)

  // Auto-export to MCP when in Electron
  useAutoExport(editor)

  const handleMount = useCallback((editor: Editor) => {
    setEditor(editor)
  }, [])

  const showFullOverlay = isPersistenceLoading || (isModelLoading && progress < 10)

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex' }}>
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>

      {/* Left sidebar: Search Panel */}
      <SearchPanel
        editor={editor}
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />

      {/* Center: Canvas - overflow hidden to contain tldraw UI within bounds */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <Tldraw
          shapeUtils={customShapes}
          tools={customTools}
          components={components}
          overrides={overrides}
          onMount={handleMount}
        />
        {showFullOverlay && (
          <LoadingOverlay
            message={isPersistenceLoading ? 'Loading canvas...' : 'Loading AI model...'}
            progress={isPersistenceLoading ? undefined : progress}
          />
        )}
        {!showFullOverlay && isModelLoading && (
          <ModelStatus isLoading={isModelLoading} status={status} />
        )}
        {!showFullOverlay && <ClearCanvasButton onClick={handleClearClick} />}
        {!showFullOverlay && !isChatOpen && (
          <button
            onClick={() => setIsChatOpen(true)}
            style={{
              position: 'absolute',
              top: 60,
              right: 12,
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid #e5e5e5',
              backgroundColor: 'white',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
              color: '#666',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              zIndex: 999,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            }}
            title="AI Chat"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Chat
          </button>
        )}
        {!showFullOverlay && (
          <ImportExportMenu
            editor={editor}
            onClearAll={clearAll}
            showSuccess={showSuccess}
            showError={showError}
          />
        )}
        {!showFullOverlay && !isSearchOpen && (
          <button
            onClick={toggleSearch}
            style={{
              position: 'absolute',
              top: 12,
              left: 56,
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid #e5e5e5',
              backgroundColor: 'white',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
              color: '#666',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              zIndex: 999,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            }}
            title="Search (Ctrl+K)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            Search
          </button>
        )}
      </div>

      {/* Right panel: Chat */}
      <ChatPanel
        editor={editor}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        onOpenSettings={() => setIsApiSettingsOpen(true)}
      />

      {/* Right sidebar: Related Cards (only show when chat is closed) */}
      {!isChatOpen && (
        <RelatedSidebar
          editor={editor}
          isCollapsed={isRelatedCollapsed}
          onToggleCollapse={toggleRelatedCollapse}
        />
      )}

      <ConfirmDialog
        isOpen={showClearDialog}
        title="Clear Canvas"
        message="Clear all cards? This will delete all idea cards and their embeddings. This cannot be undone."
        onConfirm={handleClearConfirm}
        onCancel={handleClearCancel}
      />

      <QuickCapture
        editor={editor}
        isOpen={isQuickCaptureOpen}
        onClose={() => setIsQuickCaptureOpen(false)}
      />

      <ApiSettings
        isOpen={isApiSettingsOpen}
        onClose={() => setIsApiSettingsOpen(false)}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}

export default App
