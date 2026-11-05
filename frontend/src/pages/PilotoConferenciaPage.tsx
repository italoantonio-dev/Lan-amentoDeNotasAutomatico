import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import { ClipboardCheck, FileUp } from 'lucide-react';
import { execSF, SF } from '../lib/api';
import { getMitraErrorMessage } from '../lib/utils';
import { Card } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Select from '../components/ui/Select';
import MultiSelect from '../components/ui/MultiSelect';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import { SkeletonTable } from '../components/ui/Skeleton';
import { Aviso, CabecalhoPagina, EstadoVazio, EstadoErro } from '../components/Comum';
import ConferenciaPedidos from '../components/ConferenciaPedidos';
import { formatarMoeda } from '../lib/formato';

type Resultado = ComponentProps<typeof ConferenciaPedidos>['resultado'];
interface Registro {
  ID: number; CHAVE_NFE: string | null; NUMERO: string; SERIE: string; CNPJ_EMITENTE: string; NOME_EMITENTE: string; VALOR_TOTAL: number;
  RECEBIDO_EM: string; STATUS: string; ERRO_CONSULTA: string | null; CODEMP: string | null; CODPARC: string | null; CLASSIFICACAO: string | null;
  PEDIDOS_CANDIDATOS: string | null; PEDIDO_SUGERIDO: string | null; DIVERGENCIAS: string | null; RESULTADO: string | null;
  PEDIDOS_CONFERIDOS: string | null; MOTIVO: string | null; CONFERIDO_EM: string | null; REGISTRADO_POR: string | null; CONFERIDO_POR: string | null;
}
interface Situacao { PODE: number; TOTAL: number; AGUARDANDO: number; CONFERIDOS: number; ERROS: number }

const CLASSES: Record<string, { rotulo: string; variante: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  SEGURA: { rotulo: 'Segura', variante: 'success' }, AMBIGUA: { rotulo: 'Ambígua', variante: 'warning' },
  INCOMPATIVEL: { rotulo: 'Incompatível', variante: 'danger' }, SEM_PEDIDO: { rotulo: 'Sem pedido', variante: 'neutral' },
};
const RESULTADOS = [
  { value: 'CONFIRMOU_SUGESTAO', label: 'Confirmo o pedido sugerido' },
  { value: 'ESCOLHEU_PEDIDO', label: 'Escolhi entre os candidatos' },
  { value: 'CORRIGIU_PEDIDO', label: 'O pedido certo é outro' },
  { value: 'SEM_PEDIDO', label: 'Não há pedido para esta nota' },
  { value: 'REJEITOU_DOCUMENTO', label: 'Documento rejeitado' },
];
const rotuloResultado = (v: string | null) => RESULTADOS.find((r) => r.value === v)?.label ?? '—';
const LIMITE = 20;

