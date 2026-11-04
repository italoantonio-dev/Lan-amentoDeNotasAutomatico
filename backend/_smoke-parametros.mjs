// Parametro, TIPMOV e sugestao do ERP. So le o ERP.
import { ex, rows, uma, conf, encerrar, consulta, primeiraEmpresa, tipo, criarLancamentoTeste, limparLancamento } from './lib/smoke.mjs';

const e = await primeiraEmpresa();
const t = await tipo('BOLETO');
const antes = await uma('parametroComEmpresa', { empresaId: e.ID, tipoId: t.ID });
const criados = [];
const entrada = (o) => ({ empresaId: e.ID, tipoId: t.ID, topId: 0, naturezaId: 0, centroId: 0, contaId: 0, limite: 0, destino: 'FINANCEIRO', codTipTit: 0, codProdPadrao: 0, ...o });
try {
  await ex('salvarParametro', entrada({ limite: 1000 }));
  conf('salva parametro', Number((await uma('parametroComEmpresa', { empresaId: e.ID, tipoId: t.ID })).LIMITE_APROVACAO) === 1000);
  await ex('salvarParametro', entrada({ limite: 2000 }));
  conf('segundo salvar atualiza, nao duplica', (await consulta(`SELECT COUNT(*) AS N FROM PARAMETROS_LANCAMENTO WHERE EMPRESA_ID = ${e.ID} AND TIPO_DOCUMENTO_ID = ${t.ID}`))[0].N === 1);

  const abaixo = await criarLancamentoTeste({ valor: 100 });
  criados.push(abaixo.lancamentoId);
  conf('abaixo do limite nasce aprovado', abaixo.status === 'APROVADO', abaixo.status);
  const acima = await criarLancamentoTeste({ valor: 5000 });
  criados.push(acima.lancamentoId);
  conf('acima do limite nasce aguardando', acima.status === 'AGUARDANDO_APROVACAO', acima.status);
  await ex('salvarParametro', entrada({ limite: 0 }));
  const zero = await criarLancamentoTeste({ valor: 1 });
  criados.push(zero.lancamentoId);
  conf('limite 0 nasce aguardando', zero.status === 'AGUARDANDO_APROVACAO', zero.status);

  // TIPMOV: TOP de compra num boleto (que espera movimento I) e barrada antes de tocar o ERP.
  const compra = (await consulta(`SELECT ID, CODTIPOPER FROM TOPS WHERE TIPMOV = 'C' AND ATIVO = TRUE LIMIT 1`))[0];
  const nat = (await consulta(`SELECT ID FROM NATUREZAS WHERE ATIVO = TRUE LIMIT 1`))[0];
  const cen = (await consulta(`SELECT ID FROM CENTROS_RESULTADO WHERE ATIVO = TRUE LIMIT 1`))[0];
  const cta = (await consulta(`SELECT ID FROM CONTAS_BANCARIAS WHERE ATIVO = TRUE LIMIT 1`))[0];
  await ex('salvarParametro', entrada({ limite: 1000, topId: compra.ID, naturezaId: nat.ID, centroId: cen.ID, contaId: cta.ID, codTipTit: 4 }));
  const l = await criarLancamentoTeste({ valor: 100 });
  criados.push(l.lancamentoId);
  const r = await ex('enviarLancamentoParaErp', { lancamentoId: l.lancamentoId, simular: 'S' });
  conf('TOP incompativel e recusada citando os movimentos', r.ok === false && r.motivo === 'TOP_INCOMPATIVEL', r.mensagem);

  const s = await ex('sankhyaPadroesLancamento', { codemp: e.CODEMP });
  conf('sugestao do ERP responde', s.ok === true && Array.isArray(s.itens), `${s.itens?.length ?? 0} linhas`);
  const outra = await ex('sankhyaPadroesLancamento', { codemp: (await consulta(`SELECT CODEMP FROM EMPRESAS WHERE CODEMP = 500 LIMIT 1`))[0]?.CODEMP ?? e.CODEMP });
  const dims = new Set((outra.itens ?? []).map((i) => i.dim));
  const refs = new Set((outra.itens ?? []).map((i) => i.topRef));
  conf('ranking traz TODOS e por TOP', refs.has('TODOS') && refs.size > 1, [...dims].join(','));
} finally {
  for (const id of criados) await limparLancamento(id);
  const atual = await uma('parametroComEmpresa', { empresaId: e.ID, tipoId: t.ID });
  if (!antes && atual) await ex('excluirParametro', { id: atual.ID });
  else if (antes) await ex('salvarParametro', entrada({ topId: antes.TOP_ID ?? 0, naturezaId: antes.NATUREZA_ID ?? 0, centroId: antes.CENTRO_ID ?? 0, contaId: antes.CONTA_ID ?? 0, limite: antes.LIMITE_APROVACAO, destino: antes.DESTINO_ERP, codTipTit: antes.CODTIPTIT ?? 0, codProdPadrao: antes.CODPROD_PADRAO ?? 0 }));
}
encerrar('Parametros');
