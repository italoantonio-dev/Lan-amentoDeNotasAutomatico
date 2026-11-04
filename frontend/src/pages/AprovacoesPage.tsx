import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, CheckSquare, X } from 'lucide-react';
import { callSF, execSF, SF, umaLinha } from '../lib/api';
import { formatarCnpj, formatarData, formatarMoeda } from '../lib/formato';
import { getMitraErrorMessage } from '../lib/utils';
import { useToast } from '../hooks/useToast';
import { Card } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import Tooltip from '../components/ui/Tooltip';
import { SkeletonTable } from '../components/ui/Skeleton';
import { ToastContainer } from '../components/ui/Toast';
import { Aviso, CabecalhoPagina, EstadoErro, EstadoVazio, Paginacao } from '../components/Comum';

type Linha = Record<string, any>;
const POR_PAGINA = 30;

export default function AprovacoesPage() {
  const nav = useNavigate();
  const { toasts, addToast, removeToast } = useToast();
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(0);
  const [alcada, setAlcada] = useState<Linha | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [rejeitar, setRejeitar] = useState<Linha | null>(null);
  const [motivo, setMotivo] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const [l, a] = await Promise.all([callSF(SF.listarPendentesAprovacao, { limite: POR_PAGINA, offset: pagina * POR_PAGINA }), umaLinha(SF.minhaAlcada)]);
      setLinhas(l);
      setTotal(Number(l[0]?.TOTAL_GERAL ?? 0));
      setAlcada(a);
    } catch (e) {
      setErro(getMitraErrorMessage(e));
    } finally {
      setCarregando(false);
    }
  }, [pagina]);
  useEffect(() => { carregar(); }, [carregar]);

  async function decidir(l: Linha, acao: 'APROVAR' | 'REJEITAR', m = '') {
    setOcupado(l.ID);
    try {
      const r = await execSF<{ ok: boolean; erro?: string }>(SF.aplicarDecisaoAprovacao, { lancamentoId: l.ID, acao, motivo: m });
      if (!r.ok) addToast('error', r.erro ?? 'Não consegui aplicar a decisão.');
      else addToast('success', acao === 'APROVAR' ? `Lançamento ${l.ID} aprovado.` : `Lançamento ${l.ID} rejeitado.`);
      setRejeitar(null);
      setMotivo('');
      await carregar();
    } catch (e) {
      addToast('error', getMitraErrorMessage(e));
    } finally {
      setOcupado(null);
    }
  }

  const semAprovador = alcada && Number(alcada.TOTAL_APROVADORES) === 0;
  const descricaoAlcada = !alcada ? '' : semAprovador ? 'Sem aprovador cadastrado: a alçada ainda não vale.' : !Number(alcada.SOU_APROVADOR) ? 'Você não está cadastrado como aprovador.' : Number(alcada.SEM_TETO) ? 'Você aprova qualquer valor.' : `Você aprova até ${formatarMoeda(alcada.LIMITE)}.`;

  return (
    <div className="p-4 md:p-8">
      <CabecalhoPagina titulo="Aprovações" descricao={descricaoAlcada || 'Decisões que dependem de uma pessoa.'} />
      {semAprovador && (
        <Aviso tipo="warning" acao={<Button size="sm" variant="secondary" onClick={() => nav('/configuracao?aba=aprovadores')}>Cadastrar aprovadores</Button>}>
          Enquanto não houver aprovador cadastrado, qualquer usuário logado decide qualquer valor. Cadastre em Configuração → Aprovadores para a alçada valer.
        </Aviso>
      )}
      <Card>
        {erro ? (
          <EstadoErro mensagem={erro} onRetry={carregar} />
        ) : carregando ? (
          <SkeletonTable />
        ) : linhas.length === 0 ? (
          <EstadoVazio icone={<CheckSquare size={20} />} titulo="Nada aguardando aprovação" descricao="Quando um valor passar do limite do parâmetro, ele aparece aqui." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="tabela">
                <thead><tr><th>Fornecedor</th><th>Tipo</th><th>Empresa</th><th>Natureza</th><th>Vencimento</th><th className="text-right">Valor</th><th className="text-right">Decisão</th></tr></thead>
                <tbody>
                  {linhas.map((l) => {
                    const pode = Number(l.PODE_APROVAR) === 1;
                    const botoes = (
                      <span className="inline-flex gap-1.5">
                        <Button size="sm" disabled={!pode || ocupado === l.ID} onClick={(e) => { e.stopPropagation(); decidir(l, 'APROVAR'); }}><Check size={16} /> Aprovar</Button>
                        <Button size="sm" variant="secondary" disabled={!pode || ocupado === l.ID} onClick={(e) => { e.stopPropagation(); setRejeitar(l); }}><X size={16} /> Rejeitar</Button>
                      </span>
                    );
                    return (
                      <tr key={l.ID} className="cursor-pointer" onClick={() => nav(`/lancamentos/${l.ID}`)}>
                        <td>
                          <div className="font-medium text-fg">{l.NOME_FORNECEDOR || '—'}</div>
                          <div className="text-[12px] text-fg-muted tabular-nums">{formatarCnpj(l.CNPJ_FORNECEDOR)}</div>
                        </td>
                        <td>{l.TIPO_DESC}</td>
                        <td>{l.EMPRESA}</td>
                        <td>{l.NATUREZA_DESC || '—'}</td>
                        <td className="tabular-nums">{formatarData(l.DATA_VENCIMENTO)}</td>
                        <td className="text-right tabular-nums font-medium">{formatarMoeda(l.VALOR_TOTAL)}</td>
                        <td className="text-right whitespace-nowrap">
                          {pode ? botoes : <Tooltip content="O valor passa da sua alçada, ou você não está cadastrado como aprovador.">{botoes}</Tooltip>}
                          {!pode && <div className="text-[12px] text-fg-muted mt-1">Acima da sua alçada</div>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Paginacao pagina={pagina} total={total} porPagina={POR_PAGINA} onMudar={setPagina} />
          </>
        )}
      </Card>

      <Modal isOpen={Boolean(rejeitar)} onClose={() => setRejeitar(null)} title={`Rejeitar lançamento ${rejeitar?.ID ?? ''}`} size="sm">
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-fg-muted">{rejeitar?.NOME_FORNECEDOR} · {formatarMoeda(rejeitar?.VALOR_TOTAL)}</p>
          <Input label="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Por que este lançamento não segue?" />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRejeitar(null)}>Cancelar</Button>
            <Button variant="danger" disabled={!motivo.trim() || ocupado !== null} onClick={() => rejeitar && decidir(rejeitar, 'REJEITAR', motivo)}>Rejeitar</Button>
          </div>
        </div>
      </Modal>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
