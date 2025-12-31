import { useState, useCallback, useRef } from 'react'
import type { Editor } from 'tldraw'
import { exportAndDownload, type ExportData } from '../lib/export'
import {
  parseImportFile,
  validateImportData,
  importCards,
  readFileAsText,
  type ImportMode,
  type ValidationResult,
} from '../lib/import'

interface ImportExportMenuProps {
  editor: Editor | null
  onClearAll: () => Promise<void>
  showSuccess: (message: string) => void
  showError: (message: string) => void
}

// Hamburger menu button
function MenuButton({ isOpen, onClick }: { isOpen: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Menu"
      style={{
        position: 'absolute',
        top: 12,
        left: 12,
        width: 36,
        height: 36,
        borderRadius: 6,
        border: '1px solid #e5e5e5',
        backgroundColor: isOpen ? '#f3f4f6' : 'white',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        transition: 'all 0.15s ease',
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2">
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    </button>
  )
}

// Dropdown menu
function DropdownMenu({
  onExport,
  onImport,
}: {
  onExport: () => void
  onImport: () => void
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 52,
        left: 12,
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
        onClick={onImport}
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

export function ImportExportMenu({
  editor,
  onClearAll,
  showSuccess,
  showError,
}: ImportExportMenuProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [importDialogData, setImportDialogData] = useState<{
    validation: ValidationResult
    data: ExportData
  } | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
        const result = await importCards(editor, importDialogData.data, mode, onClearAll)

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
    [editor, importDialogData, onClearAll, showSuccess, showError]
  )

  // Close menu when clicking outside
  const handleBackdropClick = useCallback(() => {
    setIsMenuOpen(false)
  }, [])

  return (
    <>
      <MenuButton isOpen={isMenuOpen} onClick={() => setIsMenuOpen(!isMenuOpen)} />

      {isMenuOpen && (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 999,
            }}
            onClick={handleBackdropClick}
          />
          <DropdownMenu onExport={handleExport} onImport={handleImportClick} />
        </>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
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
    </>
  )
}
