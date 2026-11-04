// Fase 0: prova que nenhum fluxo grava no ERP com o bloqueio ativo. Nunca grava no Sankhya.
//
//   node _smoke-bloqueio-erp.mjs              A, B e C (fonte, comportamento isolado, publicado)
//   node _smoke-bloqueio-erp.mjs --vivo       A, B, C e D (D executa as SFs publicadas)
//
// A. Fonte: toda saida para o ERP passa por uma porta unica e a trava esta desligada.
// B. Comportamento isolado: roda o codigo exato das SFs com um falso SDK, sem rede. Se a trava
//    falhasse, a tentativa ficaria registrada no falso SDK e nao chegaria a lugar nenhum.
//    Inclui a prova inversa: com a trava ligada em memoria, o teste ENXERGA a gravacao.
// C. Publicado: o codigo no ar e byte a byte o codigo testado em B; SFs de integracao so leem.
// D. Vivo: as SFs publicadas, com CNPJ ficticio e sem cadastro: mesmo sem a trava, parariam antes
//    de gravar (parceiro inexistente). ERP_ENVIO precisa terminar igual.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { montarJS, carregarSFs, DIR_BACKEND } from './lib/base.mjs';
import { conf, encerrar, totalFalhas, sdk, projectId, consulta, ex, cnpjFicticio, criarLancamentoTeste, limparLancamento } from './lib/smoke.mjs';
import { JS_COM_ERP, SQL_ALTERADAS, codigoEsperado } from './fase0/funcoes.mjs';

const require = createRequire(import.meta.url);
const VIVO = process.argv.includes('--vivo');
const RAIZ = path.resolve(DIR_BACKEND, '..');
const ler = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');
const LEITURA = 'DbExplorerSP.executeQuery';
const SQL_ESCRITA = /\b(INSERT|UPDATE|DELETE|MERGE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|EXEC|EXECUTE|BEGIN|DECLARE|CALL)\b/i;

function arquivos(dir, filtro, saida = []) {
  for (const e of fs.readdirSync(path.join(RAIZ, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== 'dist' && e.name !== '.cache') arquivos(rel, filtro, saida); } else if (filtro.test(e.name)) saida.push(rel);
  }
  return saida;
}
const ocorrencias = (texto, re) => (texto.match(re) || []).length;

// ---------------------------------------------------------------- A. Fonte
console.log('\n--- A. Fonte ---');
const erpJs = ler('backend/sf/_erp.js');
conf('trava geral desligada no adaptador', /^const GRAVACAO_ERP_HABILITADA = false;$/m.test(erpJs));
conf('adaptador tem uma unica saida para a rede', ocorrencias(erpJs, /callIntegrationMitra/g) === 1);
const sfs = arquivos('backend/sf', /\.js$/);
const chamadoresRede = sfs.filter((a) => /callIntegrationMitra/.test(ler(a)));
conf('fora do adaptador, integracao direta so nas SFs da caixa de e-mail', chamadoresRede.sort().join() === ['backend/sf/_erp.js', 'backend/sf/roboTestarCaixa.js', 'backend/sf/roboVarrerEmails.js'].sort().join(), chamadoresRede.join(', '));
for (const a of chamadoresRede.filter((x) => !x.endsWith('_erp.js'))) {
  const t = ler(a);
  conf(`${path.basename(a)} so faz GET`, ocorrencias(t, /method:\s*'GET'/g) >= 1 && !/method:\s*'(POST|PUT|PATCH|DELETE)'/.test(t));
}
const nomesEscrita = /saveRecord|CRUDServiceProvider|confirmarNota|CACSP|incluirNota|ServicosNfeSP/;
const foraDoAdaptador = [...sfs.filter((a) => !a.endsWith('_erp.js')), ...arquivos('frontend/src', /\.(ts|tsx)$/)].filter((a) => nomesEscrita.test(ler(a)));
conf('nenhum servico de gravacao citado fora do adaptador', foraDoAdaptador.length === 0, foraDoAdaptador.join(', '));
const telaComIntegracao = arquivos('frontend/src', /\.(ts|tsx)$/).filter((a) => /callIntegrationMitra/.test(ler(a)));
conf('nenhuma tela chama a integracao direto', telaComIntegracao.length === 0, telaComIntegracao.join(', '));
conf('tela nao oferece gravacao', /GRAVACAO_ERP_LIBERADA = false/.test(ler('frontend/src/hooks/useEnvioErp.ts')));
conf('robo sempre confere sem gravar', /enviarLancamentoParaErp, \{ lancamentoId: criado\.lancamentoId, simular: 'S' \}/.test(ler('backend/sf/_robo.js')));
const scripts = arquivos('backend', /\.mjs$/).filter((a) => !a.endsWith('_smoke-bloqueio-erp.mjs'));
const scriptsNoErp = scripts.filter((a) => /connection:\s*'sankhya'/.test(ler(a)));
const scriptsQueGravam = scriptsNoErp.filter((a) => { const t = ler(a); return nomesEscrita.test(t) || !/const EP = '\/gateway\/v1\/mge\/service\.sbr\?serviceName=DbExplorerSP\.executeQuery&outputType=json';/.test(t); });
conf(`scripts avulsos que falam com o ERP so usam a consulta (${scriptsNoErp.length})`, scriptsNoErp.length > 0 && scriptsQueGravam.length === 0, scriptsQueGravam.join(', '));
conf('nenhum script de setup religa a trava', arquivos('backend', /\.mjs$/).filter((a) => !a.includes('_smoke-bloqueio') && !a.includes('fase0/') && /GRAVACAO_ERP_HABILITADA\s*=\s*true/.test(ler(a))).length === 0);

