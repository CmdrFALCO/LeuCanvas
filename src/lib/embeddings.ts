// Worker response types (defined here to avoid importing from worker file)
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

// Embedding request with promise handlers
interface QueuedRequest {
  id: string
  text: string
  resolve: (vector: Float32Array) => void
  reject: (error: Error) => void
}

// Progress callback type
type ProgressCallback = (status: string, progress: number) => void

// Singleton class for managing the embedding pipeline
class EmbeddingPipeline {
  private worker: Worker | null = null
  private isInitialized = false
  private isInitializing = false
  private initPromise: Promise<void> | null = null
  private queue: QueuedRequest[] = []
  private pendingRequests = new Map<string, QueuedRequest>()
  private progressCallback: ProgressCallback | null = null

  // Set progress callback for model loading
  setProgressCallback(callback: ProgressCallback | null) {
    this.progressCallback = callback
  }

  // Initialize the worker and load the model
  async initialize(): Promise<void> {
    if (this.isInitialized) return
    if (this.initPromise) return this.initPromise

    this.isInitializing = true

    this.initPromise = new Promise((resolve, reject) => {
      // Create worker using Vite's worker import syntax
      this.worker = new Worker(
        new URL('../workers/embedding.worker.ts', import.meta.url),
        { type: 'module' }
      )

      const handleMessage = (event: MessageEvent<WorkerResponse>) => {
        const { data } = event

        switch (data.type) {
          case 'init-complete': {
            const initData = data as InitResponse
            if (initData.success) {
              this.isInitialized = true
              this.isInitializing = false
              resolve()
              // Process any queued requests
              this.processQueue()
            } else {
              this.isInitializing = false
              reject(new Error(initData.error || 'Failed to initialize embedding model'))
            }
            break
          }

          case 'progress': {
            const progressData = data as ProgressResponse
            this.progressCallback?.(progressData.status, progressData.progress)
            break
          }

          case 'embed-result': {
            const embedData = data as EmbedResponse
            const request = this.pendingRequests.get(embedData.id)
            if (request) {
              this.pendingRequests.delete(embedData.id)
              const vector = new Float32Array(embedData.vector)
              request.resolve(vector)
            }
            // Process next in queue
            this.processQueue()
            break
          }

          case 'error': {
            const errorData = data as ErrorResponse
            if (errorData.id) {
              const request = this.pendingRequests.get(errorData.id)
              if (request) {
                this.pendingRequests.delete(errorData.id)
                request.reject(new Error(errorData.error))
              }
            } else {
              // Initialization error
              this.isInitializing = false
              reject(new Error(errorData.error))
            }
            // Process next in queue
            this.processQueue()
            break
          }
        }
      }

      this.worker.addEventListener('message', handleMessage)
      this.worker.addEventListener('error', (error) => {
        this.isInitializing = false
        reject(new Error(`Worker error: ${error.message}`))
      })

      // Send init message
      this.worker.postMessage({ type: 'init' })
    })

    return this.initPromise
  }

  // Process the next request in the queue
  private processQueue() {
    // Only process one at a time to avoid overwhelming the worker
    if (this.pendingRequests.size > 0) return
    if (this.queue.length === 0) return
    if (!this.isInitialized || !this.worker) return

    const request = this.queue.shift()!
    this.pendingRequests.set(request.id, request)

    this.worker.postMessage({
      type: 'embed',
      id: request.id,
      text: request.text,
    })
  }

  // Generate embedding for text
  async embed(id: string, text: string): Promise<Float32Array> {
    // Ensure initialized
    if (!this.isInitialized) {
      await this.initialize()
    }

    // Handle empty text
    if (!text || text.trim().length === 0) {
      return new Float32Array(0)
    }

    return new Promise((resolve, reject) => {
      const request: QueuedRequest = { id, text, resolve, reject }
      this.queue.push(request)
      this.processQueue()
    })
  }

  // Check if the pipeline is ready
  isReady(): boolean {
    return this.isInitialized
  }

  // Check if the pipeline is loading
  isLoading(): boolean {
    return this.isInitializing
  }

  // Terminate the worker
  terminate() {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
    this.isInitialized = false
    this.isInitializing = false
    this.initPromise = null
    this.queue = []
    this.pendingRequests.clear()
  }
}

// Singleton instance
export const embeddingPipeline = new EmbeddingPipeline()

// Convenience function
export async function embedText(id: string, text: string): Promise<Float32Array> {
  return embeddingPipeline.embed(id, text)
}
