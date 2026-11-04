// Nucleo: CRUD, criacao de lancamento, aprovacao, trilha.
import { ex, rows, uma, conf, encerrar, criarLancamentoTeste, limparLancamento, hash } from './lib/smoke.mjs';

const criados = [];
try {
  // CRUD: empresa de teste com codigo fora da faixa do ERP.
  const cod = 900000 + Math.floor(Math.random() * 90000);
  const nome = `Empresa Smoke ${cod}`;
  await ex('criarEmpresa', { codigo: cod, descricao: nome, ativo: 1, cnpj: '00000000000191' });
  const lista = await rows('listarEmpresas', { busca: nome, limite: 5, offset: 0 });
  conf('cria e lista empresa', lista.length === 1 && lista[0].NOME === nome);
  await ex('atualizarEmpresa', { id: lista[0].ID, codigo: cod, descricao: `${nome} X`, ativo: 0, cnpj: '00000000000191' });
  const depois = await uma('listarEmpresas', { busca: `${nome} X`, limite: 5, offset: 0 });
  conf('atualiza empresa', depois && Number(depois.ATIVO) === 0);
  await ex('excluirEmpresa', { id: lista[0].ID });
  conf('exclui empresa', (await rows('listarEmpresas', { busca: nome, limite: 5, offset: 0 })).length === 0);
  conf('nome com apostrofo nao quebra a busca', Array.isArray(await rows('listarEmpresas', { busca: "d'agua", limite: 1, offset: 0 })));

  // Sem parametro cadastrado o lancamento nasce aguardando aprovacao.
  const l = await criarLancamentoTeste({ nome: "Fornecedor D'Agua", itens: [{ descricao: 'Igual', quantidade: 1, valorUnitario: 10 }, { descricao: 'Igual', quantidade: 1, valorUnitario: 10 }] });
  criados.push(l.lancamentoId);
  conf('cria lancamento aguardando aprovacao', l.status === 'AGUARDANDO_APROVACAO', l.status);
  const det = await uma('obterLancamento', { id: l.lancamentoId });
  conf('detalhe le o que foi gravado, com apostrofo', det?.NOME_FORNECEDOR === "Fornecedor D'Agua" && Number(det.VALOR_TOTAL) === 123.45);
  conf('dois itens iguais gravam duas linhas', (await rows('listarItensLancamento', { lancamentoId: l.lancamentoId })).length === 2);

  const dup = await ex('criarLancamentoViaChat', { empresaId: l.empresa.ID, tipoId: l.tipo.ID, hash: l.hash, valorTotal: 1, origem: 'TELA' });
  conf('mesmo hash recusa segundo lancamento', dup.ok === false && dup.duplicado === true && Number(dup.lancamentoId) === l.lancamentoId);

  // Nao ha caminho para APROVADO fora da decisao com alcada.
  const burla = await ex('atualizarStatusLancamento', { id: l.lancamentoId, status: 'APROVADO' });
  conf('status generico nao aprova', Number(burla.affectedRows) === 0);
  const burla2 = await ex('atualizarStatusLancamento', { id: l.lancamentoId, status: 'LANCADO' });
  conf('status generico nao lanca pendente', Number(burla2.affectedRows) === 0);

  const semMotivo = await ex('aplicarDecisaoAprovacao', { lancamentoId: l.lancamentoId, acao: 'REJEITAR', motivo: '' });
  conf('rejeicao exige motivo', semMotivo.ok === false);
  const ap = await ex('aplicarDecisaoAprovacao', { lancamentoId: l.lancamentoId, acao: 'APROVAR', motivo: '' });
  conf('aprova pendente', ap.ok === true, ap.erro ?? '');
  const de2 = await ex('aplicarDecisaoAprovacao', { lancamentoId: l.lancamentoId, acao: 'APROVAR', motivo: '' });
  conf('nao aprova duas vezes', de2.ok === false);
  conf('decisao fica registrada', (await rows('listarAprovacoesLancamento', { lancamentoId: l.lancamentoId })).length === 1);

  const trilha = await rows('listarTrilhaLancamento', { lancamentoId: l.lancamentoId });
  conf('trilha tem entrada, alcada e aprovacao', ['ENTRADA', 'ALCADA', 'APROVACAO'].every((e) => trilha.some((t) => t.ETAPA === e)), trilha.map((t) => t.ETAPA).join(','));

  const tudo = await uma('detalheLancamento', { id: l.lancamentoId });
  const parse = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
  conf('detalhe traz tudo em uma chamada', parse(tudo.ITENS_JSON).length === 2 && parse(tudo.TRILHA_JSON).length >= 3 && parse(tudo.DECISOES_JSON).length === 1 && tudo.ENVIOS_JSON === null);
  const kpi = await uma('kpisDashboard', { empresaId: '', status: '' });
  conf('painel conta os aprovados', Number(kpi.APROVADOS) >= 1);
  conf('painel filtra por situacao', (await rows('lancamentosRecentes', { empresaId: '', status: 'APROVADO' })).every((r) => r.STATUS === 'APROVADO'));
  conf('hash desconhecido nao acusa duplicidade', (await rows('verificarDuplicidadeDocumento', { hash: hash() })).length === 0);
} finally {
  for (const id of criados) await limparLancamento(id);
}
conf('exclusao remove o lancamento e os itens', (await rows('listarItensLancamento', { lancamentoId: criados[0] })).length === 0);
encerrar('Nucleo');