// ---------------------------------------------------------------- B. Comportamento isolado
console.log('\n--- B. Comportamento isolado (sem rede) ---');
const AsyncFunction = Object.getPrototypeOf(async function () { /* */ }).constructor;
const idsPorNome = await carregarSFs();
const nomePorId = new Map([...idsPorNome.entries()].map(([n, i]) => [i, n]));

function linhasErp(sql) {
  let colunas = ['N']; let dados = [[0]];
  if (/FROM TGFPAR/.test(sql)) { colunas = ['CODPARC', 'NOMEPARC', 'RAZAOSOCIAL', 'CGC_CPF', 'FORNECEDOR', 'CLIENTE', 'ATIVO']; dados = [[10, 'P', 'Parceiro', '11222333000181', 'S', 'N', 'S']]; }
  else if (/FROM TGFTOP/.test(sql)) { colunas = ['DH']; dados = [['01/01/2026 00:00:00']]; }
  else if (/AS CHAVE FROM/.test(sql)) { colunas = ['CHAVE']; dados = []; }
  return { statusCode: 200, body: { status: '1', responseBody: { fieldsMetadata: colunas.map((name) => ({ name })), rows: dados } } };
}

// Falso SDK: registra tudo. A resposta de gravacao finge sucesso, para que uma trava com defeito
// apareca como gravacao registrada, e nao como erro que esconderia o problema.
function ambiente(respostas = {}) {
  const a = { rede: [], sfs: [] };
  a.gravacoes = () => a.rede.filter((r) => r.connection === 'sankhya' && (r.method !== 'POST' || (r.body && r.body.serviceName) !== LEITURA || !String(r.endpoint).includes(LEITURA)));
  a.sdk = {
    callIntegrationMitra: async (o) => {
      a.rede.push(o);
      if (o.connection !== 'sankhya') return respostas.__caixa ? respostas.__caixa(o) : { statusCode: 200, body: {} };
      if (o.body && o.body.serviceName === LEITURA) return linhasErp(o.body.requestBody.sql);
      return { statusCode: 200, body: { status: '1', responseBody: { entities: { entity: { NUFIN: { $: '999' }, NUNOTA: { $: '999' }, CODPARC: { $: '999' } } } } } };
    },
    executeServerFunctionMitra: async ({ serverFunctionId, input }) => {
      const nome = nomePorId.get(serverFunctionId) || String(serverFunctionId);
      a.sfs.push({ nome, input });
      const output = respostas[nome] ? await respostas[nome](input) : { rows: [], affectedRows: 1 };
      return { result: { executionStatus: 'COMPLETED', output } };
    },
    uploadFilePrivateMitra: async () => ({ result: { key: 'ai-files/private/teste' } }),
  };
  a.rodar = (codigo, event = {}) => new AsyncFunction('event', 'require', 'process', codigo)(event, (m) => (m === 'mitra-sdk' ? a.sdk : require(m)), { env: { MITRA_PROJECT_ID: '1' } });
  return a;
}

