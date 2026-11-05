import { lazy, Suspense, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { initMitra } from './lib/mitra-auth'
import LoginPage from './pages/LoginPage'
import Layout from './components/Layout'
import { SkeletonPage } from './components/ui/Skeleton'

const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const LancamentosPage = lazy(() => import('./pages/LancamentosPage'))
const LancamentoDetalhePage = lazy(() => import('./pages/LancamentoDetalhePage'))
const CaixaEntradaPage = lazy(() => import('./pages/CaixaEntradaPage'))
const ConferenciaNfePage = lazy(() => import('./pages/ConferenciaNfePage'))
const PilotoConferenciaPage = lazy(() => import('./pages/PilotoConferenciaPage'))
const AprovacoesPage = lazy(() => import('./pages/AprovacoesPage'))
const ConfiguracaoPage = lazy(() => import('./pages/ConfiguracaoPage'))
const AssistentePage = lazy(() => import('./pages/AssistentePage'))
const PlaygroundListaPage = lazy(() => import('./pages/PlaygroundListaPage'))
const PlaygroundEstudoPage = lazy(() => import('./pages/PlaygroundEstudoPage'))
const EstudoPublicoPage = lazy(() => import('./pages/EstudoPublicoPage'))
const AjudaPage = lazy(() => import('./pages/AjudaPage'))

function App() {
  const [configured, setConfigured] = useState(initMitra)

  return (
    <Suspense fallback={<div className="p-4 md:p-8"><SkeletonPage /></div>}>
      <Routes>
        <Route path="/login" element={<LoginPage onLogin={() => setConfigured(true)} />} />
        <Route path="/estudo/:token" element={<EstudoPublicoPage />} />
        <Route element={configured ? <Layout /> : <Navigate to="/login" replace />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/lancamentos" element={<LancamentosPage />} />
          <Route path="/lancamentos/:id" element={<LancamentoDetalhePage />} />
          <Route path="/caixa-entrada" element={<CaixaEntradaPage />} />
          <Route path="/conferencia-nfe" element={<ConferenciaNfePage />} />
          <Route path="/piloto-conferencia" element={<PilotoConferenciaPage />} />
          <Route path="/aprovacoes" element={<AprovacoesPage />} />
          <Route path="/configuracao" element={<ConfiguracaoPage />} />
          <Route path="/assistente" element={<AssistentePage />} />
          <Route path="/playground" element={<PlaygroundListaPage />} />
          <Route path="/playground/:id" element={<PlaygroundEstudoPage />} />
          <Route path="/ajuda" element={<AjudaPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
