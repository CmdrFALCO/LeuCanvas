import { useState, useCallback } from 'react'
import { streamLLM, getStoredApiKey } from '../lib/llm'
import { retrieveContext, buildRAGMessages } from '../lib/rag'
import { useVectorIndex } from '../store/useVectorIndex'
import type { SimilarityResult } from '../types'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  context?: SimilarityResult[]  // Retrieved cards for this message
}

interface UseChatReturn {
  messages: ChatMessage[]
  isLoading: boolean
  error: string | null
  sendMessage: (content: string) => Promise<void>
  clearChat: () => void
  hasApiKey: boolean
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const getAllEntries = useVectorIndex((state) => state.getAllEntries)

  const hasApiKey = Boolean(getStoredApiKey())

  const sendMessage = useCallback(async (content: string) => {
    const apiKey = getStoredApiKey()
    if (!apiKey) {
      setError('Please configure your API key in settings')
      return
    }

    if (!content.trim()) return

    setIsLoading(true)
    setError(null)

    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
    }

    setMessages((prev) => [...prev, userMessage])

    try {
      // Retrieve relevant context
      const vectorEntries = getAllEntries()
      const context = await retrieveContext(content, vectorEntries)

      // Update user message with context (for display)
      if (context.cards.length > 0) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === userMessage.id ? { ...msg, context: context.cards } : msg
          )
        )
      }

      // Build messages for LLM
      const chatHistory = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }))

      const llmMessages = buildRAGMessages(content, context, chatHistory)

      // Create placeholder for assistant response
      const assistantId = `assistant-${Date.now()}`
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      }

      setMessages((prev) => [...prev, assistantMessage])

      // Stream response
      let fullContent = ''
      for await (const chunk of streamLLM(llmMessages, { apiKey })) {
        fullContent += chunk
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId ? { ...msg, content: fullContent } : msg
          )
        )
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message'
      setError(errorMessage)

      // Remove the failed assistant message placeholder if it exists
      setMessages((prev) => {
        const lastMsg = prev[prev.length - 1]
        if (lastMsg?.role === 'assistant' && !lastMsg.content) {
          return prev.slice(0, -1)
        }
        return prev
      })
    } finally {
      setIsLoading(false)
    }
  }, [messages, getAllEntries])

  const clearChat = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearChat,
    hasApiKey,
  }
}