const dadosEnvio = (o = {}) => ({
  ID: 1, STATUS: 'APROVADO', DESTINO_ERP: 'FINANCEIRO', DESTINO_PADRAO: 'FINANCEIRO', CODEMP: 1, CODTIPOPER: 1, CODNAT: 1, CODCENCUS: 1, CODCTABCO: 1, CODTIPTIT: 1, CODPARC: 10,
  CNPJ_FORNECEDOR: '11222333000181', NUMERO_DOC: '123', SERIE: '1', DATA_EMISSAO: '2026-01-10', DATA_VENCIMENTO: '2026-02-10', VALOR_TOTAL: 100, TIPO_DESC: 'Boleto', NOME_FORNECEDOR: 'Parceiro', ENVIOS_JSON: null, ...o,
});
const respostasEnvio = (o) => ({ erpDadosEnvio: async () => ({ rows: [dadosEnvio(o)] }) });

const codEnviar = await codigoEsperado('enviarLancamentoParaErp');
const codCorrigir = await codigoEsperado('corrigirCadastroErp');
const adaptador = await montarJS('sf/_comum.js', 'sf/_erp.js');

// B1. A porta unica, chamada direto
{
  const a = ambiente();
  const sonda = `${adaptador}
    const resultado = {};
    const tentar = async (rotulo, fn) => { try { await fn(); resultado[rotulo] = 'PASSOU'; } catch (e) { resultado[rotulo] = e.codigo || 'OUTRO:' + msgErro(e); } };
    await tentar('Financeiro', () => erpSalvar('Financeiro', { CODEMP: 1 }, 'NUFIN'));
    await tentar('CabecalhoNota', () => erpSalvar('CabecalhoNota', { CODEMP: 1 }, 'NUNOTA'));
    await tentar('ItemNota', () => erpSalvar('ItemNota', { NUNOTA: 1 }, 'NUNOTA,SEQUENCIA'));
    await tentar('Parceiro', () => erpSalvar('Parceiro', { FORNECEDOR: 'S' }, 'CODPARC', 1));
    await tentar('saveDireto', () => erpChamar('CRUDServiceProvider.saveRecord', {}));
    await tentar('confirmar', () => erpChamar('CACSP.confirmarNota', {}));
    await tentar('confirmarMaiusculo', () => erpChamar('SERVICOSNFESP.CONFIRM', {}));
    await tentar('outroServico', () => erpChamar('CACSP.incluirNota', {}));
    await tentar('proto', () => erpChamar('__proto__', {}));
    await tentar('constructor', () => erpChamar('constructor', {}));
    return resultado;`;
  const r = await a.rodar(sonda);
  for (const k of ['Financeiro', 'CabecalhoNota', 'ItemNota', 'Parceiro', 'saveDireto']) conf(`erpSalvar/erpChamar ${k} para na trava`, r[k] === 'GRAVACAO_BLOQUEADA', r[k]);
  conf('confirmar nota e recusado sempre', r.confirmar === 'CONFIRMACAO_PROIBIDA' && r.confirmarMaiusculo === 'CONFIRMACAO_PROIBIDA', `${r.confirmar}, ${r.confirmarMaiusculo}`);
  conf('servico fora da lista e recusado', r.outroServico === 'SERVICO_NAO_PERMITIDO' && r.proto === 'SERVICO_NAO_PERMITIDO' && r.constructor === 'SERVICO_NAO_PERMITIDO', JSON.stringify([r.outroServico, r.proto, r.constructor]));
  conf('nenhuma das tentativas chegou a rede', a.rede.length === 0, `${a.rede.length} chamadas`);
}

