import { useEffect, useRef, useState } from 'react';
import { getAgentTaskMitra } from 'mitra-interactions-sdk';
import { ChevronDown, Send } from 'lucide-react';
import { PROJECT_ID } from '../lib/api';
import { agenteDisponivel, lerConfigIA } from '../lib/configIA';
import { GUIA, textoDoGuia } from '../lib/guiaAjuda';
import { getMitraErrorMessage } from '../lib/utils';
import { Card } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Robo from '../components/Robo';
import TextoRobo from '../components/TextoRobo';
import { Aviso, CabecalhoPagina } from '../components/Comum';

interface Fala { autor: 'USUARIO' | 'ROBO'; texto: string }

// Sem ferramenta nenhuma: a pergunta aqui e "como funciona", nao "faca por mim".
export default function AjudaPage() {
  const [aberta, setAberta] = useState(0);
  const [falas, setFalas] = useState<Fala[]>([]);
  const [texto, setTexto] = useState('');
  const [rascunho, setRascunho] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const sessao = useRef<ReturnType<typeof getAgentTaskMitra> | null>(null);
  const acumulado = useRef('');
  const fim = useRef<HTMLDivElement>(null);
  const disponivel = agenteDisponivel();

  useEffect(() => { fim.current?.scrollIntoView({ block: 'end' }); }, [falas, rascunho]);
  useEffect(() => () => { sessao.current?.close(); }, []);

  async function perguntar() {
    const pergunta = texto.trim();
    if (!pergunta || ocupado) return;
    setTexto('');
    setErro('');
    setFalas((f) => [...f, { autor: 'USUARIO', texto: pergunta }]);
    setOcupado(true);
    acumulado.current = '';
    try {
      let prompt = pergunta;
      if (!sessao.current) {
        const cfg = await lerConfigIA();
        const s = getAgentTaskMitra({ create: true, projectId: PROJECT_ID, ...(cfg.connectionId ? { connectionId: cfg.connectionId } : {}), ...(cfg.modelo ? { modelId: cfg.modelo } : {}) });
        s.on('delta', (ev) => { if (ev.kind === 'text') { acumulado.current += ev.delta; setRascunho(acumulado.current); } });
        s.on('turnEnd', (ev) => { setFalas((f) => [...f, { autor: 'ROBO', texto: ev.content || acumulado.current }]); setRascunho(''); setOcupado(false); });
        s.on('error', (ev) => { setErro(typeof ev.error === 'string' ? ev.error : getMitraErrorMessage(ev.error)); setRascunho(''); setOcupado(false); });
        sessao.current = s;
        prompt = `Você tira dúvidas sobre este sistema de contas a pagar. Responda em português, curto, usando SOMENTE o guia abaixo. Se a resposta não estiver no guia, diga que o guia não cobre isso; não invente. Você não consulta nem altera dados.\n\nGUIA\n${textoDoGuia()}\n\nPergunta: ${pergunta}`;
      }
      sessao.current.send(prompt);
    } catch (e) {
      setErro(getMitraErrorMessage(e));
      setOcupado(false);
    }
  }

  return (
    <div className="p-4 md:p-8">
      <CabecalhoPagina titulo="Ajuda" descricao="Como o sistema funciona, do documento ao ERP." />
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-5 items-start">
        <div className="flex flex-col gap-2">
          {GUIA.map((s, i) => {
            const on = aberta === i;
            return (
              <Card key={s.titulo}>
                <button className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left" aria-expanded={on} onClick={() => setAberta(on ? -1 : i)}>
                  <span className="text-[14px] font-medium text-fg">{s.titulo}</span>
                  <ChevronDown size={16} className={`text-fg-muted transition-transform ${on ? 'rotate-180' : ''}`} />
                </button>
                {on && (
                  <div className="px-5 pb-5 flex flex-col gap-2 animate-fadeIn">
                    {s.corpo.map((p) => <p key={p} className="text-[13.5px] text-fg-muted leading-relaxed">{p}</p>)}
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        <Card className="xl:sticky xl:top-8">
          <div className="px-5 py-4 border-b border-border-subtle flex items-center gap-2.5">
            <Robo estado={ocupado ? 'pensando' : erro ? 'erro' : 'ocioso'} tamanho={26} />
            <h2 className="text-[14px] font-medium text-fg">Dúvidas</h2>
          </div>
          <div className="px-5 py-4 flex flex-col gap-3 max-h-[50vh] overflow-y-auto conversa-fundo min-h-[180px]">
            {!disponivel && <Aviso tipo="info">A IA só responde na aplicação publicada. O guia ao lado continua inteiro.</Aviso>}
            {erro && <Aviso tipo="danger">{erro}</Aviso>}
            {falas.length === 0 && disponivel && !erro && <p className="text-[13px] text-fg-muted">Pergunte como algo funciona. Respondo com base no guia ao lado.</p>}
            {falas.map((f, i) => (
              <div key={i} className={`rounded-2xl px-3.5 py-2 max-w-[92%] ${f.autor === 'USUARIO' ? 'bolha-usuario self-end text-[13.5px]' : 'bolha-robo self-start'}`}>
                {f.autor === 'USUARIO' ? f.texto : <TextoRobo texto={f.texto} />}
              </div>
            ))}
            {(rascunho || ocupado) && <div className="rounded-2xl px-3.5 py-2 max-w-[92%] bolha-robo self-start">{rascunho ? <TextoRobo texto={rascunho} /> : <span className="text-[13px] text-fg-muted">Pensando...</span>}</div>}
            <div ref={fim} />
          </div>
          <div className="px-5 py-3 border-t border-border-subtle flex gap-2">
            <input className="controle h-10 flex-1" aria-label="Sua dúvida" placeholder="Sua dúvida" disabled={!disponivel} value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') perguntar(); }} />
            <Button aria-label="Perguntar" disabled={!disponivel || !texto.trim() || ocupado} onClick={perguntar}><Send size={16} /></Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
