import { pipeline, env, type FeatureExtractionPipeline } from '@xenova/transformers'

// Configure transformers.js for browser environment
env.allowLocalModels = false
env.useBrowserCache = true

// Embedding config (duplicated here to avoid import issues in worker)
const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2'

// Message types
interface EmbedRequest {
  type: 'embed'
  id: string
  text: string
}

interface InitRequest {
  type: 'init'
}

type WorkerRequest = EmbedRequest | InitRequest

interface EmbedResponse {
  type: 'embed-result'
  id: string
  vector: number[]
}

interface InitResponse {
  type: 'init-complete'
  success: boolean
  error?: string
}

interface ProgressResponse {
  type: 'progress'
  status: string
  progress: number
}

interface ErrorResponse {
  type: 'error'
  id?: string
  error: string
}

type WorkerResponse = EmbedResponse | InitResponse | ProgressResponse | ErrorResponse

// Pipeline instance (lazy loaded)
let extractor: FeatureExtractionPipeline | null = null
let initPromise: Promise<FeatureExtractionPipeline> | null = null

// Initialize the embedding pipeline
async function initializePipeline(): Promise<FeatureExtractionPipeline> {
  if (extractor) return extractor
  if (initPromise) return initPromise

  initPromise = pipeline('feature-extraction', EMBEDDING_MODEL, {
    quantized: true, // Use quantized model for faster load
    progress_callback: (progress: { status: string; progress?: number }) => {
      const response: ProgressResponse = {
        type: 'progress',
        status: progress.status,
        progress: progress.progress ?? 0,
      }
      self.postMessage(response)
    },
  })

  try {
    extractor = await initPromise
    return extractor
  } catch (error) {
    initPromise = null
    throw error
  }
}

// Generate embedding for text
async function generateEmbedding(text: string): Promise<number[]> {
  const pipe = await initializePipeline()

  // Combine title and content for embedding
  const output = await pipe(text, {
    pooling: 'mean',
    normalize: true,
  })

  // Convert to regular array
  return Array.from(output.data as Float32Array)
}

// Handle incoming messages
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { data } = event

  try {
    switch (data.type) {
      case 'init': {
        await initializePipeline()
        const response: InitResponse = {
          type: 'init-complete',
          success: true,
        }
        self.postMessage(response)
        break
      }

      case 'embed': {
        const { id, text } = data

        if (!text || text.trim().length === 0) {
          const response: EmbedResponse = {
            type: 'embed-result',
            id,
            vector: [],
          }
          self.postMessage(response)
          return
        }

        const vector = await generateEmbedding(text)
        const response: EmbedResponse = {
          type: 'embed-result',
          id,
          vector,
        }
        self.postMessage(response)
        break
      }
    }
  } catch (error) {
    const response: ErrorResponse = {
      type: 'error',
      id: 'id' in data ? data.id : undefined,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
    self.postMessage(response)
  }
}

// Export types for use in main thread
export type { WorkerRequest, WorkerResponse, EmbedRequest, EmbedResponse, InitResponse, ProgressResponse, ErrorResponse }
