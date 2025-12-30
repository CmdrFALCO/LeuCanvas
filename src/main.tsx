import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { del } from 'idb-keyval'
import './index.css'
import App from './App.tsx'

// Clear corrupted data on startup or if ?reset is in URL
async function init() {
  const shouldReset = window.location.search.includes('reset')

  if (shouldReset) {
    console.log('Resetting all stored data...')
    try {
      await del('semanticanvas-snapshot')
      await del('semanticanvas-vector-index')
      // Remove the reset parameter from URL
      window.history.replaceState({}, '', window.location.pathname)
    } catch (e) {
      console.error('Failed to reset data:', e)
    }
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

init()
