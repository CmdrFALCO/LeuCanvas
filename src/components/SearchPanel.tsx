import { useState, useCallback, useRef, useEffect } from 'react'
import type { Editor } from 'tldraw'
import { embeddingPipeline } from '../lib/embeddings'
import { findSimilar } from '../lib/similarity'
import { useVectorIndex } from '../store/useVectorIndex'
import { CONFIG } from '../lib/constants'
import type { SimilarityResult } from '../types'

interface SearchPanelProps {
  editor: Editor | null
  isOpen: boolean
  onClose: () => void
}

export function SearchPanel({ editor, isOpen, onClose }: SearchPanelProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SimilarityResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const getAllEntries = useVectorIndex((state) => state.getAllEntries)

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Clear results when closed
  useEffect(() => {
    if (!isOpen) {
      setQuery('')
      setResults([])
      setSelectedIndex(-1)
    }
  }, [isOpen])

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(-1)
  }, [results])

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      return
    }

    setIsSearching(true)
    try {
      // Generate embedding for query
      const queryVector = await embeddingPipeline.embed(`search-${Date.now()}`, searchQuery)

      if (queryVector.length === 0) {
        setResults([])
        return
      }

      // Find similar entries
      const entries = getAllEntries()
      const similar = findSimilar(queryVector, entries, CONFIG.SEARCH_TOP_K)
      setResults(similar)
    } catch (error) {
      console.error('Search failed:', error)
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }, [getAllEntries])

  const handleQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value
    setQuery(newQuery)

    // Debounce search
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      performSearch(newQuery)
    }, 300)
  }, [performSearch])

  const handleResultClick = useCallback((id: string) => {
    if (!editor) return

    // Get the shape
    const shape = editor.getShape(id as any)
    if (!shape) return

    // Select and center on the shape
    editor.select(id as any)
    editor.zoomToSelection({ animation: { duration: 300 } })

    // Close panel after navigation
    onClose()
  }, [editor, onClose])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
      return
    }

    // Arrow key navigation
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1))
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, -1))
      return
    }

    // Enter to select
    if (e.key === 'Enter' && selectedIndex >= 0 && results[selectedIndex]) {
      e.preventDefault()
      handleResultClick(results[selectedIndex].id)
    }
  }, [onClose, results, selectedIndex, handleResultClick])

  if (!isOpen) return null

  return (
    <div
      style={{
        width: 320,
        height: '100%',
        backgroundColor: '#fafafa',
        borderRight: '1px solid #e5e5e5',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid #e5e5e5',
          backgroundColor: 'white',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#333' }}>
            Semantic Search
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              color: '#666',
              fontSize: 18,
              lineHeight: 1,
            }}
            title="Close (Esc)"
          >
            ×
          </button>
        </div>
        <div style={{ position: 'relative' }}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleQueryChange}
            placeholder="Search by meaning..."
            style={{
              width: '100%',
              padding: '10px 12px',
              paddingRight: 36,
              border: '1px solid #ddd',
              borderRadius: 8,
              fontSize: 14,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {isSearching && (
            <div
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 16,
                height: 16,
                border: '2px solid #e5e5e5',
                borderTopColor: '#3b82f6',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
          )}
        </div>
      </div>

      {/* Results */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px',
        }}
      >
        {query.trim() && results.length === 0 && !isSearching && (
          <div
            style={{
              padding: 16,
              textAlign: 'center',
              color: '#999',
              fontSize: 13,
            }}
          >
            No matching cards found
          </div>
        )}

        {results.map((result, index) => {
          const isSelected = index === selectedIndex
          return (
          <button
            key={result.id}
            onClick={() => handleResultClick(result.id)}
            onMouseEnter={() => setSelectedIndex(index)}
            style={{
              width: '100%',
              padding: '12px',
              marginBottom: 8,
              backgroundColor: isSelected ? '#f0f9ff' : 'white',
              border: `1px solid ${isSelected ? '#3b82f6' : '#e5e5e5'}`,
              borderRadius: 8,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease',
              outline: 'none',
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
              {result.text.split('\n')[0] || 'Untitled'}
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
              {result.text.split('\n').slice(1).join(' ').slice(0, 100) || 'No content'}
            </div>
            <div
              style={{
                fontSize: 11,
                color: getSimilarityColor(result.score),
                fontWeight: 500,
              }}
            >
              {Math.round(result.score * 100)}% match
            </div>
          </button>
          )
        })}
      </div>

      {/* Footer hint */}
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
        ↑↓ Navigate • Enter Select • Esc Close
      </div>

      <style>
        {`
          @keyframes spin {
            to { transform: translateY(-50%) rotate(360deg); }
          }
        `}
      </style>
    </div>
  )
}

function getSimilarityColor(score: number): string {
  if (score >= CONFIG.DUPLICATE_THRESHOLD) return '#dc2626' // Red
  if (score >= CONFIG.SIMILAR_THRESHOLD) return '#f59e0b' // Orange
  if (score >= CONFIG.RELATED_THRESHOLD) return '#10b981' // Green
  return '#6b7280' // Gray
}
