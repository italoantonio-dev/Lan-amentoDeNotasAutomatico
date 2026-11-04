import { callSF, execSF, SF, umaLinha } from './api';

type Linha = Record<string, any>;
export interface Bloco { nome: string; args: Record<string, any> }

// A IA nao ve schema nem codigo das SFs: so este catalogo curado. Nunca SQL livre.
export const PREAMBULO = `Você é o assistente de contas a pagar deste sistema. Responda em português do Brasil, direto e sem floreio.

COMO AGIR
Você não alcança o banco nem o ERP. Para consultar ou agir, emita exatamente um bloco, sozinho, e pare:
<FERRAMENTA>{"nome":"nome_da_ferramenta","args":{...}}</FERRAMENTA>
O sistema executa e devolve uma mensagem começando com "RESULTADO DA FERRAMENTA". Responda usando APENAS esse resultado.

REGRAS
- Nunca invente dado, valor, fornecedor nem classificação contábil. Se a ferramenta voltar vazia, diga que não há registro.
- Quem classifica é o sistema: você não escolhe TOP, natureza, centro nem conta.
- Antes de uma ferramenta que altera dados, confirme com o usuário, salvo se ele já pediu explicitamente.
- Os campos seguem o documento. Nota Fiscal tem emissão e não tem vencimento: quem vence é a duplicata. Na guia a data é de apuração; na folha é competência.
- Campo marcado CONFERIR saiu de heurística: confirme com o usuário antes de lançar.
- Enviar ao ERP não é uma ferramenta. A gravação no ERP está desligada nesta fase; a pessoa pode conferir sem gravar, no detalhe do lançamento.
- O sistema nunca confirma nota fiscal: a confirmação é manual, por pessoa autorizada no Sankhya.
- Nunca mostre o bloco nem o nome técnico da ferramenta ao usuário.

FERRAMENTAS
Leitura:
- listar_empresas {}: empresas com id.
- listar_lancamentos {status?, empresaId?, tipoId?, busca?}: status é um de AGUARDANDO_APROVACAO, APROVADO, LANCADO, REJEITADO, ERRO, REVISAO_LEITURA. Devolve até 20.
- consultar_lancamento {id}
- pendentes_aprovacao {}
- indicadores {}: totais do painel.
- trilha_lancamento {id}: o porquê de cada passo.
- listar_anexos {}: documentos desta conversa e a situação de cada um.
- buscar_parceiro {busca}: fornecedores no ERP por nome ou CNPJ.
- listar_tipos {}: tipos de documento com id.
Altera dados:
- criar_lancamento {empresaId, tipoId, cnpj, nome, numeroDoc, serie?, dataEmissao, dataVencimento?, valorTotal, anexoId?}: datas em AAAA-MM-DD. Use anexoId quando o documento veio anexado.
- aprovar_lancamento {id}
- rejeitar_lancamento {id, motivo}: motivo é obrigatório.
- buscar_emails {}: busca notas na caixa de e-mail e processa os anexos: lê, classifica e confere, sem gravar no ERP. Só a pedido do usuário.`;

export const ROTULOS: Record<string, string> = {
  listar_empresas: 'Listou empresas', listar_lancamentos: 'Consultou lançamentos', consultar_lancamento: 'Abriu um lançamento', pendentes_aprovacao: 'Viu pendências', indicadores: 'Leu indicadores', trilha_lancamento: 'Leu a trilha',
  listar_anexos: 'Viu os anexos', buscar_parceiro: 'Buscou fornecedor', listar_tipos: 'Listou tipos', criar_lancamento: 'Criou lançamento', aprovar_lancamento: 'Aprovou', rejeitar_lancamento: 'Rejeitou', buscar_emails: 'Buscou e-mails',
};

// Modelos as vezes envolvem o bloco em cercas de codigo: aceita as duas formas.
export function extrairBloco(texto: string): Bloco | null {
  const m = /<FERRAMENTA>\s*([\s\S]*?)\s*<\/FERRAMENTA>/.exec(texto);
  if (!m) return null;
  const json = m[1].replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    const o = JSON.parse(json);
    return o && typeof o.nome === 'string' ? { nome: o.nome, args: o.args ?? {} } : null;
  } catch {
    return null;
  }
}

