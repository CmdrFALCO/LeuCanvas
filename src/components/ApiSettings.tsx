import { useState, useCallback, useEffect } from 'react'
import { getStoredApiKey, setStoredApiKey, removeStoredApiKey } from '../lib/llm'
import { CONFIG } from '../lib/constants'

interface ApiSettingsProps {
  isOpen: boolean
  onClose: () => void
}

export function ApiSettings({ isOpen, onClose }: ApiSettingsProps) {
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [hasExistingKey, setHasExistingKey] = useState(false)

  // Load existing key state on open
  useEffect(() => {
    if (isOpen) {
      const existingKey = getStoredApiKey()
      setHasExistingKey(Boolean(existingKey))
      setApiKey('')
      setShowKey(false)
    }
  }, [isOpen])

  const handleSave = useCallback(() => {
    if (apiKey.trim()) {
      setStoredApiKey(apiKey.trim())
      setHasExistingKey(true)
      setApiKey('')
      onClose()
    }
  }, [apiKey, onClose])

  const handleRemove = useCallback(() => {
    removeStoredApiKey()
    setHasExistingKey(false)
    setApiKey('')
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'Enter' && apiKey.trim()) {
      handleSave()
    }
  }, [onClose, apiKey, handleSave])

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
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: 12,
          padding: 24,
          width: 440,
          maxWidth: '90vw',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#333' }}>
            API Settings
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
          >
            ×
          </button>
        </div>

        {/* Status */}
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: hasExistingKey ? '#f0fdf4' : '#fef3c7',
            border: `1px solid ${hasExistingKey ? '#bbf7d0' : '#fde68a'}`,
            borderRadius: 8,
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: hasExistingKey ? '#22c55e' : '#f59e0b',
            }}
          />
          <span style={{ fontSize: 13, color: hasExistingKey ? '#166534' : '#92400e' }}>
            {hasExistingKey ? 'API key is configured' : 'No API key configured'}
          </span>
          {hasExistingKey && (
            <button
              onClick={handleRemove}
              style={{
                marginLeft: 'auto',
                padding: '4px 10px',
                fontSize: 12,
                backgroundColor: 'white',
                border: '1px solid #ddd',
                borderRadius: 4,
                cursor: 'pointer',
                color: '#666',
              }}
            >
              Remove
            </button>
          )}
        </div>

        {/* API Key Input */}
        <div style={{ marginBottom: 16 }}>
          <label
            htmlFor="api-key-input"
            style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500, color: '#555' }}
          >
            {hasExistingKey ? 'Update API Key' : 'OpenAI API Key'}
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="api-key-input"
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              style={{
                width: '100%',
                padding: '10px 12px',
                paddingRight: 80,
                border: '1px solid #ddd',
                borderRadius: 8,
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'monospace',
              }}
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                padding: '4px 8px',
                fontSize: 11,
                backgroundColor: '#f5f5f5',
                border: '1px solid #ddd',
                borderRadius: 4,
                cursor: 'pointer',
                color: '#666',
              }}
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 12, color: '#999' }}>
            Your API key is stored locally in your browser and never sent to our servers.
          </p>
        </div>

        {/* Model Info */}
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#f9fafb',
            borderRadius: 8,
            marginBottom: 20,
            fontSize: 12,
            color: '#666',
          }}
        >
          <div style={{ marginBottom: 4 }}>
            <strong>Model:</strong> {CONFIG.LLM_DEFAULT_MODEL}
          </div>
          <div>
            <strong>Features:</strong> RAG-powered chat with your idea cards as context
          </div>
        </div>

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
            onClick={handleSave}
            disabled={!apiKey.trim()}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              backgroundColor: apiKey.trim() ? '#3b82f6' : '#e5e5e5',
              color: apiKey.trim() ? 'white' : '#999',
              cursor: apiKey.trim() ? 'pointer' : 'not-allowed',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
