import { CONFIG } from './constants'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMConfig {
  apiKey: string
  model?: string
  maxTokens?: number
  temperature?: number
  baseUrl?: string  // For custom endpoints
}

export interface LLMResponse {
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

// Get API key from localStorage
export function getStoredApiKey(): string | null {
  try {
    return localStorage.getItem(CONFIG.LLM_API_KEY_STORAGE)
  } catch {
    return null
  }
}

// Store API key in localStorage
export function setStoredApiKey(apiKey: string): void {
  try {
    localStorage.setItem(CONFIG.LLM_API_KEY_STORAGE, apiKey)
  } catch (error) {
    console.error('Failed to store API key:', error)
  }
}

// Remove API key from localStorage
export function removeStoredApiKey(): void {
  try {
    localStorage.removeItem(CONFIG.LLM_API_KEY_STORAGE)
  } catch (error) {
    console.error('Failed to remove API key:', error)
  }
}

// Call LLM API (OpenAI-compatible)
export async function callLLM(
  messages: ChatMessage[],
  config: LLMConfig
): Promise<LLMResponse> {
  const {
    apiKey,
    model = CONFIG.LLM_DEFAULT_MODEL,
    maxTokens = CONFIG.LLM_DEFAULT_MAX_TOKENS,
    temperature = CONFIG.LLM_DEFAULT_TEMPERATURE,
    baseUrl = 'https://api.openai.com/v1',
  } = config

  if (!apiKey) {
    throw new Error('API key is required')
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const errorMessage = errorData.error?.message || `API error: ${response.status}`
    throw new Error(errorMessage)
  }

  const data = await response.json()

  return {
    content: data.choices[0]?.message?.content || '',
    usage: data.usage ? {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    } : undefined,
  }
}

// Streaming version for better UX
export async function* streamLLM(
  messages: ChatMessage[],
  config: LLMConfig
): AsyncGenerator<string, void, unknown> {
  const {
    apiKey,
    model = CONFIG.LLM_DEFAULT_MODEL,
    maxTokens = CONFIG.LLM_DEFAULT_MAX_TOKENS,
    temperature = CONFIG.LLM_DEFAULT_TEMPERATURE,
    baseUrl = 'https://api.openai.com/v1',
  } = config

  if (!apiKey) {
    throw new Error('API key is required')
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
      stream: true,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const errorMessage = errorData.error?.message || `API error: ${response.status}`
    throw new Error(errorMessage)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('Response body is not readable')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed === 'data: [DONE]') continue
        if (!trimmed.startsWith('data: ')) continue

        try {
          const json = JSON.parse(trimmed.slice(6))
          const content = json.choices[0]?.delta?.content
          if (content) {
            yield content
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