// B2. A consulta so aceita leitura
{
  const a = ambiente();
  const hostis = [
    'UPDATE TGFCAB SET STATUSNOTA = 1', 'DELETE FROM TGFFIN', 'INSERT INTO TGFPAR VALUES (1)', 'MERGE INTO TGFCAB USING DUAL ON (1=1)',
    'DROP TABLE ZZ_PROBE', 'BEGIN STP_CONFIRMA(1); END;', 'SELECT 1 FROM DUAL; DELETE FROM TGFFIN', 'SELECT * FROM TGFCAB FOR UPDATE',
    'SELECT DBMS_RANDOM.VALUE FROM DUAL', 'WITH X AS (SELECT 1 FROM DUAL) DELETE FROM TGFFIN', "SELECT 1 /* ' */ ; DELETE FROM TGFFIN /* ' */ FROM DUAL", "SELECT 1 -- '\n; DELETE FROM TGFFIN -- '",
  ];
  const sonda = `${adaptador}
    const recusas = [];
    for (const sql of event.hostis) { try { await erpConsulta(sql); recusas.push('PASSOU: ' + sql); } catch (e) { recusas.push(e.codigo); } }
    const lidas = await erpConsulta("SELECT CODPARC, NOMEPARC, RAZAOSOCIAL, CGC_CPF, FORNECEDOR, CLIENTE, ATIVO FROM TGFPAR WHERE NOMEPARC LIKE '%MERGE DELETE%'");
    return { recusas, lidas };`;
  const r = await a.rodar(sonda, { hostis });
  const passaram = r.recusas.filter((x) => x !== 'SQL_NAO_E_LEITURA');
  conf(`${hostis.length} SQLs de escrita recusados antes da rede`, passaram.length === 0, passaram.join(' | '));
  conf('texto entre aspas nao atrapalha a leitura legitima', r.lidas.length === 1 && a.rede.length === 1 && a.gravacoes().length === 0);
}

// B3. Envio: real, com entradas hostis, nos dois destinos
for (const [rotulo, event] of [
  ['sem simular', { lancamentoId: 1 }],
  ['simular N', { lancamentoId: 1, simular: 'N' }],
  ['simular false', { lancamentoId: 1, simular: false }],
  ['pedindo para forcar', { lancamentoId: 1, GRAVACAO_ERP_HABILITADA: true, forcar: true, habilitar: 'S', modo: 'REAL' }],
]) {
  const a = ambiente(respostasEnvio());
  const r = await a.rodar(codEnviar, event);
  conf(`envio real (${rotulo}) recusa com GRAVACAO_BLOQUEADA`, r.ok === false && r.motivo === 'GRAVACAO_BLOQUEADA', r.motivo);
  conf(`envio real (${rotulo}) sem rede e sem reserva`, a.rede.length === 0 && !a.sfs.some((s) => /erpReservarEnvio|erpRegistrarEnvio|erpConcluirEnvio/.test(s.nome)));
}
for (const event of [{ lancamentoId: 1 }, { lancamentoId: 1, simular: 'S' }]) {
  const a = ambiente(respostasEnvio({ DESTINO_ERP: 'NOTA' }));
  const r = await a.rodar(codEnviar, event);
  conf(`nota ${event.simular ? 'na conferencia' : 'no envio real'} recusa com NOTA_PROIBIDA`, r.ok === false && r.motivo === 'NOTA_PROIBIDA', r.motivo);
  conf(`nota ${event.simular ? 'na conferencia' : 'no envio real'} sem rede`, a.rede.length === 0);
}

