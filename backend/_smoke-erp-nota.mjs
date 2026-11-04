// Gravacao de nota. NAO grava: exercita guardas e a montagem de cabecalho e itens (simular).
import { ex, uma, conf, encerrar, consulta, primeiraEmpresa, tipo, cnpjFicticio, criarLancamentoTeste, limparLancamento } from './lib/smoke.mjs';

const e = await primeiraEmpresa();
const t = await tipo('NOTA_FISCAL');
const antes = await uma('parametroComEmpresa', { empresaId: e.ID, tipoId: t.ID });
const criados = [];
const entrada = (o) => ({ empresaId: e.ID, tipoId: t.ID, topId: 0, naturezaId: 0, centroId: 0, contaId: 0, limite: 1000000, destino: 'NOTA', codTipTit: 0, codProdPadrao: 0, ...o });
try {
  const compra = (await consulta(`SELECT ID FROM TOPS WHERE TIPMOV = 'C' AND ATIVO = TRUE LIMIT 1`))[0];
  const nat = (await consulta(`SELECT ID FROM NATUREZAS WHERE ATIVO = TRUE AND CODNAT <> '0' LIMIT 1`))[0];
  const cen = (await consulta(`SELECT ID FROM CENTROS_RESULTADO WHERE ATIVO = TRUE AND CODCENCUS <> '0' LIMIT 1`))[0];
  await ex('salvarParametro', entrada({ topId: compra.ID, naturezaId: nat.ID, centroId: cen.ID }));
  const parceiro = (await ex('sankhyaParceiros', { busca: 'BANCO DO BRASIL' })).itens.find((x) => x.CGC_CPF);

  const semItem = await criarLancamentoTeste({ tipoCodigo: 'NOTA_FISCAL', valor: 80, cnpj: parceiro?.CGC_CPF ?? cnpjFicticio(), numeroDoc: `8${String(Date.now()).slice(-8)}` });
  criados.push(semItem.lancamentoId);
  conf('nota abaixo do limite nasce aprovada', semItem.status === 'APROVADO', semItem.status);
  const r = await ex('enviarLancamentoParaErp', { lancamentoId: semItem.lancamentoId, simular: 'S' });
  if (r.escolhaParceiro) {
    console.log(`INFO parceiro com ${r.candidatos.length} candidatos: guarda de produto exercitada com a escolha.`);
    const r2 = await ex('enviarLancamentoParaErp', { lancamentoId: semItem.lancamentoId, simular: 'S', codparc: r.candidatos[0].codparc });
    conf('nota sem item e sem produto padrao e recusada', r2.ok === false && r2.motivo === 'SEM_PRODUTO', r2.mensagem);
  } else if (parceiro) {
    conf('nota sem item e sem produto padrao e recusada', r.ok === false && r.motivo === 'SEM_PRODUTO', r.mensagem);
  }

  const venda = (await consulta(`SELECT ID FROM TOPS WHERE TIPMOV = 'V' AND ATIVO = TRUE LIMIT 1`))[0];
  await ex('atualizarClassificacaoLancamento', { id: semItem.lancamentoId, topId: venda.ID, naturezaId: nat.ID, centroId: cen.ID, contaId: 0 });
  const r3 = await ex('enviarLancamentoParaErp', { lancamentoId: semItem.lancamentoId, simular: 'S' });
  conf('TOP de venda em nota de entrada e recusada', r3.ok === false && r3.motivo === 'TOP_INCOMPATIVEL', r3.mensagem);

  const prod = (await ex('sankhyaProdutos', { busca: 'PORCA' })).itens?.[0];
  if (prod && parceiro) {
    const comItem = await criarLancamentoTeste({ tipoCodigo: 'NOTA_FISCAL', valor: 80, cnpj: parceiro.CGC_CPF, numeroDoc: `7${String(Date.now()).slice(-8)}`, itens: [{ descricao: 'Item A', quantidade: 2, valorUnitario: 40, codprod: prod.CODPROD }] });
    criados.push(comItem.lancamentoId);
    let m = await ex('enviarLancamentoParaErp', { lancamentoId: comItem.lancamentoId, simular: 'S' });
    if (m.escolhaParceiro) m = await ex('enviarLancamentoParaErp', { lancamentoId: comItem.lancamentoId, simular: 'S', codparc: m.candidatos[0].codparc });
    conf('nota com item monta cabecalho e itens', m.ok === true && m.entidade === 'CabecalhoNota' && m.itens?.length === 1 && Number(m.itens[0].CODPROD) === Number(prod.CODPROD), m.mensagem ?? '');
  }
  console.log('INFO gravacao real nao exercitada: o ERP conectado e de producao e gravar e irreversivel.');
} finally {
  for (const id of criados) await limparLancamento(id);
  const atual = await uma('parametroComEmpresa', { empresaId: e.ID, tipoId: t.ID });
  if (!antes && atual) await ex('excluirParametro', { id: atual.ID });
}
encerrar('Envio de nota (simulado)');
