import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'

// Debug: log when script loads
console.log('[claude-rpg] main.tsx loaded')

// Global error handler
window.onerror = (msg, url, line, col, error) => {
  console.error('[claude-rpg] Global error:', { msg, url, line, col, error })
  document.body.innerHTML = `<pre style="color:red;padding:20px">Error: ${msg}\n${url}:${line}:${col}\n${error?.stack || ''}</pre>`
}

// Unhandled promise rejection handler
window.onunhandledrejection = (event) => {
  console.error('[claude-rpg] Unhandled rejection:', event.reason)
}

// Error boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[claude-rpg] React error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <pre style={{ color: 'red', padding: 20 }}>
          React Error: {this.state.error?.message}
          {'\n'}
          {this.state.error?.stack}
        </pre>
      )
    }
    return this.props.children
  }
}

console.log('[claude-rpg] Creating root')
const root = ReactDOM.createRoot(document.getElementById('root')!)

console.log('[claude-rpg] Rendering app')
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)

console.log('[claude-rpg] Render called')
