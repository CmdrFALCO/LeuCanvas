import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { Tldraw, DefaultToolbar, TldrawUiMenuItem, useTools, DefaultToolbarContent } from 'tldraw'
import type { TLComponents, Editor, TLUiOverrides } from 'tldraw'
import 'tldraw/tldraw.css'
import { IdeaCardUtil } from './shapes'
import { IdeaCardTool } from './tools'
import { usePersistence, useEmbedding, useModelLoader, useDuplicateCheck, useHotkeys, useAutoExport, useImportPending } from './hooks'
import { useVectorIndexSync } from './store'
import { SearchPanel, RelatedSidebar, QuickCapture, ChatPanel, ApiSettings, ToastContainer, useToast } from './components'
import { isElectron, electronAPI } from './lib/electron'
import { exportAndDownload, type ExportData } from './lib/export'
import {
  parseImportFile,
  validateImportData,
  importCards,
  readFileAsText,
  type ImportMode,
  type ValidationResult,
} from './lib/import'

const HEADER_HEIGHT = 48

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

// Import preview dialog
function ImportDialog({
  validation,
  data,
  onImport,
  onCancel,
  isImporting,
}: {
  validation: ValidationResult
  data: ExportData
  onImport: (mode: ImportMode) => void
  onCancel: () => void
  isImporting: boolean
}) {
  const formatDate = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleString()
    } catch {
      return isoString
    }
  }

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
          maxWidth: 420,
          width: '90%',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 600, color: '#333' }}>
          Import Canvas
        </h3>

        {/* Preview info */}
        <div
          style={{
            backgroundColor: '#f9fafb',
            borderRadius: 8,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: '#666', fontSize: 14 }}>Cards found:</span>
            <span style={{ fontWeight: 600, color: '#333', fontSize: 14 }}>{validation.cardCount}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: '#666', fontSize: 14 }}>Has embeddings:</span>
            <span style={{ fontWeight: 600, color: validation.hasEmbeddings ? '#10b981' : '#f59e0b', fontSize: 14 }}>
              {validation.hasEmbeddings ? 'Yes' : 'No (will re-embed)'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#666', fontSize: 14 }}>Exported at:</span>
            <span style={{ fontWeight: 500, color: '#333', fontSize: 14 }}>{formatDate(data.exportedAt)}</span>
          </div>
        </div>

        {/* Validation errors */}
        {validation.errors.length > 0 && (
          <div
            style={{
              backgroundColor: '#fef2f2',
              borderRadius: 8,
              padding: 12,
              marginBottom: 20,
              border: '1px solid #fecaca',
            }}
          >
            <div style={{ color: '#dc2626', fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
              Validation warnings:
            </div>
            <ul style={{ margin: 0, paddingLeft: 20, color: '#b91c1c', fontSize: 13 }}>
              {validation.errors.slice(0, 3).map((error, i) => (
                <li key={i}>{error}</li>
              ))}
              {validation.errors.length > 3 && (
                <li>...and {validation.errors.length - 3} more</li>
              )}
            </ul>
          </div>
        )}

        {/* Import mode buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          <button
            onClick={() => onImport('replace')}
            disabled={isImporting}
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              border: '2px solid #3b82f6',
              backgroundColor: '#3b82f6',
              color: 'white',
              cursor: isImporting ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 600,
              opacity: isImporting ? 0.6 : 1,
            }}
          >
            Replace - Clear canvas and import
          </button>
          <button
            onClick={() => onImport('merge')}
            disabled={isImporting}
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              border: '2px solid #3b82f6',
              backgroundColor: 'white',
              color: '#3b82f6',
              cursor: isImporting ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 600,
              opacity: isImporting ? 0.6 : 1,
            }}
          >
            Merge - Add alongside existing cards
          </button>
        </div>

        {/* Cancel button */}
        <button
          onClick={onCancel}
          disabled={isImporting}
          style={{
            width: '100%',
            padding: '10px 16px',
            borderRadius: 6,
            border: '1px solid #ddd',
            backgroundColor: 'white',
            cursor: isImporting ? 'not-allowed' : 'pointer',
            fontSize: 14,
            color: '#666',
          }}
        >
          Cancel
        </button>

        {isImporting && (
          <div
            style={{
              marginTop: 12,
              textAlign: 'center',
              color: '#666',
              fontSize: 13,
            }}
          >
            Importing cards...
          </div>
        )}
      </div>
    </div>
  )
}

// Header toolbar component
function HeaderToolbar({
  isSearchOpen,
  isChatOpen,
  isMenuOpen,
  onToggleSearch,
  onToggleChat,
  onToggleMenu,
  onExport,
  onImportClick,
  onImportFromClaude,
  showImportFromClaude,
}: {
  isSearchOpen: boolean
  isChatOpen: boolean
  isMenuOpen: boolean
  onToggleSearch: () => void
  onToggleChat: () => void
  onToggleMenu: () => void
  onExport: () => void
  onImportClick: () => void
  onImportFromClaude: () => void
  showImportFromClaude: boolean
}) {
  return (
    <div
      style={{
        height: HEADER_HEIGHT,
        backgroundColor: '#fafafa',
        borderBottom: '1px solid #e5e5e5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        flexShrink: 0,
        zIndex: 1000,
      }}
    >
      {/* Left side: Menu and Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Hamburger menu button */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={onToggleMenu}
            title="Menu"
            style={{
              width: 36,
              height: 36,
              borderRadius: 6,
              border: '1px solid #e5e5e5',
              backgroundColor: isMenuOpen ? '#f3f4f6' : 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          {/* Dropdown menu */}
          {isMenuOpen && (
            <div
              style={{
                position: 'absolute',
                top: 42,
                left: 0,
                backgroundColor: 'white',
                borderRadius: 8,
                border: '1px solid #e5e5e5',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                zIndex: 1001,
                overflow: 'hidden',
                minWidth: 160,
              }}
            >
              <button
                onClick={onExport}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 14,
                  color: '#333',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export Canvas
              </button>
              <div style={{ height: 1, backgroundColor: '#e5e5e5' }} />
              <button
                onClick={onImportClick}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 14,
                  color: '#333',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Import Canvas
              </button>
              {showImportFromClaude && (
                <>
                  <div style={{ height: 1, backgroundColor: '#e5e5e5' }} />
                  <button
                    onClick={onImportFromClaude}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      fontSize: 14,
                      color: '#333',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2L2 7l10 5 10-5-10-5z" />
                      <path d="M2 17l10 5 10-5" />
                      <path d="M2 12l10 5 10-5" />
                    </svg>
                    Import from Claude
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Search button */}
        <button
          onClick={onToggleSearch}
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid #e5e5e5',
            backgroundColor: isSearchOpen ? '#f3f4f6' : 'white',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
            color: '#666',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
          }}
          title="Search (Ctrl+K)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          Search
        </button>
      </div>

      {/* Right side: Chat toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={onToggleChat}
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid #e5e5e5',
            backgroundColor: isChatOpen ? '#f3f4f6' : 'white',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
            color: '#666',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
          }}
          title="AI Chat"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Chat
        </button>
      </div>
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
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [importDialogData, setImportDialogData] = useState<{
    validation: ValidationResult
    data: ExportData
  } | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { isLoading: isPersistenceLoading, clearAll } = usePersistence(editor)
  const { isLoading: isModelLoading, progress, status } = useModelLoader()
  const { toasts, dismissToast, showSuccess, showError } = useToast()

  // Import pending notes from MCP server (Electron only)
  const { importFromClaude } = useImportPending(editor, {
    onSuccess: (count) => showSuccess(`Imported ${count} notes from Claude`),
    onError: (error) => showError(`Failed to import from Claude: ${error}`),
  })

  // Toggle search panel
  const toggleSearch = useCallback(() => {
    setIsSearchOpen((prev) => !prev)
  }, [])

  // Toggle chat panel
  const toggleChat = useCallback(() => {
    setIsChatOpen((prev) => !prev)
  }, [])

  // Toggle menu
  const toggleMenu = useCallback(() => {
    setIsMenuOpen((prev) => !prev)
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

  // Handle export
  const handleExport = useCallback(() => {
    setIsMenuOpen(false)
    if (!editor) {
      showError('Editor not ready')
      return
    }

    const result = exportAndDownload(editor, true)
    if (result.success) {
      showSuccess(`Exported ${result.cardCount} cards`)
    } else {
      showError(result.error || 'Export failed')
    }
  }, [editor, showSuccess, showError])

  // Handle import file selection
  const handleImportClick = useCallback(() => {
    setIsMenuOpen(false)
    fileInputRef.current?.click()
  }, [])

  // Handle import from Claude (MCP pending notes)
  const handleImportFromClaude = useCallback(async () => {
    setIsMenuOpen(false)
    await importFromClaude()
  }, [importFromClaude])

  // Handle file selected
  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      // Reset input so same file can be selected again
      e.target.value = ''

      try {
        const content = await readFileAsText(file)
        const parseResult = parseImportFile(content)

        if (!parseResult.data) {
          showError(parseResult.error || 'Failed to parse file')
          return
        }

        const validation = validateImportData(parseResult.data)

        if (!validation.valid && validation.cardCount === 0) {
          showError('Invalid file format: ' + validation.errors[0])
          return
        }

        // Show import dialog
        setImportDialogData({
          validation,
          data: parseResult.data,
        })
      } catch (error) {
        showError('Failed to read file')
        console.error('Import error:', error)
      }
    },
    [showError]
  )

  // Handle import action
  const handleImport = useCallback(
    async (mode: ImportMode) => {
      if (!editor || !importDialogData) return

      setIsImporting(true)
      try {
        const result = await importCards(editor, importDialogData.data, mode, clearAll)

        if (result.success) {
          const message =
            result.skippedCount > 0
              ? `Imported ${result.importedCount} cards (${result.skippedCount} skipped)`
              : `Imported ${result.importedCount} cards`
          showSuccess(message)
        } else {
          showError(result.error || 'Import failed')
        }
      } finally {
        setIsImporting(false)
        setImportDialogData(null)
      }
    },
    [editor, importDialogData, clearAll, showSuccess, showError]
  )

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

  // Close menu when clicking outside
  useEffect(() => {
    if (!isMenuOpen) return

    const handleClickOutside = () => {
      setIsMenuOpen(false)
    }

    // Delay to avoid immediate close
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside)
    }, 0)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('click', handleClickOutside)
    }
  }, [isMenuOpen])

  // Enable duplicate detection
  useDuplicateCheck(editor)

  // Auto-export to MCP when in Electron
  useAutoExport(editor)

  const handleMount = useCallback((editor: Editor) => {
    setEditor(editor)
  }, [])

  const showFullOverlay = isPersistenceLoading || (isModelLoading && progress < 10)

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>

      {/* Header toolbar - always at the top */}
      <HeaderToolbar
        isSearchOpen={isSearchOpen}
        isChatOpen={isChatOpen}
        isMenuOpen={isMenuOpen}
        onToggleSearch={toggleSearch}
        onToggleChat={toggleChat}
        onToggleMenu={toggleMenu}
        onExport={handleExport}
        onImportClick={handleImportClick}
        onImportFromClaude={handleImportFromClaude}
        showImportFromClaude={isElectron()}
      />

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Main content area below header */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
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
      </div>

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

      {/* Import dialog */}
      {importDialogData && (
        <ImportDialog
          validation={importDialogData.validation}
          data={importDialogData.data}
          onImport={handleImport}
          onCancel={() => setImportDialogData(null)}
          isImporting={isImporting}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}

export default App