export function textoVisivel(texto: string): string {
  return texto
    .replace(/```(?:\w+)?\s*<FERRAMENTA>[\s\S]*?<\/FERRAMENTA>\s*```/g, '')
    .replace(/<FERRAMENTA>[\s\S]*?<\/FERRAMENTA>/g, '')
    .replace(/(?:```(?:\w+)?\s*)?<FERRAMENTA>[\s\S]*$/, '')
    .trim();
}

const MUDA_DADOS = new Set(['criar_lancamento', 'aprovar_lancamento', 'rejeitar_lancamento', 'buscar_emails']);
const reduzir = (l: Linha[], campos: string[]) => l.map((x) => Object.fromEntries(campos.map((c) => [c, x[c]])));

export async function executarFerramenta(b: Bloco, conversaId: number): Promise<{ dados: unknown; sucesso: boolean; resumo: string }> {
  const a = b.args;
  const VISAO = ['ID', 'NOME_FORNECEDOR', 'CNPJ_FORNECEDOR', 'NUMERO_DOC', 'DATA_EMISSAO', 'DATA_VENCIMENTO', 'VALOR_TOTAL', 'EMPRESA', 'TIPO_DESC', 'STATUS', 'ORIGEM_CLASSIFICACAO'];
  switch (b.nome) {
    case 'listar_empresas': {
      const r = await callSF(SF.listarOpcoesCadastro);
      const d = r.filter((o) => o.GRUPO === 'EMPRESA').map((o) => ({ id: o.ID, codigo: o.CODIGO, nome: o.DESCRICAO }));
      return { dados: d, sucesso: true, resumo: `${d.length} empresas` };
    }
    case 'listar_tipos': {
      const r = await callSF(SF.tiposVisiveisUsuario);
      return { dados: reduzir(r, ['ID', 'CODIGO', 'DESCRICAO']), sucesso: true, resumo: `${r.length} tipos` };
    }
    case 'listar_lancamentos': {
      const r = await callSF(SF.listarLancamentos, { status: a.status, empresaId: a.empresaId, tipoId: a.tipoId, busca: a.busca, limite: 20, offset: 0 });
      return { dados: reduzir(r, VISAO), sucesso: true, resumo: `${r.length} lançamentos` };
    }
    case 'consultar_lancamento': {
      const r = await umaLinha(SF.obterLancamento, { id: Number(a.id) });
      return { dados: r, sucesso: Boolean(r), resumo: r ? `Lançamento ${a.id}` : 'Não encontrado' };
    }
    case 'pendentes_aprovacao': {
      const r = await callSF(SF.listarPendentesAprovacao, { limite: 20, offset: 0 });
      return { dados: reduzir(r, [...VISAO.filter((c) => c !== 'STATUS'), 'PODE_APROVAR']), sucesso: true, resumo: `${r.length} pendentes` };
    }
    case 'indicadores': {
      const r = await umaLinha(SF.kpisDashboard, {});
      return { dados: r, sucesso: true, resumo: 'Totais do painel' };
    }
    case 'trilha_lancamento': {
      const r = await callSF(SF.listarTrilhaLancamento, { lancamentoId: Number(a.id) });
      return { dados: reduzir(r, ['ETAPA', 'STATUS', 'MENSAGEM', 'CRIADO_EM']), sucesso: true, resumo: `${r.length} passos` };
    }
    case 'listar_anexos': {
      const r = await callSF(SF.chatListarAnexos, { conversaId });
      return { dados: reduzir(r, ['ID', 'NOME', 'STATUS', 'LANCAMENTO_ID', 'CAMPOS_JSON']), sucesso: true, resumo: `${r.length} anexos` };
    }
    case 'buscar_parceiro': {
      const r = await execSF<{ itens?: Linha[] }>(SF.sankhyaParceiros, { busca: a.busca });
      return { dados: r?.itens ?? [], sucesso: true, resumo: `${r?.itens?.length ?? 0} parceiros` };
    }
    case 'criar_lancamento': {
      let anexoId = Number(a.anexoId) || 0;
      if (!anexoId) {
        // Com exatamente um documento pendente, resolve sozinho; com dois ou mais, exige a escolha.
        const pend = (await callSF(SF.chatListarAnexos, { conversaId })).filter((x) => x.STATUS === 'LIDO' || x.STATUS === 'SEM_LEITURA');
        if (pend.length === 1) anexoId = Number(pend[0].ID);
        if (pend.length > 1) return { dados: { erro: `Há ${pend.length} documentos pendentes nesta conversa. Pergunte ao usuário qual deles lançar e informe anexoId.`, pendentes: reduzir(pend, ['ID', 'NOME']) }, sucesso: false, resumo: 'Faltou escolher o anexo' };
      }
      const r = await execSF<Linha>(SF.criarLancamentoViaChat, { origem: 'CHAT', anexoId, empresaId: a.empresaId, tipoId: a.tipoId, cnpj: a.cnpj, nome: a.nome, numeroDoc: a.numeroDoc, serie: a.serie, dataEmissao: a.dataEmissao, dataVencimento: a.dataVencimento, valorTotal: a.valorTotal });
      return { dados: r, sucesso: Boolean(r.ok), resumo: r.ok ? `Lançamento ${r.lancamentoId} (${r.status})` : String(r.erro ?? 'Recusado') };
    }
    case 'aprovar_lancamento':
    case 'rejeitar_lancamento': {
      const r = await execSF<Linha>(SF.aplicarDecisaoAprovacao, { lancamentoId: Number(a.id), acao: b.nome === 'aprovar_lancamento' ? 'APROVAR' : 'REJEITAR', motivo: a.motivo ?? '' });
      return { dados: r, sucesso: Boolean(r.ok), resumo: r.ok ? `Lançamento ${a.id}: ${r.status}` : String(r.erro ?? 'Recusado') };
    }
    case 'buscar_emails': {
      const r = await execSF<Linha>(SF.roboVarrerEmails, { origem: 'ASSISTENTE' });
      return { dados: r, sucesso: Boolean(r.ok), resumo: r.ok ? `${r.anexos ?? 0} anexos lidos` : String(r.erro ?? 'A busca falhou') };
    }
    default:
      return { dados: { erro: `Ferramenta "${b.nome}" não existe.` }, sucesso: false, resumo: 'Ferramenta inexistente' };
  }
}

export function formatarResultado(nome: string, dados: unknown, sucesso: boolean): string {
  const vazio = Array.isArray(dados) ? dados.length === 0 : dados == null;
  if (vazio) return `RESULTADO DA FERRAMENTA ${nome}: nenhum registro encontrado, diga isso ao usuário — não invente dados.`;
  const json = JSON.stringify(dados);
  return `RESULTADO DA FERRAMENTA ${nome} (${sucesso ? 'sucesso' : 'recusado'}):\n${json.length > 8000 ? `${json.slice(0, 8000)}... (cortado)` : json}`;
}

export const alteraDados = (nome: string) => MUDA_DADOS.has(nome);