// B4. A conferencia segue funcionando e so le
{
  const a = ambiente(respostasEnvio());
  const r = await a.rodar(codEnviar, { lancamentoId: 1, simular: 'S' });
  conf('conferencia de titulo devolve o que seria enviado', r.ok === true && r.simulado === true && r.entidade === 'Financeiro' && Number(r.campos.CODPARC) === 10, r.mensagem ?? '');
  conf('conferencia so consultou o ERP', a.rede.length >= 2 && a.gravacoes().length === 0, `${a.rede.length} leituras`);
  conf('conferencia nao reserva nem registra envio', !a.sfs.some((s) => /erpReservarEnvio|erpRegistrarEnvio|erpConcluirEnvio/.test(s.nome)));
}
for (const [rotulo, o, motivo] of [
  ['aguardando aprovacao', { STATUS: 'AGUARDANDO_APROVACAO' }, 'AGUARDANDO_APROVACAO'],
  ['revisao de leitura', { STATUS: 'REVISAO_LEITURA' }, 'REVISAO_LEITURA'],
  ['rejeitado', { STATUS: 'REJEITADO' }, 'SITUACAO'],
  ['sem classificacao', { CODTIPOPER: null }, 'SEM_CLASSIFICACAO'],
  ['ja enviado', { ENVIOS_JSON: JSON.stringify([{ STATUS: 'OK', CHAVE_ERP: '5', DESTINO: 'FINANCEIRO' }]) }, undefined],
]) {
  const a = ambiente(respostasEnvio(o));
  const r = await a.rodar(codEnviar, { lancamentoId: 1, simular: 'S' });
  const certo = motivo ? r.ok === false && r.motivo === motivo : r.ok === true && r.jaEnviado === true;
  conf(`guarda da conferencia preservada: ${rotulo}`, certo && a.gravacoes().length === 0, r.motivo ?? (r.jaEnviado ? 'jaEnviado' : ''));
}

// B5. Correcao de cadastro
for (const event of [
  { lancamentoId: 1, acao: 'MARCAR_FORNECEDOR', codparc: 10 },
  { lancamentoId: 1, acao: 'MARCAR_CLIENTE', codparc: 10 },
  { lancamentoId: 1, acao: 'CRIAR_PARCEIRO', nome: 'X', codcid: 1 },
]) {
  const a = ambiente({ souAdministrador: async () => ({ rows: [{ ADMIN: 1 }] }), ...respostasEnvio() });
  const r = await a.rodar(codCorrigir, event);
  conf(`correcao ${event.acao} recusa antes de tudo`, r.ok === false && r.motivo === 'GRAVACAO_BLOQUEADA' && a.rede.length === 0 && a.sfs.length === 0, r.motivo);
}

// B6. Robo de ponta a ponta: a varredura real, com caixa falsa, e o envio real rodando por dentro.
async function rodadaDoRobo(codEnvio, destino) {
  const xml = '<?xml version="1.0"?><nfeProc><NFe><infNFe Id="NFe35240611222333000181550010000000011123456789"><ide><nNF>1</nNF><serie>1</serie><dhEmi>2026-01-10T10:00:00-03:00</dhEmi></ide><emit><CNPJ>11222333000181</CNPJ><xNome>Fornecedor</xNome></emit><dest><CNPJ>11444777000161</CNPJ></dest><det nItem="1"><prod><xProd>Item</xProd><qCom>1</qCom><vUnCom>10.00</vUnCom></prod></det><total><ICMSTot><vNF>10.00</vNF></ICMSTot></total><cobr><dup><dVenc>2026-02-10</dVenc></dup></cobr></infNFe></NFe></nfeProc>';
  const anexos = [];
  const a = ambiente({
    ...respostasEnvio({ DESTINO_ERP: destino }),
    roboLerConfig: async () => ({ rows: [{ CHAVE: 'CORTE_CONFIANCA', VALOR: '0' }, { CHAVE: 'ATIVO', VALOR: 'S' }] }),
    roboEmpresas: async () => ({ rows: [{ ID: 1, CODEMP: 1, NOME: 'Empresa', CNPJ: '11444777000161' }] }),
    listarTiposDocumento: async () => ({ rows: [{ ID: 1, CODIGO: 'NOTA_FISCAL' }, { ID: 2, CODIGO: 'BOLETO' }] }),
    roboEmailPorMensagem: async () => ({ rows: [{ ID: 1 }] }),
    roboObterExecucao: async () => ({ rows: [{ ID: 1 }] }),
    roboRegistrarAnexo: async (i) => { anexos.push(i); return { affectedRows: 1 }; },
    __caixa: async (o) => {
      if (/attachments/.test(o.endpoint)) return { statusCode: 200, body: { data: Buffer.from(xml).toString('base64') } };
      if (/messages\/m1/.test(o.endpoint)) return { statusCode: 200, body: { internalDate: '1767000000000', payload: { headers: [], parts: [{ filename: 'nota.xml', body: { attachmentId: 'a1' } }] } } };
      return { statusCode: 200, body: { messages: [{ id: 'm1' }] } };
    },
  });
  a.sdk.executeServerFunctionMitra = (original => async (o) => {
    if (nomePorId.get(o.serverFunctionId) === 'enviarLancamentoParaErp') {
      a.sfs.push({ nome: 'enviarLancamentoParaErp', input: o.input });
      return { result: { executionStatus: 'COMPLETED', output: await a.rodar(codEnvio, o.input) } };
    }
    return original(o);
  })(a.sdk.executeServerFunctionMitra);
  // O nucleo de criacao e coberto por _smoke-padrao; aqui so importa o que acontece depois dele.
  const codigo = `${await codigoEsperado('roboVarrerEmails')}
    async function criarLancamentoNucleo() { return { ok: true, status: 'APROVADO', lancamentoId: 77, documentoId: 88 }; }`;
  const retorno = await a.rodar(codigo, { origem: 'TELA' });
  return { a, anexos, retorno };
}
{
  const { a, anexos, retorno } = await rodadaDoRobo(codEnviar, 'FINANCEIRO');
  const pedidos = a.sfs.filter((s) => s.nome === 'enviarLancamentoParaErp');
  conf('rodada real do robo termina sem erro', retorno.ok === true, retorno.erro ?? '');
  conf('robo pede a conferencia, nunca o envio', pedidos.length === 1 && pedidos[0].input.simular === 'S', JSON.stringify(pedidos[0]?.input?.simular));
  conf('desfecho da rodada real e PRONTO, sem chave do ERP', anexos.length === 1 && anexos[0].decisao === 'PRONTO' && !anexos[0].chaveErp, anexos[0]?.decisao);
  conf('robo nao gravou nada no ERP', a.gravacoes().length === 0, `${a.gravacoes().length} gravacoes`);
}
{
  const { a, anexos } = await rodadaDoRobo(codEnviar, 'NOTA');
  conf('nota lida pelo robo vira NOTA_PEDIDO, nao erro', anexos.length === 1 && anexos[0].decisao === 'NOTA_PEDIDO', anexos[0]?.decisao);
  conf('nota lida pelo robo nao toca o ERP', a.rede.filter((r) => r.connection === 'sankhya').length === 0);
}

