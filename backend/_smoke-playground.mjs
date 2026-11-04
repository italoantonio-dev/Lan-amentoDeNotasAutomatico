// Estudo: ciclo completo, versoes e link publico chamado sem autenticacao. Nao existe SF que execute
// SQL recebido: o que a analista alcanca e o que os perfis liberam ao runQuery.
import { createRequire } from 'node:module';
import { ex, rows, uma, conf, encerrar, b64, sdk, projectId, garantirPerfis, dml } from './lib/smoke.mjs';
import { carregarSFs } from './lib/base.mjs';

const require = createRequire(new URL('../frontend/', import.meta.url));
const mapa = await carregarSFs();

conf('nao existe executor generico de SQL', !mapa.has('consulta_livre'));
const perfis = await garantirPerfis();
const PROIBIDAS = ['CHAT_CONVERSA', 'CHAT_MENSAGEM', 'CHAT_FERRAMENTA_EXEC', 'CHAT_ANEXO', 'PLAYGROUND', 'PLAYGROUND_VERSAO', 'PERMISSOES_USUARIO'];
for (const [nome, id] of Object.entries(perfis)) {
  const d = await sdk.getProfileDetailsMitra({ projectId, profileId: id });
  const tabelas = (d.result.selectTables ?? []).map((t) => t.tableName ?? t.name);
  conf(`perfil ${nome} nao libera conversas nem estudos`, tabelas.length > 0 && !tabelas.some((t) => PROIBIDAS.includes(t)), `${tabelas.length} tabelas`);
}

await ex('playground_criar');
const id = (await uma('playground_ultimo')).ID;
try {
  const e = await uma('playground_get', { id });
  conf('estudo nasce com chave da analista', /^[0-9a-f]{32}$/.test(e.CHAVE_IA));
  const html1 = `<html><body><h1>Análise d'água "com aspas" e <b>acentuação</b> 100%</h1></body></html>`;
  const s1 = await ex('playground_salvar_html', { playgroundId: id, chave: e.CHAVE_IA, html: html1 });
  conf('grava HTML cheio de aspas e acento', s1.ok === true && (await uma('playground_get', { id })).HTML === html1);
  const sem = await ex('playground_salvar_html', { playgroundId: id, chave: '0'.repeat(32), html: '<p>invasor</p>' });
  conf('chave errada nao sobrescreve o estudo', sem.ok === false && (await uma('playground_get', { id })).HTML === html1);
  const html2 = '<html><body>segunda versão</body></html>';
  await ex('playground_salvar_html', { playgroundId: id, chave: e.CHAVE_IA, html: html2 });
  const vs = await rows('playground_versoes', { id });
  conf('tela anterior vira versao', vs.length === 1);
  await ex('playground_versionar_atual', { id });
  await ex('playground_restaurar', { id, versaoId: vs[0].ID });
  conf('restaurar volta a tela e guarda a atual', (await uma('playground_get', { id })).HTML === html1 && (await rows('playground_versoes', { id })).length === 2);
  await ex('playground_renomear', { playgroundId: id, chave: e.CHAVE_IA, nome: "Concentração d'água" });
  conf('renomeia com apostrofo', (await uma('playground_get', { id })).NOME === "Concentração d'água");
  await ex('playground_salvar_conversa', { id, conversa: b64(JSON.stringify([{ tipo: 'usuario', texto: 'ação' }])) });
  conf('conversa volta igual', JSON.parse((await uma('playground_get', { id })).CONVERSA)[0].texto === 'ação');

  await ex('playground_compartilhar', { id });
  const token = (await uma('playground_get', { id })).SHARE_TOKEN;
  conf('token e hexadecimal de 32', /^[0-9a-f]{32}$/.test(token));

  // Link publico: instancia da SDK sem token nenhum, como quem nao tem conta.
  const pub = require('mitra-interactions-sdk');
  const anon = pub.createMitraInstance({ baseURL: process.env.MITRA_BASE_URL, projectId });
  const abrir = async (t) => {
    const r = await anon.executePublicServerFunction({ projectId, serverFunctionId: mapa.get('playground_publico'), input: { token: t } });
    return { bruto: r, saida: typeof r.output === 'string' ? JSON.parse(r.output) : r.output };
  };
  const ok = await abrir(token);
  conf('link publico abre sem autenticacao', ok.saida?.ok === true && ok.saida.html === html1, ok.saida?.erro ?? ok.bruto.error ?? '');
  for (const forjado of ["' OR '1'='1", '0'.repeat(32), 'abc', '']) {
    const f = await abrir(forjado);
    conf(`token forjado "${forjado.slice(0, 12)}" nao abre`, f.saida?.ok === false);
  }
  await ex('playground_descompartilhar', { id });
  conf('desligar o link derruba o acesso', (await abrir(token)).saida?.ok === false);

  // Outro dono: nada aparece e nada e alterado.
  await dml(`UPDATE PLAYGROUND SET USUARIO = -1 WHERE ID = ${id}`);
  conf('estudo de outro nao abre', (await uma('playground_get', { id })) === null);
  conf('estudo de outro nao e excluido', Number((await ex('playground_excluir', { id })).affectedRows) === 0);
} finally {
  await dml(`DELETE FROM PLAYGROUND_VERSAO WHERE PLAYGROUND_ID = ${id}`);
  await dml(`DELETE FROM PLAYGROUND WHERE ID = ${id}`);
}
encerrar('Playground');
