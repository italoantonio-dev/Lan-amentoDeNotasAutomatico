import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { configureSdkMitra, executePublicServerFunctionMitra } from 'mitra-interactions-sdk';
import { FileText, Lock } from 'lucide-react';
import { SF, PROJECT_ID } from '../lib/api';
import { getMitraErrorMessage } from '../lib/utils';
import { Skeleton } from '../components/ui/Skeleton';
import { EstadoErro } from '../components/Comum';

// Publico: sem login, sem menu e sem token. O desenho roda isolado, sem script.
export default function EstudoPublicoPage() {
  const { token } = useParams();
  const [estudo, setEstudo] = useState<{ nome: string; html: string } | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    configureSdkMitra({ baseURL: import.meta.env.VITE_MITRA_BASE_URL, projectId: PROJECT_ID });
    executePublicServerFunctionMitra({ projectId: PROJECT_ID, serverFunctionId: SF.playground_publico, input: { token: token ?? '' } })
      .then((res) => {
        // A resposta publica nao tem o wrapper .result, e output vem como texto JSON.
        const r = res as { status?: string; output?: unknown; error?: unknown };
        if (r.status === 'FAILED') throw new Error(getMitraErrorMessage(r.error));
        const saida = typeof r.output === 'string' ? JSON.parse(r.output) : r.output;
        if (!saida?.ok) throw new Error(saida?.erro ?? 'Este estudo não está mais compartilhado.');
        setEstudo({ nome: saida.nome, html: saida.html ?? '' });
      })
      .catch((e) => setErro(getMitraErrorMessage(e)));
  }, [token]);

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <header className="h-14 shrink-0 flex items-center gap-3 px-4 border-b border-border bg-surface">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--accent-fg)' }}><FileText size={16} /></span>
        <h1 className="text-[14px] font-medium text-fg truncate flex-1">{estudo?.nome ?? 'Estudo'}</h1>
        <span className="pilula flex items-center gap-1"><Lock size={12} /> Somente leitura</span>
      </header>
      {erro ? <EstadoErro mensagem={erro} /> : !estudo ? (
        <div className="p-8 flex flex-col gap-4"><Skeleton className="h-8 w-1/3" /><Skeleton className="h-64 w-full" /></div>
      ) : (
        <iframe title={estudo.nome} sandbox="" srcDoc={estudo.html} className="flex-1 w-full border-0 bg-surface" />
      )}
    </div>
  );
}
