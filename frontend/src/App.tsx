import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { initMitra } from './lib/mitra-auth'
import LoginPage from './pages/LoginPage'

function App() {
  const [configured, setConfigured] = useState(initMitra)

  return (
    <Routes>
      <Route
        path="/"
        element={
          configured
            ? <div className="p-8 text-center" style={{ color: 'var(--color-text-secondary)' }}>Crie suas páginas em src/pages/</div>
            : <Navigate to="/login" replace />
        }
      />
      <Route path="/login" element={<LoginPage onLogin={() => setConfigured(true)} />} />
    </Routes>
  )
}

export default App
