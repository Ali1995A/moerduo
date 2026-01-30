import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && Boolean((window as any).__TAURI__)
}

async function bootstrap() {
  const App = isTauriRuntime()
    ? (await import('./App')).default
    : (await import('./web/AppWeb')).default

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

bootstrap()