// Piloto assistido: o XML e conferido so lendo o ERP e a previsao fica guardada antes da conferencia.
export default function PilotoConferenciaPage() {
  const arquivo = useRef<HTMLInputElement>(null);
  const [linhas, setLinhas] = useState<Registro[]>([]);
  const [sit, setSit] = useState<Situacao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [aberto, setAberto] = useState<{ reg: Registro; previsao: { origem?: string; resultado: Resultado } | null } | null>(null);
  const [resultado, setResultado] = useState('');
  const [pedidos, setPedidos] = useState<string[]>([]);
  const [outroPedido, setOutroPedido] = useState('');
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const [s, l] = await Promise.all([
        execSF<{ rows: Situacao[] }>(SF.pilotoSituacao, {}),
        execSF<{ rows: Registro[] }>(SF.pilotoListar, { status: '', limite: LIMITE, offset: 0 }),
      ]);
      setSit(s.rows?.[0] ?? null);
      setLinhas(l.rows ?? []);
    } catch (e) {
      setErro(getMitraErrorMessage(e));
    } finally {
      setCarregando(false);
    }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  async function enviar(f: File) {
    setEnviando(true);
    setAviso('');
    try {
      if (!/\.xml$/i.test(f.name)) throw new Error('O piloto precisa do XML da NF-e.');
      if (f.size > 3 * 1024 * 1024) throw new Error('Arquivo acima de 3 MB.');
      const buffer = new Uint8Array(await f.arrayBuffer());
      let bin = '';
      for (let i = 0; i < buffer.length; i += 0x8000) bin += String.fromCharCode(...buffer.subarray(i, i + 0x8000));
      const r = await execSF<{ ok: boolean; erro?: string; mensagem?: string; repetido?: boolean }>(SF.pilotoRegistrarDocumento, { nome: f.name, conteudoB64: btoa(bin) });
      setAviso(r.ok ? (r.mensagem ?? 'Documento registrado no piloto, com a previsão do motor guardada.') : (r.erro ?? 'Não consegui registrar.'));
      await carregar();
    } catch (e) {
      setAviso(getMitraErrorMessage(e));
    } finally {
      setEnviando(false);
    }
  }

  async function abrir(reg: Registro) {
    try {
      const r = await execSF<{ rows: (Registro & { PREVISAO_JSON: string | null })[] }>(SF.pilotoObter, { id: reg.ID });
      const d = r.rows?.[0];
      setAberto({ reg, previsao: d?.PREVISAO_JSON ? JSON.parse(d.PREVISAO_JSON) : null });
      setResultado(''); setPedidos([]); setOutroPedido(''); setMotivo('');
    } catch (e) {
      setAviso(getMitraErrorMessage(e));
    }
  }

  async function salvar() {
    if (!aberto) return;
    setSalvando(true);
    try {
      const lista = resultado === 'CORRIGIU_PEDIDO' ? outroPedido.replace(/[^\d,]/g, '') : resultado === 'CONFIRMOU_SUGESTAO' ? (aberto.reg.PEDIDO_SUGERIDO ?? '') : pedidos.join(',');
      const r = await execSF<{ affectedRows: number }>(SF.pilotoRegistrarConferencia, { id: aberto.reg.ID, resultado, pedidos: lista, motivo: motivo.trim() });
      if (Number(r.affectedRows) !== 1) throw new Error('A conferência não foi gravada: confira o resultado, o pedido e o motivo, ou se o documento já foi conferido.');
      setAberto(null);
      await carregar();
    } catch (e) {
      setAviso(getMitraErrorMessage(e));
    } finally {
      setSalvando(false);
    }
  }

  const candidatos = (aberto?.reg.PEDIDOS_CANDIDATOS ?? '').split(',').filter(Boolean).map((p) => ({ value: p, label: `Pedido ${p}` }));
  const opcoes = RESULTADOS.filter((r) => r.value !== 'CONFIRMOU_SUGESTAO' || aberto?.reg.CLASSIFICACAO === 'SEGURA').filter((r) => r.value !== 'ESCOLHEU_PEDIDO' || candidatos.length > 0);
  const precisaMotivo = resultado !== '' && resultado !== 'CONFIRMOU_SUGESTAO';
  const podeSalvar = resultado !== '' && (!precisaMotivo || motivo.trim() !== '') && (resultado !== 'ESCOLHEU_PEDIDO' || pedidos.length > 0) && (resultado !== 'CORRIGIU_PEDIDO' || outroPedido.trim() !== '');
  const encerrado = Boolean(sit && Number(sit.TOTAL) >= LIMITE);

  return (
    <div className="p-4 md:p-8 flex flex-col gap-5">
      <CabecalhoPagina
        titulo="Piloto de conferência"
        descricao={`Até ${LIMITE} NF-e novas ou cinco dias úteis. Só leitura no Sankhya: a previsão do motor fica guardada antes da sua conferência.`}
        acoes={<Button disabled={enviando || encerrado || sit?.PODE === 0} onClick={() => arquivo.current?.click()}><FileUp size={16} /> {enviando ? 'Conferindo...' : 'Adicionar XML'}</Button>}
      />
      <input ref={arquivo} type="file" accept=".xml" className="hidden" onChange={(e) => { const a = e.target.files?.[0]; if (a) enviar(a); e.target.value = ''; }} />
      {sit?.PODE === 0 && <Aviso tipo="warning">O piloto é restrito ao perfil Administrador.</Aviso>}
      {aviso && <Aviso tipo="info">{aviso}</Aviso>}
      {sit && (
        <div className="flex flex-wrap gap-2">
          <Badge variant="neutral">{sit.TOTAL} de {LIMITE} documentos</Badge>
          <Badge variant="warning">{sit.AGUARDANDO} aguardando conferência</Badge>
          <Badge variant="success">{sit.CONFERIDOS} conferidos</Badge>
          {Number(sit.ERROS) > 0 && <Badge variant="danger">{sit.ERROS} com falha de consulta</Badge>}
        </div>
      )}
      {erro && <EstadoErro mensagem={erro} onRetry={carregar} />}
      {carregando && <SkeletonTable />}
      {!carregando && !erro && linhas.length === 0 && (
        <Card><EstadoVazio icone={<ClipboardCheck size={20} />} titulo="Nenhum documento no piloto" descricao="Adicione o XML de uma NF-e nova de revenda de peças (TOP 1419/1420)." /></Card>
      )}
      {!carregando && linhas.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="tabela">
              <thead><tr><th>#</th><th>Nota</th><th>Fornecedor</th><th>Empresa</th><th>Recebida</th><th>Previsão</th><th>Candidatos</th><th className="text-right">Valor</th><th>Conferência</th><th /></tr></thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.ID}>
                    <td className="tabular-nums">{l.ID}</td>
                    <td className="tabular-nums whitespace-nowrap">{l.NUMERO}{l.SERIE ? `/${l.SERIE}` : ''}</td>
                    <td className="min-w-[160px]">{l.NOME_EMITENTE}<div className="text-[12px] text-fg-subtle tabular-nums">{l.CNPJ_EMITENTE}{l.CODPARC ? ` · parceiro ${l.CODPARC}` : ''}</div></td>
                    <td className="tabular-nums">{l.CODEMP ?? '—'}</td>
                    <td className="tabular-nums whitespace-nowrap">{l.RECEBIDO_EM.replace('T', ' ').slice(0, 16)}</td>
                    <td>{l.STATUS === 'ERRO_CONSULTA' ? <Badge variant="danger">Falha na consulta</Badge> : <Badge variant={CLASSES[l.CLASSIFICACAO ?? '']?.variante ?? 'neutral'}>{CLASSES[l.CLASSIFICACAO ?? '']?.rotulo ?? '—'}</Badge>}</td>
                    <td className="tabular-nums">{l.PEDIDOS_CANDIDATOS ?? '—'}</td>
                    <td className="text-right tabular-nums">{formatarMoeda(Number(l.VALOR_TOTAL))}</td>
                    <td className="min-w-[160px]">{l.RESULTADO ? <>{rotuloResultado(l.RESULTADO)}<div className="text-[12px] text-fg-subtle">{l.CONFERIDO_POR} · {l.CONFERIDO_EM?.replace('T', ' ').slice(0, 16)}</div></> : <span className="text-[12px] text-fg-subtle">{l.STATUS === 'ERRO_CONSULTA' ? 'Sem conclusão' : 'Pendente'}</span>}</td>
                    <td><Button size="sm" variant="secondary" onClick={() => abrir(l)}>{l.STATUS === 'AGUARDANDO_CONFERENCIA' ? 'Conferir' : 'Ver'}</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <Modal isOpen={Boolean(aberto)} onClose={() => setAberto(null)} title={aberto ? `Documento ${aberto.reg.ID} · nota ${aberto.reg.NUMERO}` : ''} size="xl">
        {aberto && (
          <div className="flex flex-col gap-5">
            {aberto.reg.STATUS === 'ERRO_CONSULTA' && <Aviso tipo="danger">A consulta ao Sankhya falhou e nada foi concluído: {aberto.reg.ERRO_CONSULTA}</Aviso>}
            {aberto.previsao && <ConferenciaPedidos resultado={aberto.previsao.resultado} origem={`previsão guardada em ${aberto.reg.RECEBIDO_EM.replace('T', ' ')}`} />}
            {aberto.reg.STATUS === 'AGUARDANDO_CONFERENCIA' && (
              <div className="cartao p-5 flex flex-col gap-4">
                <h3 className="text-[14px] font-medium text-fg">Sua conferência</h3>
                <p className="text-[12.5px] text-fg-muted">Grava uma vez e não altera a previsão. Escolher um pedido numa nota ambígua ou incompatível não a torna correta: o motor é medido pelo que previu.</p>
                <Select label="Resultado" options={opcoes} value={resultado} onChange={setResultado} />
                {resultado === 'ESCOLHEU_PEDIDO' && <MultiSelect label="Pedidos" options={candidatos} values={pedidos} onChange={setPedidos} emptyMeansAll={false} placeholder="Escolha os pedidos" />}
                {resultado === 'CORRIGIU_PEDIDO' && <Input label="Número único (NUNOTA) do pedido certo" value={outroPedido} onChange={(e) => setOutroPedido(e.target.value)} placeholder="Ex.: 123456, 123457" />}
                {precisaMotivo && <Input label="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Por que corrigiu, escolheu ou rejeitou" />}
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setAberto(null)}>Cancelar</Button>
                  <Button disabled={!podeSalvar || salvando} onClick={salvar}>{salvando ? 'Gravando...' : 'Registrar conferência'}</Button>
                </div>
              </div>
            )}
            {aberto.reg.RESULTADO && <Aviso tipo="info">Conferido por {aberto.reg.CONFERIDO_POR} em {aberto.reg.CONFERIDO_EM?.replace('T', ' ')}: {rotuloResultado(aberto.reg.RESULTADO)}{aberto.reg.PEDIDOS_CONFERIDOS ? ` (pedido ${aberto.reg.PEDIDOS_CONFERIDOS})` : ''}{aberto.reg.MOTIVO ? `. Motivo: ${aberto.reg.MOTIVO}` : ''}</Aviso>}
          </div>
        )}
      </Modal>
    </div>
  );
}
