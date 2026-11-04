// Nota de entrada: a conferencia compara com os pedidos, so lendo; criar nota esta bloqueado
// (temporario, ate haver servico oficial homologado e autorizacao). NAO grava. As recusas em todos
// os caminhos, e a conferencia com dados reais, estao em _smoke-bloqueio-erp.mjs.
import { ex, uma, conf, encerrar, consulta, primeiraEmpresa, tipo, cnpjFicticio, criarLancamentoTeste, limparLancamento } from './lib/smoke.mjs';

const e = await primeiraEmpresa();
const t = await tipo('NOTA_FISCAL');
const antes = await uma('parametroComEmpresa', { empresaId: e.ID, tipoId: t.ID });
const criados = [];
const entrada = (o) => ({ empresaId: e.ID, tipoId: t.ID, topId: 0, naturezaId: 0, centroId: 0, contaId: 0, limite: 1000000, destino: 'NOTA', codTipTit: 0, codProdPadrao: 0, ...o });
const envios = async () => Number((await consulta('SELECT COUNT(*) AS N FROM ERP_ENVIO'))[0].N);
const enviosAntes = await envios();
try {
  const compra = (await consulta(`SELECT ID FROM TOPS WHERE TIPMOV = 'C' AND ATIVO = TRUE LIMIT 1`))[0];
  const nat = (await consulta(`SELECT ID FROM NATUREZAS WHERE ATIVO = TRUE AND CODNAT <> '0' LIMIT 1`))[0];
  const cen = (await consulta(`SELECT ID FROM CENTROS_RESULTADO WHERE ATIVO = TRUE AND CODCENCUS <> '0' LIMIT 1`))[0];
  await ex('salvarParametro', entrada({ topId: compra.ID, naturezaId: nat.ID, centroId: cen.ID }));

  const n = await criarLancamentoTeste({ tipoCodigo: 'NOTA_FISCAL', valor: 80, cnpj: cnpjFicticio(), numeroDoc: `8${String(Date.now()).slice(-8)}` });
  criados.push(n.lancamentoId);
  conf('nota abaixo do limite nasce aprovada', n.status === 'APROVADO', n.status);
  const conferencia = await ex('enviarLancamentoParaErp', { lancamentoId: n.lancamentoId, simular: 'S' });
  conf('conferencia de nota vai para a correspondencia com pedidos', conferencia.ok === true && conferencia.entidade === 'CorrespondenciaPedido' && Boolean(conferencia.correspondencia.situacao), conferencia.mensagem);
  const real = await ex('enviarLancamentoParaErp', { lancamentoId: n.lancamentoId });
  conf('envio real de nota recusa', real.ok === false && real.motivo === 'GRAVACAO_BLOQUEADA', real.motivo);
  const situacao = await uma('obterLancamento', { id: n.lancamentoId });
  conf('recusa nao muda a situacao do lancamento', situacao.STATUS === 'APROVADO', situacao.STATUS);
  conf('nada entrou no registro de envios', (await envios()) === enviosAntes);
} finally {
  for (const id of criados) await limparLancamento(id);
  const atual = await uma('parametroComEmpresa', { empresaId: e.ID, tipoId: t.ID });
  if (!antes && atual) await ex('excluirParametro', { id: atual.ID });
}
encerrar('Nota de entrada');
