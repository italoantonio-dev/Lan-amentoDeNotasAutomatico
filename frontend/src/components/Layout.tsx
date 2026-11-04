import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Bot, CheckSquare, FileText, FlaskConical, HelpCircle, Inbox, LayoutDashboard, Menu, Settings, X } from 'lucide-react';
import Robo from './Robo';
import { useContagem } from '../hooks/useContagem';
import { usePermissoes } from '../lib/permissoes';

const ENTRADAS = [
  { para: '/', rotulo: 'Painel', icone: LayoutDashboard },
  { para: '/lancamentos', rotulo: 'Lançamentos', icone: FileText },
  { para: '/caixa-entrada', rotulo: 'Caixa de entrada', icone: Inbox },
  { para: '/aprovacoes', rotulo: 'Aprovações', icone: CheckSquare },
  { para: '/assistente', rotulo: 'Assistente', icone: Bot },
  { para: '/playground', rotulo: 'Playground', icone: FlaskConical },
  { para: '/configuracao', rotulo: 'Configuração', icone: Settings, soAdmin: true },
  { para: '/ajuda', rotulo: 'Ajuda', icone: HelpCircle },
];

export default function Layout() {
  const { pathname } = useLocation();
  const [aberto, setAberto] = useState(false);
  const pendentes = useContagem();
  const perm = usePermissoes();
  const ativo = (para: string) => (para === '/' ? pathname === '/' : pathname === para || pathname.startsWith(`${para}/`));
  // Quem decide e a SF. Enquanto nao ha resposta o item fica visivel: some so depois do "nao".
  const entradas = ENTRADAS.filter((e) => !e.soAdmin || perm.carregando || perm.administrador);

  const navegacao = (
    <nav className="flex flex-col gap-0.5 p-3 flex-1 overflow-y-auto" aria-label="Navegação principal">
      {entradas.map((e) => (
        <Link key={e.para} to={e.para} onClick={() => setAberto(false)} className="nav-item" data-active={ativo(e.para)}>
          <e.icone size={16} />
          <span className="flex-1">{e.rotulo}</span>
          {e.para === '/aprovacoes' && pendentes > 0 && <span className="pilula pilula-acento tabular-nums">{pendentes}</span>}
        </Link>
      ))}
    </nav>
  );
  const marca = (
    <div className="flex items-center gap-2 h-14 px-4 border-b border-border">
      <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--accent-fg)' }}><FileText size={16} /></span>
      <span className="font-semibold text-[15px] text-fg">Mitra</span>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-bg">
      <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r border-border sticky top-0 h-screen" style={{ backgroundColor: 'var(--color-nav)' }}>
        {marca}
        {navegacao}
      </aside>

      {aberto && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <button className="absolute inset-0" style={{ background: 'var(--bg-overlay)' }} aria-label="Fechar menu" onClick={() => setAberto(false)} />
          <aside className="relative flex flex-col w-64 h-full border-r border-border animate-slideInLeft" style={{ backgroundColor: 'var(--color-nav)' }}>
            {marca}
            {navegacao}
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="lg:hidden flex items-center gap-2 h-14 px-4 border-b border-border sticky top-0 z-30" style={{ backgroundColor: 'var(--color-nav)' }}>
          <button onClick={() => setAberto((a) => !a)} aria-label="Abrir menu" className="p-2 -ml-2 rounded-lg text-fg-muted hover:bg-surface-hover">
            {aberto ? <X size={20} /> : <Menu size={20} />}
          </button>
          <span className="font-semibold text-[15px] text-fg">Mitra</span>
        </header>
        <main key={pathname} className="flex-1 min-w-0 pagina-entra">
          <Outlet />
        </main>
      </div>

      {!pathname.startsWith('/assistente') && !pathname.startsWith('/playground/') && (
        <Link to="/assistente" aria-label="Abrir o assistente" className="fixed bottom-5 right-5 z-30 w-12 h-12 rounded-full flex items-center justify-center border border-border bg-surface transition-transform hover:scale-105" style={{ boxShadow: 'var(--shadow-lg)' }}>
          <Robo tamanho={30} />
        </Link>
      )}
    </div>
  );
}
