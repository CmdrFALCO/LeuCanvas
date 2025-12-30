import { useState, useEffect, useCallback } from 'react'
import { embeddingPipeline } from '../lib/embeddings'

interface ModelLoadingState {
  isLoading: boolean
  isReady: boolean
  progress: number
  status: string
  error: string | null
}

export function useModelLoader() {
  const [state, setState] = useState<ModelLoadingState>({
    isLoading: false,
    isReady: embeddingPipeline.isReady(),
    progress: 0,
    status: '',
    error: null,
  })

  const loadModel = useCallback(async () => {
    if (embeddingPipeline.isReady()) {
      setState((prev) => ({ ...prev, isReady: true, isLoading: false }))
      return
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    // Set progress callback
    embeddingPipeline.setProgressCallback((status, progress) => {
      setState((prev) => ({
        ...prev,
        status,
        progress: Math.round(progress * 100),
      }))
    })

    try {
      await embeddingPipeline.initialize()
      setState((prev) => ({
        ...prev,
        isLoading: false,
        isReady: true,
        progress: 100,
        status: 'Ready',
      }))
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        isReady: false,
        error: error instanceof Error ? error.message : 'Failed to load model',
      }))
    } finally {
      embeddingPipeline.setProgressCallback(null)
    }
  }, [])

  // Auto-load model on mount
  useEffect(() => {
    loadModel()
  }, [loadModel])

  return {
    ...state,
    loadModel,
  }
}
