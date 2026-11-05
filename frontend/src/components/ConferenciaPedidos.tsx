import { useState } from 'react';
import { ChevronDown, ChevronRight, ShieldCheck, UserCheck } from 'lucide-react';
import Badge from './ui/Badge';
import { Aviso } from './Comum';
import { formatarData, formatarMoeda } from '../lib/formato';

type Variante = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface Linha {
  pedido: number; numeroPedido: number | null; sequencia: number; codprod: number; descricao: string;
  negociada: number; entregue: number; pendente: number; quantidadeDocumento: number; saldoAposDocumento: number | null;
  unidadePedido: string; unidadeDocumento: string; precoPedido: number; precoDocumento: number; diferencaPreco: number; diferencaPrecoPct: number | null;
  descontoDocumento?: number; precoLiquidoDocumento?: number; referenciaConfere?: boolean | null;
  divergencias: string[];
}
interface Item {
  nItem: number | null; cProd: string; xProd: string; quantidade: number; unidade: string; valorUnitario: number; situacao: string;
  identificacao: { situacao: string; fonte: string; codprods: number[]; sugestoes: number[] };
  pedidos: number[]; linhas: Linha[]; linhasSugeridas: Linha[]; pendenteEmOutraEmpresa: number[];
  referenciaPedido?: { pedido: string; item: string; confereCom: number[] } | null; descontoDocumento?: number;
}
interface Vinculo { NUNOTA: number; NUMNOTA: number | null; CODTIPOPER: number; STATUSNOTA: string; SEQUENCIAORIG: number; QTDATENDIDA: number }
interface Pedido {
  NUNOTA: number; NUMNOTA: number | null; DTNEG: string; CODEMP: number; STATUSNOTA: string; itensCobertos: number; cobreTodosOsItens: boolean; itensComSaldoSuficiente: number;
  itensComPrecoIgual: number; itensComQuantidadeIgualAoPendente: number; jaFaturadoParcialmente: boolean; vinculos: Vinculo[]; itensPendentesForaDoDocumento: number;
}
interface ResultadoCorrespondencia {
  situacao: string; resumo: string;
  documento: { numero: string; serie: string; dataEmissao: string; valorTotal: number; itens: number; chave?: string; cnpjEmitente?: string; cnpjDestinatario?: string };
  classificacao?: string; justificativa?: string; intervencaoHumana?: { codigo: string; texto: string }[];
  empresas: { CODEMP: number; NOME: string }[]; parceiros: { CODPARC: number; NOME: string }[];
  itens: Item[]; pedidos: Pedido[]; alertas: { tipo: string; mensagem: string }[];
}

const SITUACOES: Record<string, { rotulo: string; variante: Variante }> = {
  PEDIDO_UNICO: { rotulo: 'Pedido único', variante: 'success' },
  MULTIPLOS_PEDIDOS: { rotulo: 'Vários pedidos, sem dúvida', variante: 'success' },
  AMBIGUO: { rotulo: 'Ambíguo: uma pessoa escolhe', variante: 'warning' },
  PARCIAL: { rotulo: 'Parte dos itens sem pedido', variante: 'warning' },
  SEM_PEDIDO: { rotulo: 'Sem pedido', variante: 'danger' },
  PRODUTOS_NAO_IDENTIFICADOS: { rotulo: 'Produtos não identificados', variante: 'warning' },
  SEM_EMPRESA: { rotulo: 'Destinatário sem empresa', variante: 'danger' },
  SEM_FORNECEDOR: { rotulo: 'Fornecedor não encontrado', variante: 'danger' },
  SEM_ITENS: { rotulo: 'Sem itens', variante: 'neutral' },
};
const CLASSES: Record<string, { rotulo: string; variante: Variante }> = {
  SEGURA: { rotulo: 'Correspondência segura', variante: 'success' },
  AMBIGUA: { rotulo: 'Ambígua', variante: 'warning' },
  INCOMPATIVEL: { rotulo: 'Incompatível: exige conferência', variante: 'danger' },
  SEM_PEDIDO: { rotulo: 'Sem pedido', variante: 'neutral' },
};
const ITENS: Record<string, { rotulo: string; variante: Variante }> = {
  PEDIDO_UNICO: { rotulo: 'Um pedido', variante: 'success' },
  AMBIGUO: { rotulo: 'Mais de um pedido', variante: 'warning' },
  SEM_PEDIDO: { rotulo: 'Sem saldo em pedido', variante: 'danger' },
  PRODUTO_NAO_IDENTIFICADO: { rotulo: 'Produto não identificado', variante: 'warning' },
};
const DIVERGENCIAS: Record<string, { rotulo: string; variante: Variante }> = {
  PRECO_DIFERENTE: { rotulo: 'Preço diferente', variante: 'warning' },
  QUANTIDADE_ACIMA_DO_PENDENTE: { rotulo: 'Acima do pendente', variante: 'danger' },
  UNIDADE_DIFERENTE: { rotulo: 'Unidade diferente', variante: 'info' },
};

