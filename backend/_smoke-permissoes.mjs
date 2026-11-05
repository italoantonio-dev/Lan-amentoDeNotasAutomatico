// Permissoes, no servidor. O papel de administrador e testado com copias das SFs apontando para um perfil
// temporario, porque a plataforma nao oferece retirar usuario de perfil.
import { ex, rows, uma, conf, encerrar, consulta, dml, comPerfilTemporario, criarLancamentoTeste, limparLancamento, abrirIsolamento, copiaComoUsuario } from './lib/smoke.mjs';

const iso = await abrirIsolamento();
const eu = Number((await uma('chatUsuarioAtual')).ID);
const criados = [];
const atual = await uma('permissoesUsuarioAtual');
conf('sem administrador, todos entram', Number(atual.TOTAL_ADMINS) > 0 || Number(atual.ADMINISTRADOR) === 1);
conf('informa se e desenvolvedor', atual.ISDEV !== undefined);

await comPerfilTemporario(async (copiar) => {
  const salvar = await copiar('salvarParametro');
  const r = await salvar({ empresaId: iso.empresa.ID, tipoId: 1, topId: 0, naturezaId: 0, centroId: 0, contaId: 0, limite: 1, destino: 'FINANCEIRO', codTipTit: 0, codProdPadrao: 0 });
  conf('quem nao e administrador nao grava parametro', Number(r.affectedRows) === 0);
  const criar = await copiar('criarEmpresa');
  conf('quem nao e administrador nao cria empresa', Number((await criar({ codigo: 999999, descricao: 'x', ativo: 1, cnpj: '' })).affectedRows) === 0);
  const us = await copiar('listarUsuariosPermissoes');
  conf('quem nao e administrador nao lista usuarios', ((await us({ limite: 10, offset: 0 })).rows ?? []).length === 0);
  const eu2 = await copiar('permissoesUsuarioAtual');
  conf('com administrador definido, o usuario comum deixa de ser administrador', Number((await eu2({})).rows[0]?.ADMINISTRADOR ?? 0) === 0);
});

// Alcance por tipo: usuario ficticio (999999) e copias das SFs que rodam como ele. Nenhuma
// permissao de usuario real e alterada, nem temporariamente.
const tipos = await consulta('SELECT ID, CODIGO FROM TIPOS_DOCUMENTO ORDER BY ID');
const boleto = tipos.find((t) => t.CODIGO === 'BOLETO');
const nota = tipos.find((t) => t.CODIGO === 'NOTA_FISCAL');
const FICTICIO = 999999;
const copias = [];
try {
  const b = await criarLancamentoTeste({ tipoCodigo: 'BOLETO', valor: 1 });
  criados.push(b.lancamentoId);
  await ex('salvarPermissoesUsuario', { usuarioId: FICTICIO, todos: 0, tipos: [nota.ID] });
  const visiveis = await copiaComoUsuario('tiposVisiveisUsuario', FICTICIO); copias.push(visiveis);
  const lista = await copiaComoUsuario('listarLancamentos', FICTICIO); copias.push(lista);
  const obter = await copiaComoUsuario('obterLancamento', FICTICIO); copias.push(obter);
  conf('abas nascem do que o usuario enxerga', (await visiveis({})).every((t) => Number(t.ID) === Number(nota.ID)));
  conf('lista respeita o tipo no servidor', (await lista({ empresaId: '', tipoId: boleto.ID, status: '', busca: '', limite: 5, offset: 0 })).length === 0);
  conf('detalhe respeita o tipo no servidor', (await obter({ id: b.lancamentoId })).length === 0);
  await ex('salvarPermissoesUsuario', { usuarioId: FICTICIO, todos: 1, tipos: [] });
  conf('liberar todos volta a mostrar', (await obter({ id: b.lancamentoId })).length === 1);
} finally {
  for (const c of copias) await c.apagar();
  await dml(`DELETE FROM PERMISSAO_TIPO_DOCUMENTO WHERE USUARIO_ID = ${FICTICIO}`);
  await dml(`DELETE FROM PERMISSOES_USUARIO WHERE USUARIO_ID = ${FICTICIO}`);
  for (const id of criados) await limparLancamento(id);
  await iso.fechar();
}
encerrar('Permissoes');