// B7. Prova inversa: as travas sao independentes e o teste enxerga gravacao.
const ligada = (c) => { const n = c.replace('const GRAVACAO_ERP_HABILITADA = false;', 'const GRAVACAO_ERP_HABILITADA = true;'); if (n === c) throw new Error('nao achei a trava no codigo'); return n; };
{
  const a = ambiente(respostasEnvio());
  const r = await a.rodar(ligada(codEnviar), { lancamentoId: 1 });
  conf('prova inversa: com a trava ligada EM MEMORIA, o teste enxerga a gravacao', r.ok === true && a.gravacoes().length === 1 && a.gravacoes()[0].body.serviceName === 'CRUDServiceProvider.saveRecord', `${a.gravacoes().length} gravacao no falso SDK`);
}
{
  const semGuarda = codEnviar.replace('if (!simular && !GRAVACAO_ERP_HABILITADA) {', 'if (false) {');
  if (semGuarda === codEnviar) throw new Error('nao achei a guarda do envio');
  const a = ambiente(respostasEnvio());
  const r = await a.rodar(semGuarda, { lancamentoId: 1 });
  conf('sem a guarda do envio, a porta unica ainda segura', r.ok === false && r.motivo === 'GRAVACAO_BLOQUEADA' && a.gravacoes().length === 0, r.motivo);
  conf('barrado pela porta unica, o lancamento nao vira ERRO', !a.sfs.some((s) => s.nome === 'erpConcluirEnvio' || s.nome === 'erpRegistrarEnvio'));
}
{
  const a = ambiente(respostasEnvio({ DESTINO_ERP: 'NOTA' }));
  const r = await a.rodar(ligada(codEnviar), { lancamentoId: 1 });
  conf('nota segue proibida mesmo com a trava ligada', r.motivo === 'NOTA_PROIBIDA' && a.gravacoes().length === 0, r.motivo);
}
{
  const { a, anexos } = await rodadaDoRobo(ligada(codEnviar), 'FINANCEIRO');
  conf('robo nao grava nem com a trava ligada', a.gravacoes().length === 0 && anexos[0]?.decisao === 'PRONTO', anexos[0]?.decisao);
}
{
  const a = ambiente();
  const r = await a.rodar(`${ligada(adaptador)} try { await erpChamar('CACSP.confirmarNota', {}); return 'PASSOU'; } catch (e) { return e.codigo; }`);
  conf('confirmar nota segue proibido mesmo com a trava ligada', r === 'CONFIRMACAO_PROIBIDA' && a.rede.length === 0, r);
}