const qtd = (v: number | null | undefined) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 4 }));
const preco = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 6 });

function TabelaLinhas({ linhas }: { linhas: Linha[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="tabela">
        <thead>
          <tr>
            <th>Pedido</th><th>Produto</th><th className="text-right">Negociada</th><th className="text-right">Entregue</th><th className="text-right">Pendente</th>
            <th className="text-right">Nesta nota</th><th className="text-right">Saldo depois</th><th className="text-right">Preço no pedido</th><th className="text-right">Preço na nota</th><th className="text-right">Diferença</th><th>Divergências</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={`${l.pedido}-${l.sequencia}`}>
              <td className="tabular-nums whitespace-nowrap">{l.pedido} · item {l.sequencia}</td>
              <td className="min-w-[180px]"><span className="tabular-nums">{l.codprod}</span>{l.descricao ? ` · ${l.descricao}` : ''}</td>
              <td className="text-right tabular-nums whitespace-nowrap">{qtd(l.negociada)} {l.unidadePedido}</td>
              <td className="text-right tabular-nums">{qtd(l.entregue)}</td>
              <td className="text-right tabular-nums">{qtd(l.pendente)}</td>
              <td className="text-right tabular-nums whitespace-nowrap">{qtd(l.quantidadeDocumento)} {l.unidadeDocumento}</td>
              <td className="text-right tabular-nums">{qtd(l.saldoAposDocumento)}</td>
              <td className="text-right tabular-nums whitespace-nowrap">{preco(l.precoPedido)}</td>
              <td className="text-right tabular-nums whitespace-nowrap">{preco(l.precoDocumento)}</td>
              <td className="text-right tabular-nums whitespace-nowrap">{l.diferencaPreco ? `${preco(l.diferencaPreco)}${l.diferencaPrecoPct !== null ? ` (${qtd(l.diferencaPrecoPct)}%)` : ''}` : '—'}</td>
              <td>
                <div className="flex flex-wrap gap-1">
                  {l.divergencias.length === 0 && <span className="text-[12px] text-fg-subtle">Nenhuma</span>}
                  {l.divergencias.map((d) => <Badge key={d} variant={DIVERGENCIAS[d]?.variante ?? 'neutral'}>{DIVERGENCIAS[d]?.rotulo ?? d}</Badge>)}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LinhaItem({ item }: { item: Item }) {
  const temDetalhe = item.linhas.length > 0 || item.linhasSugeridas.length > 0;
  const [aberto, setAberto] = useState(item.situacao !== 'PEDIDO_UNICO' || item.linhas.some((l) => l.divergencias.length > 0));
  const sit = ITENS[item.situacao] ?? { rotulo: item.situacao, variante: 'neutral' as Variante };
  return (
    <li className="border-b border-border-subtle last:border-b-0">
      <button type="button" disabled={!temDetalhe} aria-expanded={aberto} onClick={() => setAberto(!aberto)} className="w-full flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-left enabled:hover:bg-surface-hover">
        {temDetalhe ? (aberto ? <ChevronDown size={16} className="text-fg-subtle" /> : <ChevronRight size={16} className="text-fg-subtle" />) : <span className="w-4" />}
        <span className="text-[12px] text-fg-subtle tabular-nums">Item {item.nItem ?? '—'}</span>
        <span className="text-[13.5px] text-fg min-w-0 flex-1 truncate">{item.xProd || 'Sem descrição'}</span>
        <span className="text-[12.5px] text-fg-muted tabular-nums whitespace-nowrap">{item.cProd || 'sem código'} · {qtd(item.quantidade)} {item.unidade} · {preco(item.valorUnitario)}</span>
        <Badge variant={sit.variante}>{sit.rotulo}</Badge>
      </button>
      {aberto && (
        <div className="px-5 pb-4 flex flex-col gap-2">
          {item.linhas.length > 0 && <TabelaLinhas linhas={item.linhas} />}
          {item.referenciaPedido && (
            <p className="text-[12.5px] text-fg-muted">
              Referência de pedido no XML: {item.referenciaPedido.pedido}{item.referenciaPedido.item ? `, item ${item.referenciaPedido.item}` : ''}.{' '}
              {item.referenciaPedido.confereCom.length ? `Confere com o pedido ${item.referenciaPedido.confereCom.join(', ')}.` : 'Não confere com nenhum pedido candidato.'}
            </p>
          )}
          {Number(item.descontoDocumento) > 0 && <p className="text-[12.5px] text-fg-muted">Desconto no item da nota: {preco(Number(item.descontoDocumento))}. A comparação usa o preço unitário cheio; o líquido aparece para conferência.</p>}
          {item.situacao === 'PRODUTO_NAO_IDENTIFICADO' && item.identificacao.sugestoes.length > 0 && (
            <>
              <p className="text-[12.5px] text-fg-muted">Sem de-para no Sankhya para este código. A referência do fornecedor sugere o produto {item.identificacao.sugestoes.join(', ')}. É só uma sugestão: não entrou na conferência e precisa ser confirmada.</p>
              {item.linhasSugeridas.length > 0 && <TabelaLinhas linhas={item.linhasSugeridas} />}
            </>
          )}
        </div>
      )}
      {!aberto && item.situacao === 'PRODUTO_NAO_IDENTIFICADO' && item.identificacao.sugestoes.length === 0 && <p className="px-5 pb-3 pl-12 text-[12.5px] text-fg-muted">Sem de-para no Sankhya para este código de fornecedor.</p>}
    </li>
  );
}

// Mostra o resultado da conferencia. Nao ha acao aqui: e leitura e a pessoa decide no Sankhya.
export default function ConferenciaPedidos({ resultado, origem }: { resultado: ResultadoCorrespondencia; origem?: string }) {
  const sit = SITUACOES[resultado.situacao] ?? { rotulo: resultado.situacao, variante: 'neutral' as Variante };
  const vinculos = resultado.pedidos.filter((p) => p.vinculos.length > 0);
  return (
    <div className="flex flex-col gap-5">
      <div className="cartao p-5 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={sit.variante}>{sit.rotulo}</Badge>
          <span className="text-[14px] text-fg">{resultado.resumo}</span>
        </div>
        <p className="text-[12.5px] text-fg-muted">
          Nota {resultado.documento.numero || 'sem número'}{resultado.documento.serie ? ` série ${resultado.documento.serie}` : ''}{resultado.documento.dataEmissao ? `, emitida em ${formatarData(resultado.documento.dataEmissao)}` : ''}, {formatarMoeda(resultado.documento.valorTotal)}, {resultado.documento.itens} item(ns)
          {resultado.parceiros.length > 0 ? ` · Fornecedor ${resultado.parceiros.map((p) => p.CODPARC).join(', ')}` : ''}
          {resultado.empresas.length > 0 ? ` · Empresa ${resultado.empresas.map((e) => e.CODEMP).join(' ou ')}` : ''}
        </p>
        {origem && <p className="text-[12.5px] text-fg-subtle">Fonte: {origem}.</p>}
        <p className="flex items-center gap-2 text-[12.5px] text-fg-muted"><ShieldCheck size={16} className="text-fg-subtle" /> Somente leitura: nada foi gravado no Sankhya. A confirmação da nota é sempre manual, no Sankhya.</p>
      </div>

      {resultado.classificacao && (
        <div className="cartao p-5 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium text-fg-muted">Resultado da validação</span>
            <Badge variant={CLASSES[resultado.classificacao]?.variante ?? 'neutral'}>{CLASSES[resultado.classificacao]?.rotulo ?? resultado.classificacao}</Badge>
          </div>
          {resultado.justificativa && <p className="text-[13.5px] text-fg">{resultado.justificativa}</p>}
          {resultado.intervencaoHumana && resultado.intervencaoHumana.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="flex items-center gap-2 text-[13px] font-medium text-fg-muted"><UserCheck size={16} className="text-fg-subtle" /> Exige intervenção humana</span>
              <ul className="list-disc pl-5 text-[13px] text-fg flex flex-col gap-1">{resultado.intervencaoHumana.map((m) => <li key={m.codigo}>{m.texto}</li>)}</ul>
            </div>
          )}
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-x-5 gap-y-2 text-[12.5px]">
            <div><dt className="text-fg-subtle">Chave de acesso</dt><dd className="text-fg tabular-nums break-all">{resultado.documento.chave || '—'}</dd></div>
            <div><dt className="text-fg-subtle">CNPJ do emitente</dt><dd className="text-fg tabular-nums">{resultado.documento.cnpjEmitente || '—'}</dd></div>
            <div><dt className="text-fg-subtle">CNPJ do destinatário</dt><dd className="text-fg tabular-nums">{resultado.documento.cnpjDestinatario || '—'}</dd></div>
          </dl>
        </div>
      )}

      {resultado.alertas.map((a, i) => <Aviso key={`${a.tipo}-${i}`} tipo={a.tipo === 'JA_EXISTE_NO_ERP' ? 'danger' : 'warning'}>{a.mensagem}</Aviso>)}

      {resultado.pedidos.length > 0 && (
        <div className="cartao overflow-hidden">
          <div className="px-5 py-4 border-b border-border-subtle">
            <h3 className="text-[14px] font-medium text-fg">Pedidos candidatos</h3>
            {resultado.pedidos.length > 1 && <p className="text-[12.5px] text-fg-muted mt-0.5">A ordem é só de apresentação: quem cobre mais itens vem primeiro e, no empate, o pedido mais recente. A escolha é de uma pessoa.</p>}
          </div>
          <div className="overflow-x-auto">
            <table className="tabela">
              <thead><tr><th>Pedido</th><th>Data</th><th>Empresa</th><th className="text-right">Itens cobertos</th><th className="text-right">Com saldo</th><th className="text-right">Preço igual</th><th className="text-right">Outros itens pendentes</th><th>Faturamento</th></tr></thead>
              <tbody>
                {resultado.pedidos.map((p) => (
                  <tr key={p.NUNOTA}>
                    <td className="tabular-nums font-medium text-fg whitespace-nowrap">{p.NUNOTA}{p.NUMNOTA ? ` · nº ${p.NUMNOTA}` : ''}</td>
                    <td className="tabular-nums whitespace-nowrap">{formatarData(p.DTNEG)}</td>
                    <td className="tabular-nums">{p.CODEMP}</td>
                    <td className="text-right tabular-nums">{p.itensCobertos} de {resultado.itens.length}</td>
                    <td className="text-right tabular-nums">{p.itensComSaldoSuficiente}</td>
                    <td className="text-right tabular-nums">{p.itensComPrecoIgual}</td>
                    <td className="text-right tabular-nums">{p.itensPendentesForaDoDocumento}</td>
                    <td>{p.jaFaturadoParcialmente ? <Badge variant="info">Parcial já faturado</Badge> : <span className="text-[12px] text-fg-subtle">Sem faturamento</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {resultado.itens.length > 0 && (
        <div className="cartao overflow-hidden">
          <div className="px-5 py-4 border-b border-border-subtle">
            <h3 className="text-[14px] font-medium text-fg">Itens da nota</h3>
            <p className="text-[12.5px] text-fg-muted mt-0.5">Nenhuma tolerância é aplicada: toda diferença aparece. As tolerâncias dependem de aprovação de Compras e Fiscal.</p>
          </div>
          <ul>{resultado.itens.map((i, k) => <LinhaItem key={`${i.nItem}-${k}`} item={i} />)}</ul>
        </div>
      )}

      {vinculos.length > 0 && (
        <div className="cartao overflow-hidden">
          <div className="px-5 py-4 border-b border-border-subtle"><h3 className="text-[14px] font-medium text-fg">Notas já vinculadas aos pedidos</h3></div>
          <div className="overflow-x-auto">
            <table className="tabela">
              <thead><tr><th>Pedido</th><th>Item do pedido</th><th>Nota</th><th>TOP</th><th>Situação</th><th className="text-right">Quantidade atendida</th></tr></thead>
              <tbody>
                {vinculos.flatMap((p) => p.vinculos.map((v) => (
                  <tr key={`${p.NUNOTA}-${v.SEQUENCIAORIG}-${v.NUNOTA}`}>
                    <td className="tabular-nums">{p.NUNOTA}</td>
                    <td className="tabular-nums">{v.SEQUENCIAORIG}</td>
                    <td className="tabular-nums">{v.NUNOTA}{v.NUMNOTA ? ` · nº ${v.NUMNOTA}` : ''}</td>
                    <td className="tabular-nums">{v.CODTIPOPER}</td>
                    <td>{v.STATUSNOTA || '—'}</td>
                    <td className="text-right tabular-nums">{qtd(v.QTDATENDIDA)}</td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
