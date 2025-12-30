import { useEffect, useCallback } from 'react'

interface HotkeyHandlers {
  onToggleSearch?: () => void
  onQuickCapture?: () => void  // Stub for Phase 5
}

export function useHotkeys(handlers: HotkeyHandlers) {
  const { onToggleSearch, onQuickCapture } = handlers

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
    const modKey = isMac ? e.metaKey : e.ctrlKey

    // Cmd/Ctrl+K - Toggle search panel
    if (modKey && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      onToggleSearch?.()
      return
    }

    // Cmd/Ctrl+Shift+N - Quick capture (Phase 5 stub)
    if (modKey && e.shiftKey && e.key.toLowerCase() === 'n') {
      e.preventDefault()
      onQuickCapture?.()
      return
    }
  }, [onToggleSearch, onQuickCapture])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])
}
