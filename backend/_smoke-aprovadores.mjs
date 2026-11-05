// Alcada fail-closed, no servidor. Aprovadores de teste (CODUSU 99xxxx), politica so na empresa de teste
// e perfil Aprovador temporario: nenhum aprovador, perfil ou parametro real e tocado.
import { ex, rows, uma, conf, encerrar, dml, consulta, tipo, criarLancamentoTeste, limparLancamento, abrirIsolamento, comAprovadorTemporario } from './lib/smoke.mjs';

const iso = await abrirIsolamento();
const e = iso.empresa;
const t = await tipo('BOLETO');
const eu = await uma('chatUsuarioAtual');
const COD = 990000 + Math.floor(Math.random() * 9000);
const criados = [];
const aprovador = async ({ email = eu.DESCR, teto = 1000, ativo = 1, vinculo = 'NULL' } = {}) => {
  await dml(`INSERT INTO APROVADORES (CODUSU, NOME, EMAIL, LIMITE_ALCADA, USUARIO_MITRA_ID, ATIVO, CRIADO_EM) VALUES (${COD}, 'Aprovador Smoke', '${email}', ${teto ?? 'NULL'}, ${vinculo}, ${ativo}, '2026-11-05T00:00:00')
    ON DUPLICATE KEY UPDATE EMAIL = VALUES(EMAIL), LIMITE_ALCADA = VALUES(LIMITE_ALCADA), USUARIO_MITRA_ID = VALUES(USUARIO_MITRA_ID), ATIVO = VALUES(ATIVO)`);
  return (await consulta(`SELECT ID FROM APROVADORES WHERE CODUSU = ${COD}`))[0].ID;
};
const escopo = (aid, empresaId, tipoId) => dml(`INSERT INTO APROVADOR_ESCOPO (APROVADOR_ID, EMPRESA_ID, TIPO_DOCUMENTO_ID, ATIVO, APROVADO_POR, CRIADO_EM) VALUES (${aid}, ${empresaId}, ${tipoId}, TRUE, 'smoke', '2026-11-05T00:00:00')`);
try {
  const a = await criarLancamentoTeste({ empresa: e, tipo: t, valor: 500 });
  criados.push(a.lancamentoId);
  conf('sem parametro, nasce aguardando aprovacao', a.status === 'AGUARDANDO_APROVACAO', a.status);

  // Caminho real, com o perfil Aprovador real: quem roda o teste nao esta nele.
  const real = await ex('aplicarDecisaoAprovacao', { lancamentoId: a.lancamentoId, acao: 'APROVAR', motivo: '' });
  conf('decisao sem autorizacao e recusada', real.ok === false, real.motivo);
  const direto = await ex('gravarDecisaoAprovacao', { id: a.lancamentoId, acao: 'APROVAR' });
  conf('chamar a escrita direto nao aprova', Number(direto.affectedRows) === 0);
  const rej = await ex('aplicarDecisaoAprovacao', { lancamentoId: a.lancamentoId, acao: 'REJEITAR', motivo: 'teste' });
  conf('rejeitar tambem exige autorizacao', rej.ok === false, rej.motivo);

  await comAprovadorTemporario(true, async (copiar) => {
    const ver = await copiar('verificarPermissaoAprovacao');
    const gravar = await copiar('gravarDecisaoAprovacao');
    const motivo = async (id) => (await ver({ id })).MOTIVO;
    const ativos = Number((await consulta('SELECT COUNT(*) AS N FROM APROVADORES WHERE ATIVO = TRUE'))[0].N);
    if (ativos === 0) conf('sem aprovador ativo, recusa', (await motivo(a.lancamentoId)) === 'SEM_APROVADOR_ATIVO');
    else console.log(`INFO ha ${ativos} aprovador(es) real(is) ativo(s): caso "nenhum ativo" coberto pelo aprovador de teste inativo.`);

    const aid = await aprovador({ ativo: 0 });
    await escopo(aid, e.ID, t.ID);
    const m0 = await motivo(a.lancamentoId);
    conf('aprovador inativo nao decide', ['SEM_APROVADOR_ATIVO', 'SEM_VINCULO'].includes(m0), m0);

    await aprovador({ email: 'ninguem@exemplo.invalid' });
    conf('e-mail sem login: usuario sem vinculo e recusado', (await motivo(a.lancamentoId)) === 'SEM_VINCULO');
    await aprovador({ vinculo: 999999 });
    conf('vinculo gravado para outro usuario e recusado', (await motivo(a.lancamentoId)) === 'SEM_VINCULO');

    await aprovador({ teto: null });
    conf('vinculo pelo e-mail na hora da decisao, sem salvar de novo', (await rows('listarAprovadores')).some((x) => Number(x.CODUSU) === COD && x.LOGIN));
    conf('teto nao definido recusa', (await motivo(a.lancamentoId)) === 'SEM_TETO');
    await aprovador({ teto: 0 });
    conf('teto zero recusa', (await motivo(a.lancamentoId)) === 'SEM_TETO');

    await aprovador({ teto: 100 });
    conf('acima da alcada recusa', (await motivo(a.lancamentoId)) === 'ACIMA_DA_ALCADA');
    conf('acima da alcada a escrita nao aplica', Number((await gravar({ id: a.lancamentoId, acao: 'APROVAR' })).affectedRows) === 0);

    const outroTipo = await criarLancamentoTeste({ empresa: e, tipo: iso.tipoFinanceiro, valor: 10 });
    criados.push(outroTipo.lancamentoId);
    conf('tipo fora da politica recusa', (await motivo(outroTipo.lancamentoId)) === 'FORA_DA_POLITICA');
    conf('fora da politica a escrita nao aplica', Number((await gravar({ id: outroTipo.lancamentoId, acao: 'APROVAR' })).affectedRows) === 0);

    await aprovador({ teto: 1000 });
    conf('todas as condicoes cumpridas: pode decidir', (await motivo(a.lancamentoId)) === 'OK');
    conf('dentro da politica e da alcada a escrita aplica', Number((await gravar({ id: a.lancamentoId, acao: 'APROVAR' })).affectedRows) === 1);
  });

  await comAprovadorTemporario(false, async (copiar) => {
    const ver = await copiar('verificarPermissaoAprovacao');
    const b = await criarLancamentoTeste({ empresa: e, tipo: t, valor: 10 });
    criados.push(b.lancamentoId);
    conf('sem o perfil Aprovador recusa, mesmo vinculado e na politica', (await ver({ id: b.lancamentoId })).MOTIVO === 'SEM_PERFIL');
  });
  const al = await uma('minhaAlcada');
  conf('minha alcada nao mostra permissao fora do perfil', Number(al.TEM_PERFIL) === 0);
} finally {
  for (const id of criados) await limparLancamento(id);
  await iso.fechar();
}
encerrar('Aprovadores (fail-closed)');
