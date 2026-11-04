// Alcada, no servidor. O aprovador de teste usa um codigo fora da faixa do ERP e e removido no fim.
import { ex, rows, uma, conf, encerrar, dml, criarLancamentoTeste, limparLancamento } from './lib/smoke.mjs';

const eu = (await uma('chatUsuarioAtual')).ID;
const email = (await uma('chatUsuarioAtual')).DESCR;
const COD = 990000 + Math.floor(Math.random() * 9000);
const criados = [];
try {
  const inicio = await uma('minhaAlcada');
  const semAprovador = Number(inicio.TOTAL_APROVADORES) === 0;

  const a = await criarLancamentoTeste({ valor: 500 });
  criados.push(a.lancamentoId);
  if (semAprovador) conf('sem aprovador, a alcada nao vale', Number((await uma('verificarPermissaoAprovacao', { id: a.lancamentoId })).PODE_APROVAR) === 1);

  await ex('salvarAprovador', { codusu: COD, nome: 'Aprovador Smoke', email, grupo: '', limite: '100', ativo: 1 });
  const lista = await rows('listarAprovadores');
  const eles = lista.find((x) => Number(x.CODUSU) === COD);
  conf('casa o login pelo e-mail', Number(eles?.USUARIO_MITRA_ID) === Number(eu));
  const al = await uma('minhaAlcada');
  conf('minha alcada mostra o teto', Number(al.LIMITE) === 100 && Number(al.SOU_APROVADOR) >= 1);

  const fila = await rows('listarPendentesAprovacao', { limite: 100, offset: 0 });
  const item = fila.find((x) => Number(x.ID) === a.lancamentoId);
  conf('acima do teto chega marcado sem poder', item && Number(item.PODE_APROVAR) === 0);
  const rec = await ex('aplicarDecisaoAprovacao', { lancamentoId: a.lancamentoId, acao: 'APROVAR', motivo: '' });
  conf('servidor recusa acima da alcada', rec.ok === false && /al[cç]ada/i.test(rec.erro), rec.erro);
  const direto = await ex('gravarDecisaoAprovacao', { id: a.lancamentoId, acao: 'APROVAR' });
  conf('chamar a escrita direto tambem nao aprova', Number(direto.affectedRows) === 0);

  await ex('salvarAprovador', { codusu: COD, nome: 'Aprovador Smoke', email, grupo: '', limite: '1000', ativo: 1 });
  const ok = await ex('aplicarDecisaoAprovacao', { lancamentoId: a.lancamentoId, acao: 'APROVAR', motivo: '' });
  conf('dentro da alcada aprova', ok.ok === true, ok.erro ?? '');

  await ex('salvarAprovador', { codusu: COD, nome: 'Aprovador Smoke', email: 'ninguem@exemplo.invalid', grupo: '', limite: '', ativo: 1 });
  const semLogin = (await rows('listarAprovadores')).find((x) => Number(x.CODUSU) === COD);
  conf('e-mail sem login fica sem vinculo', semLogin.USUARIO_MITRA_ID === null && semLogin.LIMITE_ALCADA === null);
  const b = await criarLancamentoTeste({ valor: 1 });
  criados.push(b.lancamentoId);
  const sem = await ex('aplicarDecisaoAprovacao', { lancamentoId: b.lancamentoId, acao: 'APROVAR', motivo: '' });
  conf('quem nao esta vinculado nao aprova', sem.ok === false, sem.erro);

  await ex('inativarAprovador', { id: semLogin.ID, ativo: 0 });
  conf('inativar preserva o cadastro', Number((await rows('listarAprovadores')).find((x) => Number(x.CODUSU) === COD).ATIVO) === 0);
} finally {
  for (const id of criados) await limparLancamento(id);
  await dml(`DELETE FROM APROVADORES WHERE CODUSU = ${COD}`);
}
encerrar('Aprovadores');
