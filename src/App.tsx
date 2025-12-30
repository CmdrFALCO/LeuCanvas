import { useState, useCallback } from 'react'
import { Tldraw, DefaultToolbar, TldrawUiMenuItem, useTools, DefaultToolbarContent } from 'tldraw'
import type { TLComponents, Editor } from 'tldraw'
import 'tldraw/tldraw.css'
import { IdeaCardUtil } from './shapes'
import { IdeaCardTool } from './tools'
import { usePersistence, useEmbedding, useModelLoader, useDuplicateCheck } from './hooks'
import { useVectorIndexSync } from './store'

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
  const { isLoading: isPersistenceLoading } = usePersistence(editor)
  const { isLoading: isModelLoading, progress, status } = useModelLoader()

  // Enable embedding generation when editor is ready
  useEmbedding(editor)

  // Sync vector index with tldraw store
  useVectorIndexSync(editor)

  // Enable duplicate detection
  useDuplicateCheck(editor)

  const handleMount = useCallback((editor: Editor) => {
    setEditor(editor)
  }, [])

  const showFullOverlay = isPersistenceLoading || (isModelLoading && progress < 10)

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>
      <Tldraw
        shapeUtils={customShapes}
        tools={customTools}
        components={components}
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
    </div>
  )
}

export default App