// ---------------------------------------------------------------- C. Publicado
console.log('\n--- C. Publicado ---');
const lista = (await sdk.listServerFunctionsMitra({ projectId })).result;
const publicadas = new Map();
for (const s of lista) {
  const l = await sdk.readServerFunctionMitra({ projectId, serverFunctionId: s.id });
  publicadas.set(s.name, { id: s.id, tipo: s.type, code: String(l.result?.code ?? ''), jdbcId: l.result?.jdbcId ?? s.jdbcId ?? null });
}
for (const nome of Object.keys(JS_COM_ERP)) {
  const p = publicadas.get(nome);
  conf(`${nome}: publicado e identico ao testado`, !!p && p.code === (await codigoEsperado(nome)));
}
for (const [nome, sql] of Object.entries(SQL_ALTERADAS)) conf(`${nome}: publicado`, publicadas.get(nome)?.code === sql);

const comAdaptador = [...publicadas.entries()].filter(([, p]) => p.tipo === 'JAVASCRIPT' && /SLUG_ERP/.test(p.code));
conf('toda SF com o adaptador esta na lista da Fase 0', comAdaptador.every(([n]) => JS_COM_ERP[n]), comAdaptador.filter(([n]) => !JS_COM_ERP[n]).map(([n]) => n).join(', '));
conf('toda SF com o adaptador tem a trava desligada', comAdaptador.every(([, p]) => /^const GRAVACAO_ERP_HABILITADA = false;$/m.test(p.code)));
const foraDaPorta = [...publicadas.entries()].filter(([, p]) => p.tipo === 'JAVASCRIPT' && (ocorrencias(p.code, /connection:\s*SLUG_ERP/g) > 1 || /connection:\s*['"]sankhya['"]/.test(p.code) || /saveRecord/.test(p.code.replace(/const EP_SALVAR = .*\n/, '').replace(/'CRUDServiceProvider\.saveRecord'/g, ''))));
conf('nenhuma SF publicada chama o ERP por fora da porta unica', foraDaPorta.length === 0, foraDaPorta.map(([n]) => n).join(', '));

const integracoes = [...publicadas.entries()].filter(([, p]) => p.tipo === 'INTEGRATION');
let integracoesErp = 0;
for (const [nome, p] of integracoes) {
  const c = JSON.parse(p.code);
  if (c.connection !== 'sankhya') continue;
  integracoesErp++;
  const sql = c.body?.requestBody?.sql ?? '';
  conf(`${nome}: integracao so le`, String(c.endpoint).includes(LEITURA) && c.body?.serviceName === LEITURA && /^\s*(SELECT|WITH)\b/i.test(sql) && !SQL_ESCRITA.test(sql));
}
console.log(`INFO ${integracoesErp} SFs de integracao com o ERP conferidas, de ${integracoes.length} de integracao.`);
// A listagem da SDK nao traz conexao, agendamento nem execucao publica: a fonte e a tabela da plataforma.
const conexoes = (await sdk.getProjectContextMitra({ projectId })).result?.inventory?.jdbcs ?? [];
conf('so existe a conexao do proprio banco (nenhum JDBC para o ERP)', conexoes.length === 1 && Number(conexoes[0].id) === 1, JSON.stringify(conexoes.map((c) => c.id)));
const sqlExterno = await consulta('SELECT NAME FROM INT_SERVERFUNCTION WHERE JDBC_ID IS NOT NULL AND JDBC_ID <> 1');
conf('nenhuma SF aponta para banco externo', sqlExterno.length === 0, sqlExterno.map((x) => x.NAME).join(', '));
const agendadas = await consulta("SELECT NAME, CRON_EXPRESSION FROM INT_SERVERFUNCTION WHERE CRON_EXPRESSION IS NOT NULL AND CRON_EXPRESSION <> ''");
conf('nenhuma SF agendada', agendadas.length === 0, agendadas.map((x) => `${x.NAME} ${x.CRON_EXPRESSION}`).join(', '));
const gatilhos = await consulta('SELECT name AS NOME FROM INT_CRUD_FUNCTION WHERE active = 1');
conf('nenhuma SF disparada por evento de tabela', gatilhos.length === 0, gatilhos.map((x) => x.NOME).join(', '));
const publicas = (await consulta('SELECT NAME FROM INT_SERVERFUNCTION WHERE PUBLIC_EXECUTION = 1')).map((x) => x.NAME);
const publicasComErp = publicas.filter((n) => /SLUG_ERP|callIntegrationMitra|enviarLancamentoParaErp|corrigirCadastroErp|roboVarrerEmails/.test(publicadas.get(n)?.code ?? ''));
conf('nenhuma SF publica alcanca o ERP', publicasComErp.length === 0, `publicas: ${publicas.join(', ') || 'nenhuma'}`);

// ---------------------------------------------------------------- D. Vivo
if (VIVO && totalFalhas()) {
  console.log('\nINFO parte D nao executada: ha falhas acima, e ela so roda contra codigo ja comprovado.');
} else if (VIVO) {
  console.log('\n--- D. Vivo (SFs publicadas, CNPJ ficticio) ---');
  const contar = async () => Number((await consulta('SELECT COUNT(*) AS N FROM ERP_ENVIO'))[0].N);
  const antes = await contar();
  const l = await criarLancamentoTeste({ cnpj: cnpjFicticio(), tipoCodigo: 'BOLETO', valor: 1.23 });
  try {
    const real = await ex('enviarLancamentoParaErp', { lancamentoId: l.lancamentoId });
    conf('envio real publicado recusa com GRAVACAO_BLOQUEADA', real.ok === false && real.motivo === 'GRAVACAO_BLOQUEADA', real.motivo);
    const hostil = await ex('enviarLancamentoParaErp', { lancamentoId: l.lancamentoId, simular: 'N', GRAVACAO_ERP_HABILITADA: true, forcar: true });
    conf('envio real com entrada hostil recusa igual', hostil.ok === false && hostil.motivo === 'GRAVACAO_BLOQUEADA', hostil.motivo);
    const corrigir = await ex('corrigirCadastroErp', { lancamentoId: l.lancamentoId, acao: 'MARCAR_FORNECEDOR', codparc: 0 });
    conf('correcao de cadastro publicada recusa', corrigir.ok === false && corrigir.motivo === 'GRAVACAO_BLOQUEADA', corrigir.motivo);
    const criar = await ex('corrigirCadastroErp', { lancamentoId: l.lancamentoId, acao: 'CRIAR_PARCEIRO' });
    conf('criar parceiro publicado recusa', criar.ok === false && criar.motivo === 'GRAVACAO_BLOQUEADA', criar.motivo);
    const situacao = (await consulta(`SELECT S.CODIGO, L.NUFIN_SANKHYA, L.NUNOTA_SANKHYA, L.ENVIANDO_DESDE FROM LANCAMENTOS L JOIN STATUS_LANCAMENTO S ON S.ID = L.STATUS_ID WHERE L.ID = ${Number(l.lancamentoId)}`))[0];
    conf('lancamento nao mudou de situacao nem ganhou chave do ERP', situacao.CODIGO === l.status && !situacao.NUFIN_SANKHYA && !situacao.NUNOTA_SANKHYA && !situacao.ENVIANDO_DESDE, situacao.CODIGO);
    conf('ERP_ENVIO terminou igual', (await contar()) === antes, `${antes} linhas`);
    const leitura = await ex('erpVerificarConexao', {});
    conf('leitura do ERP segue funcionando', leitura.configurada === true && leitura.empresas > 0, leitura.erro ?? `${leitura.empresas} empresas`);
  } finally {
    await limparLancamento(l.lancamentoId);
  }
} else {
  console.log('\nINFO parte D nao executada: rode com --vivo depois de publicar.');
}
encerrar('Bloqueio de gravacao no ERP');
