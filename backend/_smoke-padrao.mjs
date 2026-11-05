// Classificacao por historico, local e ERP. So le o ERP.
import { ex, conf, encerrar, consulta, abrirIsolamento, tipo, cnpjFicticio, criarLancamentoTeste, limparLancamento, uma, rows } from './lib/smoke.mjs';

const iso = await abrirIsolamento();
const e = iso.empresa;
const t = await tipo('BOLETO');
const criados = [];
const entrada = (o) => ({ empresaId: e.ID, tipoId: t.ID, topId: 0, naturezaId: 0, centroId: 0, contaId: 0, limite: 0, destino: 'FINANCEIRO', codTipTit: 0, codProdPadrao: 0, ...o });
try {
  const [n1, n2] = await consulta('SELECT ID, CODNAT FROM NATUREZAS WHERE ATIVO = TRUE LIMIT 2');
  const top = (await consulta(`SELECT ID FROM TOPS WHERE TIPMOV = 'I' AND ATIVO = TRUE LIMIT 1`))[0];
  await ex('salvarParametro', entrada({ topId: top?.ID ?? 0, naturezaId: n1.ID, limite: 1000000 }));
  const cnpj = cnpjFicticio();

  const a = await criarLancamentoTeste({ empresa: e, tipo: t, cnpj });
  criados.push(a.lancamentoId);
  conf('sem historico, vem do parametro', a.origemClassificacao === 'PARAMETRO', a.origemClassificacao);

  // Uma pessoa corrige a natureza em dois documentos: agora ha 2 de 2 com 100%.
  await ex('atualizarClassificacaoLancamento', { id: a.lancamentoId, topId: top?.ID ?? 0, naturezaId: n2.ID, centroId: 0, contaId: 0 });
  const b = await criarLancamentoTeste({ empresa: e, tipo: t, cnpj });
  criados.push(b.lancamentoId);
  await ex('atualizarClassificacaoLancamento', { id: b.lancamentoId, topId: top?.ID ?? 0, naturezaId: n2.ID, centroId: 0, contaId: 0 });
  const c = await criarLancamentoTeste({ empresa: e, tipo: t, cnpj });
  criados.push(c.lancamentoId);
  const lc = await uma('obterLancamento', { id: c.lancamentoId });
  conf('2 lancamentos com 70% herdam a natureza do historico local', c.origemClassificacao === 'PADRAO_HISTORICO' && Number(lc.NATUREZA_ID) === Number(n2.ID), `natureza ${lc.NATUREZA_ID}`);
  conf('TOP nunca e aprendida', Number(lc.TOP_ID ?? 0) === Number(top?.ID ?? 0));
  const trilha = await rows('listarTrilhaLancamento', { lancamentoId: c.lancamentoId });
  conf('trilha guarda a contagem', trilha.some((x) => x.ETAPA === 'CLASSIFICACAO' && /2 de 2 lan/.test(x.MENSAGEM)), trilha.find((x) => x.ETAPA === 'CLASSIFICACAO')?.MENSAGEM);

  // Fornecedor disperso nao herda: 1 de cada natureza fica abaixo de 70%.
  const disperso = cnpjFicticio();
  const d1 = await criarLancamentoTeste({ empresa: e, tipo: t, cnpj: disperso });
  criados.push(d1.lancamentoId);
  await ex('atualizarClassificacaoLancamento', { id: d1.lancamentoId, topId: top?.ID ?? 0, naturezaId: n2.ID, centroId: 0, contaId: 0 });
  const d2 = await criarLancamentoTeste({ empresa: e, tipo: t, cnpj: disperso });
  criados.push(d2.lancamentoId);
  const d3 = await ex('resolverClassificacaoLancamento', { empresaId: e.ID, tipoId: t.ID, cnpj: disperso });
  conf('fornecedor disperso fica no parametro', d3.origem === 'PARAMETRO' && Number(d3.naturezaId) === Number(n1.ID), `origem ${d3.origem}`);

  // Historico do ERP: fornecedor real, escolhido pela consulta, sem gravar nada.
  const rank = await ex('sankhyaParceiros', { busca: 'BANCO' });
  conf('busca de parceiro devolve no maximo 20', rank.ok === true && rank.itens.length <= 20, `${rank.itens.length}`);
  const inj = await ex('sankhyaParceiros', { busca: "X' OR '1'='1" });
  conf('apostrofo nao entra no SQL do ERP', inj.ok === true && inj.itens.length === 0);
  const h = await ex('sankhyaPadraoFornecedor', { codemp: e.CODEMP, codparc: 1 });
  conf('historico do fornecedor no ERP responde', h.ok === true && Array.isArray(h.itens));
} finally {
  for (const id of criados) await limparLancamento(id);
  await iso.fechar();
}
encerrar('Padrao do fornecedor');
