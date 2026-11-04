// Permissoes, no servidor. O papel de administrador e testado com copias das SFs apontando para um perfil
// temporario, porque a plataforma nao oferece retirar usuario de perfil.
import { ex, rows, uma, conf, encerrar, consulta, dml, comPerfilTemporario, criarLancamentoTeste, limparLancamento } from './lib/smoke.mjs';

const eu = Number((await uma('chatUsuarioAtual')).ID);
const criados = [];
const atual = await uma('permissoesUsuarioAtual');
conf('sem administrador, todos entram', Number(atual.TOTAL_ADMINS) > 0 || Number(atual.ADMINISTRADOR) === 1);
conf('informa se e desenvolvedor', atual.ISDEV !== undefined);

await comPerfilTemporario(async (copiar) => {
  const salvar = await copiar('salvarParametro');
  const r = await salvar({ empresaId: 1, tipoId: 1, topId: 0, naturezaId: 0, centroId: 0, contaId: 0, limite: 1, destino: 'FINANCEIRO', codTipTit: 0, codProdPadrao: 0 });
  conf('quem nao e administrador nao grava parametro', Number(r.affectedRows) === 0);
  const criar = await copiar('criarEmpresa');
  conf('quem nao e administrador nao cria empresa', Number((await criar({ codigo: 999999, descricao: 'x', ativo: 1, cnpj: '' })).affectedRows) === 0);
  const us = await copiar('listarUsuariosPermissoes');
  conf('quem nao e administrador nao lista usuarios', ((await us({ limite: 10, offset: 0 })).rows ?? []).length === 0);
  const eu2 = await copiar('permissoesUsuarioAtual');
  conf('com administrador definido, o usuario comum deixa de ser administrador', Number((await eu2({})).rows[0].ADMINISTRADOR) === 0);
});

const tipos = await consulta('SELECT ID, CODIGO FROM TIPOS_DOCUMENTO ORDER BY ID');
const boleto = tipos.find((t) => t.CODIGO === 'BOLETO');
const nota = tipos.find((t) => t.CODIGO === 'NOTA_FISCAL');
const antes = await consulta(`SELECT TODOS_OS_TIPOS FROM PERMISSOES_USUARIO WHERE USUARIO_ID = ${eu}`);
const antesTipos = await consulta(`SELECT TIPO_DOCUMENTO_ID FROM PERMISSAO_TIPO_DOCUMENTO WHERE USUARIO_ID = ${eu}`);
try {
  const b = await criarLancamentoTeste({ tipoCodigo: 'BOLETO', valor: 1 });
  criados.push(b.lancamentoId);
  await ex('salvarPermissoesUsuario', { usuarioId: eu, todos: 0, tipos: [nota.ID] });
  conf('abas nascem do que o usuario enxerga', (await rows('tiposVisiveisUsuario')).every((t) => Number(t.ID) === Number(nota.ID)));
  conf('lista respeita o tipo no servidor', (await rows('listarLancamentos', { empresaId: '', tipoId: boleto.ID, status: '', busca: '', limite: 5, offset: 0 })).length === 0);
  conf('detalhe respeita o tipo no servidor', (await uma('obterLancamento', { id: b.lancamentoId })) === null);
  await ex('salvarPermissoesUsuario', { usuarioId: eu, todos: 1, tipos: [] });
  conf('liberar todos volta a mostrar', (await uma('obterLancamento', { id: b.lancamentoId })) !== null);
} finally {
  await ex('salvarPermissoesUsuario', { usuarioId: eu, todos: antes.length ? antes[0].TODOS_OS_TIPOS : 1, tipos: antesTipos.map((x) => x.TIPO_DOCUMENTO_ID) }).catch(() => {});
  if (!antes.length) await dml(`DELETE FROM PERMISSOES_USUARIO WHERE USUARIO_ID = ${eu}`);
  for (const id of criados) await limparLancamento(id);
}
encerrar('Permissoes');
