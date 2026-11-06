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
import { conf, encerrar, totalFalhas, sdk, projectId, consulta, ex, cnpjFicticio, criarLancamentoTeste, limparLancamento, abrirIsolamento } from './lib/smoke.mjs';
import { JS_COM_ERP, SQL_ALTERADAS, codigoEsperado } from './fase0/funcoes.mjs';
import { ler as lerErp } from './auditoria/leitura.mjs';

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
conf('gravacao ligada so para titulo financeiro', /^const GRAVACAO_ERP_HABILITADA = true;$/m.test(erpJs) && /^const ENTIDADES_GRAVAVEIS = \['Financeiro'\];$/m.test(erpJs));
conf('correcao de cadastro desligada', /^const CORRECAO_CADASTRO_HABILITADA = false;$/m.test(erpJs));
conf('trava temporaria de criacao de nota desligada', /^const CRIACAO_NOTA_HABILITADA = false;$/m.test(erpJs));
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
conf('tela nao oferece correcao de cadastro', /CORRECAO_CADASTRO_LIBERADA = false/.test(ler('frontend/src/hooks/useEnvioErp.ts')));
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
  if (/MOTIVO/.test(sql)) { colunas = ['NUNOTA', 'NUMNOTA', 'SERIENOTA', 'CODTIPOPER', 'STATUSNOTA', 'MOTIVO']; dados = []; }
  else if (/FROM TGFPAP/.test(sql)) { colunas = ['CODPARC', 'CODPROPARC', 'CODPROD']; dados = [[10, 'ABC-1', 500]]; }
  else if (/FROM TGFPRO WHERE/.test(sql)) { colunas = ['CODPROD', 'REFFORN', 'REFERENCIA']; dados = []; }
  else if (/FROM TGFVAR V/.test(sql)) { colunas = ['NUNOTAORIG', 'SEQUENCIAORIG', 'NUNOTA', 'SEQUENCIA', 'QTDATENDIDA', 'NUMNOTA', 'CODTIPOPER', 'STATUSNOTA', 'DTNEG']; dados = []; }
  else if (/FROM TGFCAB C JOIN TGFITE I/.test(sql)) {
    colunas = ['NUNOTA', 'NUMNOTA', 'CODEMP', 'CODPARC', 'DTNEG', 'CODTIPOPER', 'STATUSNOTA', 'SEQUENCIA', 'CODPROD', 'DESCRPROD', 'QTDNEG', 'QTDENTREGUE', 'VLRUNIT', 'CODVOL', 'PENDENTE'];
    dados = [[2001, 55, 1, 10, '2026-01-01', 1314, 'L', 1, 500, 'Produto', 10, 0, 10, 'UN', 'S']];
  } else if (/FROM TGFPAR/.test(sql)) { colunas = ['CODPARC', 'NOMEPARC', 'RAZAOSOCIAL', 'CGC_CPF', 'FORNECEDOR', 'CLIENTE', 'ATIVO']; dados = [[10, 'P', 'Parceiro', '11222333000181', 'S', 'N', 'S']]; }
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
      if (respostas.__falhaRede) throw new Error('ECONNRESET: conexão com o ERP caiu');
      if (o.body && o.body.serviceName === LEITURA) return (respostas.__erp && respostas.__erp(o.body.requestBody.sql)) || linhasErp(o.body.requestBody.sql);
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
const respostasEnvio = (o) => ({ podeEnviarErp: async () => ({ rows: [{ PODE: 1 }] }), erpDadosEnvio: async () => ({ rows: [dadosEnvio(o)] }) });

// O bloco B prova as travas: roda com a gravacao desligada EM MEMORIA, como no recuo de emergencia.
// A liberacao real tem bloco proprio, sobre o codigo publicado (codEnviarReal).
const desligada = (c) => { const n = c.replace('const GRAVACAO_ERP_HABILITADA = true;', 'const GRAVACAO_ERP_HABILITADA = false;'); if (n === c) throw new Error('nao achei a liberacao no codigo'); return n; };
const codEnviarReal = await codigoEsperado('enviarLancamentoParaErp');
const codEnviar = desligada(codEnviarReal);
const codCorrigir = await codigoEsperado('corrigirCadastroErp');
const codConferir = desligada(await codigoEsperado('conferirNfePedidos'));
const adaptador = desligada(await montarJS('sf/_comum.js', 'sf/_erp.js'));

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
{
  const a = ambiente(respostasEnvio({ DESTINO_ERP: 'NOTA' }));
  const r = await a.rodar(codEnviar, { lancamentoId: 1 });
  conf('nota no envio real recusa com GRAVACAO_BLOQUEADA, sem rede', r.ok === false && r.motivo === 'GRAVACAO_BLOQUEADA' && a.rede.length === 0, r.motivo);
}
{
  const a = ambiente({ ...respostasEnvio({ DESTINO_ERP: 'NOTA' }), conferirNfePedidos: async () => ({ ok: true, origem: 'teste', resultado: { situacao: 'PEDIDO_UNICO', resumo: 'Todos os itens correspondem ao mesmo pedido.' } }) });
  const r = await a.rodar(codEnviar, { lancamentoId: 1, simular: 'S' });
  conf('nota na conferencia vai para a correspondencia com pedidos', r.ok === true && r.simulado === true && r.entidade === 'CorrespondenciaPedido' && r.correspondencia.situacao === 'PEDIDO_UNICO', r.motivo ?? r.entidade);
  conf('conferencia de nota nao reserva, nao registra envio e o envio nao chama a rede', a.rede.length === 0 && !a.sfs.some((x) => /erpReservarEnvio|erpRegistrarEnvio|erpConcluirEnvio/.test(x.nome)));
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
    podeConferirNfe: async () => ({ rows: [{ PODE: 1 }] }),
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
    const nome = nomePorId.get(o.serverFunctionId);
    if (nome === 'enviarLancamentoParaErp' || nome === 'conferirNfePedidos') {
      a.sfs.push({ nome, input: o.input });
      return { result: { executionStatus: 'COMPLETED', output: await a.rodar(nome === 'enviarLancamentoParaErp' ? codEnvio : codConferir, o.input) } };
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
  conf('nota lida pelo robo e conferida com pedidos e vira NOTA_PEDIDO', anexos.length === 1 && anexos[0].decisao === 'NOTA_PEDIDO' && /conferida com os pedidos/.test(anexos[0].motivo), anexos[0]?.motivo);
  conf('nota lida pelo robo so consulta o ERP', a.gravacoes().length === 0 && a.sfs.some((x) => x.nome === 'conferirNfePedidos'));
}


// Liberacao real: titulo grava; o resto continua parado. Tudo com a rede simulada.
{
  const a = ambiente(respostasEnvio());
  const r = await a.rodar(codEnviarReal, { lancamentoId: 1 });
  conf('liberado: titulo com perfil grava uma vez, so Financeiro', r.ok === true && a.gravacoes().length === 1 && a.gravacoes()[0].body.requestBody.dataSet.rootEntity === 'Financeiro', r.motivo);
}
{
  const a = ambiente({ ...respostasEnvio(), podeEnviarErp: async () => ({ rows: [{ PODE: 0 }] }) });
  const r = await a.rodar(codEnviarReal, { lancamentoId: 1 });
  conf('liberado: sem perfil recusa, sem gravar', r.motivo === 'SEM_PERMISSAO' && a.gravacoes().length === 0, r.motivo);
}
{
  const a = ambiente(respostasEnvio());
  const r = await a.rodar(codEnviarReal, { lancamentoId: 1, simular: 'S' });
  conf('liberado: conferir nao grava', r.simulado === true && a.gravacoes().length === 0, r.motivo);
}
{
  const a = ambiente(respostasEnvio({ DESTINO_ERP: 'NOTA' }));
  const r = await a.rodar(codEnviarReal, { lancamentoId: 1 });
  conf('liberado: nota continua sem gravar', r.motivo === 'CRIACAO_NOTA_BLOQUEADA' && a.gravacoes().length === 0, r.motivo);
}
{
  const a = ambiente();
  const sonda = `${await montarJS('sf/_comum.js', 'sf/_erp.js')}
    const out = {};
    for (const e of ['Parceiro', 'CabecalhoNota', 'ItemNota', 'Outra']) { try { await erpSalvar(e, { CODEMP: 1 }, 'X'); out[e] = 'PASSOU'; } catch (x) { out[e] = x.codigo; } }
    try { await erpChamar('ServicoQualquer.confirmarNota', {}); out.c = 'PASSOU'; } catch (x) { out.c = x.codigo; }
    return out;`;
  const r = await a.rodar(sonda);
  conf('liberado: porta unica recusa o que nao e titulo e a confirmacao', r.Parceiro === 'ENTIDADE_NAO_LIBERADA' && r.Outra === 'ENTIDADE_NAO_LIBERADA' && r.CabecalhoNota === 'CRIACAO_NOTA_BLOQUEADA' && r.ItemNota === 'CRIACAO_NOTA_BLOQUEADA' && r.c === 'CONFIRMACAO_PROIBIDA' && a.gravacoes().length === 0, JSON.stringify(r));
}

// B7. Prova inversa: as travas sao independentes e o teste enxerga gravacao.
const ligada = (c) => { const n = c.replace('const GRAVACAO_ERP_HABILITADA = false;', 'const GRAVACAO_ERP_HABILITADA = true;'); if (n === c) throw new Error('nao achei a trava no codigo'); return n; };
const ambasLigadas = (c) => { const n = ligada(c).replace('const CRIACAO_NOTA_HABILITADA = false;', 'const CRIACAO_NOTA_HABILITADA = true;'); if (n === ligada(c)) throw new Error('nao achei a trava de nota'); return n; };
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
  conf('com a trava geral ligada, a nota para na trava temporaria de criacao', r.motivo === 'CRIACAO_NOTA_BLOQUEADA' && a.gravacoes().length === 0, r.motivo);
}
{
  const a = ambiente(respostasEnvio({ DESTINO_ERP: 'NOTA' }));
  const r = await a.rodar(ambasLigadas(codEnviar), { lancamentoId: 1 });
  conf('com as duas travas ligadas, nota ainda nao tem caminho de gravacao (faturamento nao implementado)', r.motivo === 'FATURAMENTO_NAO_IMPLEMENTADO' && a.gravacoes().length === 0, r.motivo);
}
{
  const a = ambiente();
  const sonda = `${ligada(adaptador)}
    const out = {};
    for (const e of ['CabecalhoNota', 'ItemNota', 'Financeiro']) { try { await erpSalvar(e, { CODEMP: 1 }, e === 'Financeiro' ? 'NUFIN' : 'NUNOTA'); out[e] = 'PASSOU'; } catch (x) { out[e] = x.codigo || msgErro(x); } }
    return out;`;
  const r = await a.rodar(sonda);
  conf('na porta unica, nota para na trava de criacao mesmo com a geral ligada', r.CabecalhoNota === 'CRIACAO_NOTA_BLOQUEADA' && r.ItemNota === 'CRIACAO_NOTA_BLOQUEADA', JSON.stringify(r));
  conf('prova inversa: o titulo passa com a geral ligada e o teste enxerga', r.Financeiro === 'PASSOU' && a.gravacoes().length === 1);
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

// B8. Conferencia de NF-e com pedidos: so le, mesmo com entrada hostil.
const SF_LEITURA_CONFERENCIA = ['podeConferirNfe', 'erpDadosEnvio', 'keyArquivoDocumento', 'listarItensLancamento', 'roboEmpresas'];
const xmlNfe = (itens, extra = '') => `<?xml version="1.0"?><nfeProc><NFe><infNFe Id="NFe35260111222333000181550010000000011123456789"><ide><nNF>1${extra}</nNF><serie>1</serie><dhEmi>2026-01-10T10:00:00-03:00</dhEmi></ide><emit><CNPJ>11222333000181</CNPJ><xNome>F</xNome></emit><dest><CNPJ>11444777000161</CNPJ></dest>${itens.map((i, k) => `<det nItem="${k + 1}"><prod><cProd>${i.c}</cProd><cEAN>${i.ean ?? 'SEM GTIN'}</cEAN><xProd>Item</xProd><uCom>UN</uCom><qCom>${i.q ?? 10}</qCom><vUnCom>${i.v ?? 10}</vUnCom><vProd>100</vProd></prod></det>`).join('')}<total><ICMSTot><vNF>100</vNF></ICMSTot></total></infNFe></NFe></nfeProc>`;
const respConferencia = (o = {}) => ({ podeConferirNfe: async () => ({ rows: [{ PODE: 1 }] }), roboEmpresas: async () => ({ rows: [{ ID: 1, CODEMP: 1, NOME: 'Empresa', CNPJ: '11444777000161' }] }), ...o });
const so = (a) => a.sfs.every((x) => SF_LEITURA_CONFERENCIA.includes(x.nome));
{
  const a = ambiente(respConferencia({ podeConferirNfe: async () => ({ rows: [{ PODE: 0 }] }) }));
  const r = await a.rodar(codConferir, { nome: 'n.xml', conteudoB64: Buffer.from(xmlNfe([{ c: 'ABC-1' }])).toString('base64') });
  conf('conferencia sem permissao recusa antes de ler o ERP', r.ok === false && a.rede.length === 0);
}
{
  const a = ambiente(respConferencia());
  const r = await a.rodar(codConferir, { nome: 'n.xml', conteudoB64: Buffer.from(xmlNfe([{ c: 'ABC-1' }])).toString('base64') });
  conf('conferencia de XML encontra o pedido pelo de-para', r.ok === true && r.resultado.situacao === 'PEDIDO_UNICO' && r.resultado.pedidos[0].NUNOTA === 2001, r.erro ?? r.resultado?.situacao);
  conf('conferencia de XML: so leituras no ERP e so funcoes de leitura aqui', a.gravacoes().length === 0 && a.rede.every((x) => x.body.serviceName === LEITURA) && so(a), a.sfs.map((x) => x.nome).join(','));
}
{
  const hostis = [{ c: "X' OR '1'='1" }, { c: "Y'); DELETE FROM TGFCAB --" }, { c: 'Z/* comentario */' }, { c: 'W;DROP TABLE ZZ_PROBE' }, { c: 'A'.repeat(300) }, { c: '', ean: "789' OR 1=1" }];
  const a = ambiente(respConferencia());
  const r = await a.rodar(codConferir, { nome: 'n.xml', conteudoB64: Buffer.from(xmlNfe(hostis, " OR 1=1")).toString('base64') });
  const sqls = a.rede.map((x) => x.body.requestBody.sql);
  const fora = sqls.map((q) => q.replace(/'(?:[^']|'')*'/g, "''")).filter((q) => /\b(DELETE|DROP|OR\s+'?1'?\s*=)|;|--|\/\*/i.test(q));
  conf('XML hostil: a consulta segue so leitura e nada escapa das aspas', r.ok === true && sqls.length > 0 && fora.length === 0 && a.gravacoes().length === 0, fora[0] ?? r.erro ?? '');
}
{
  const a = ambiente(respConferencia({ ...respostasEnvio(), listarItensLancamento: async () => ({ rows: [{ DESCRICAO: 'Item', QUANTIDADE: 10, VALOR_UNITARIO: 10, CODPROD: 500 }] }) }));
  const r = await a.rodar(codConferir, { lancamentoId: 1 });
  conf('conferencia pelo lancamento sem XML usa o produto informado', r.ok === true && /sem XML/.test(r.origem) && r.resultado.itens[0].identificacao.fonte === 'INFORMADO' && r.resultado.situacao === 'PEDIDO_UNICO', r.erro ?? r.resultado?.situacao);
  conf('conferencia pelo lancamento: so leituras', a.gravacoes().length === 0 && so(a));
}
{
  const a = ambiente(respConferencia());
  const r = await a.rodar(ambasLigadas(codConferir), { nome: 'n.xml', conteudoB64: Buffer.from(xmlNfe([{ c: 'ABC-1' }])).toString('base64') });
  conf('conferencia nao grava nem com as duas travas ligadas em memoria', r.ok === true && a.gravacoes().length === 0);
}

// B9. Falha de conexao, duplicidade e classificacao, sem rede
const erpCom = (re, colunas, dados) => (sql) => (re.test(sql) ? { statusCode: 200, body: { status: '1', responseBody: { fieldsMetadata: colunas.map((name) => ({ name })), rows: dados } } } : null);
{
  const a = ambiente({ ...respConferencia(), __falhaRede: true });
  const r = await a.rodar(codConferir, { nome: 'n.xml', conteudoB64: Buffer.from(xmlNfe([{ c: 'ABC-1' }])).toString('base64') });
  conf('B9 falha de conexao na conferencia: erro claro, sem resultado parcial', r.ok === false && /consultar o ERP/.test(r.erro) && !r.resultado, r.erro);
  const b = ambiente({ ...respostasEnvio(), __falhaRede: true });
  const s2 = await b.rodar(codEnviar, { lancamentoId: 1, simular: 'S' });
  conf('B9 falha de conexao no envio: recusa, sem afirmar que esta livre', s2.ok === false && b.gravacoes().length === 0, s2.motivo);
}
{
  const a = ambiente({ ...respConferencia(), __erp: erpCom(/MOTIVO/, ['NUNOTA', 'NUMNOTA', 'SERIENOTA', 'CODTIPOPER', 'STATUSNOTA', 'MOTIVO'], [[777, 1, '1', 1419, 'L', 'CHAVE']]) });
  const r = await a.rodar(codConferir, { nome: 'n.xml', conteudoB64: Buffer.from(xmlNfe([{ c: 'ABC-1' }])).toString('base64') });
  conf('B9 conferencia de nota ja lancada: INCOMPATIVEL com a nota existente', r.ok === true && r.resultado.classificacao === 'INCOMPATIVEL' && r.resultado.duplicidade[0].NUNOTA === 777 && a.gravacoes().length === 0, r.resultado?.classificacao);
}
{
  const a = ambiente(respConferencia());
  const r = await a.rodar(codConferir, { nome: 'n.xml', conteudoB64: Buffer.from(xmlNfe([{ c: 'ABC-1' }])).toString('base64') });
  conf('B9 conferencia devolve classificacao e justificativa', ['SEGURA', 'INCOMPATIVEL'].includes(r.resultado.classificacao) && Boolean(r.resultado.justificativa) && Array.isArray(r.resultado.intervencaoHumana), r.resultado.classificacao);
}
{
  const a = ambiente({ ...respostasEnvio(), __erp: erpCom(/AS CHAVE FROM/, ['CHAVE'], [['12345']]) });
  const r = await a.rodar(codEnviar, { lancamentoId: 1, simular: 'S' });
  conf('B9 titulo ja existente no ERP e barrado antes de montar', r.ok === false && r.motivo === 'DUPLICADO_ERP' && a.gravacoes().length === 0, r.motivo);
}
{
  const a = ambiente(respostasEnvio({ DESTINO_ERP: 'NOTA' }));
  const r = await a.rodar(codEnviar, { lancamentoId: 1 });
  conf('B9 tentativa de gravacao de nota: bloqueada, sem chamada de escrita', r.ok === false && r.motivo === 'GRAVACAO_BLOQUEADA' && a.gravacoes().length === 0, r.motivo);
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
conf('toda SF com o adaptador so libera titulo financeiro', comAdaptador.every(([, p]) => /^const ENTIDADES_GRAVAVEIS = \['Financeiro'\];$/m.test(p.code) && /^const CRIACAO_NOTA_HABILITADA = false;$/m.test(p.code) && /^const CORRECAO_CADASTRO_HABILITADA = false;$/m.test(p.code)));
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
  const iso = await abrirIsolamento();
  const l = await criarLancamentoTeste({ cnpj: cnpjFicticio(), tipoCodigo: 'BOLETO', valor: 1.23 });
  try {
    // Sem envio real aqui: a gravacao esta ligada e este teste nunca toca a producao.
    const corrigir = await ex('corrigirCadastroErp', { lancamentoId: l.lancamentoId, acao: 'MARCAR_FORNECEDOR', codparc: 0 });
    conf('correcao de cadastro publicada recusa', corrigir.ok === false && corrigir.motivo === 'GRAVACAO_BLOQUEADA', corrigir.motivo);
    const criar = await ex('corrigirCadastroErp', { lancamentoId: l.lancamentoId, acao: 'CRIAR_PARCEIRO' });
    conf('criar parceiro publicado recusa', criar.ok === false && criar.motivo === 'GRAVACAO_BLOQUEADA', criar.motivo);
    const situacao = (await consulta(`SELECT S.CODIGO, L.NUFIN_SANKHYA, L.NUNOTA_SANKHYA, L.ENVIANDO_DESDE FROM LANCAMENTOS L JOIN STATUS_LANCAMENTO S ON S.ID = L.STATUS_ID WHERE L.ID = ${Number(l.lancamentoId)}`))[0];
    conf('lancamento nao mudou de situacao nem ganhou chave do ERP', situacao.CODIGO === l.status && !situacao.NUFIN_SANKHYA && !situacao.NUNOTA_SANKHYA && !situacao.ENVIANDO_DESDE, situacao.CODIGO);
    conf('ERP_ENVIO terminou igual', (await contar()) === antes, `${antes} linhas`);
    const leitura = await ex('erpVerificarConexao', {});
    conf('leitura do ERP segue funcionando', leitura.configurada === true && leitura.empresas > 0, leitura.erro ?? `${leitura.empresas} empresas`);

    // Conferencia de NF-e publicada, com dados reais e so leitura. O XML e montado em memoria e descartado.
    const contarLocais = async () => JSON.stringify(await consulta('SELECT (SELECT COUNT(*) FROM LANCAMENTOS) AS L, (SELECT COUNT(*) FROM DOCUMENTOS) AS D, (SELECT COUNT(*) FROM ERP_ENVIO) AS E, (SELECT COUNT(*) FROM APROVADORES) AS A'));
    const locaisAntes = await contarLocais();
    const hoje = new Date().toISOString().slice(0, 10);
    const metaLeitura = { objetivo: 'Teste ao vivo da conferencia', origem: 'TGFCAB, TGFITE, TGFPAP, TGFPAR, TSIEMP', periodo: hoje, filtros: 'um caso real' };
    const pend = (await lerErp(`SELECT * FROM (SELECT C.NUNOTA, I.SEQUENCIA, I.CODPROD, I.QTDNEG, I.QTDENTREGUE, I.VLRUNIT, I.CODVOL, A.CODPROPARC, P.CGC_CPF, E.CGC
      FROM TGFCAB C JOIN TGFITE I ON I.NUNOTA = C.NUNOTA JOIN TGFPAP A ON A.CODPARC = C.CODPARC AND A.CODPROD = I.CODPROD JOIN TGFPAR P ON P.CODPARC = C.CODPARC JOIN TSIEMP E ON E.CODEMP = C.CODEMP
      WHERE C.CODTIPOPER = 1314 AND I.PENDENTE = 'S' AND I.QTDNEG > I.QTDENTREGUE AND P.ATIVO = 'S' AND C.DTNEG <= TO_DATE('${hoje}','YYYY-MM-DD') ORDER BY C.NUNOTA DESC) WHERE ROWNUM <= 1`, metaLeitura))[0];
    const xmlReal = (cnpjEmit, cnpjDest, itemXml, chave = '35260111222333000181550010000000011123456789') => `<?xml version="1.0"?><nfeProc><NFe><infNFe Id="NFe${chave}"><ide><nNF>999999991</nNF><serie>1</serie><dhEmi>${hoje}T10:00:00-03:00</dhEmi></ide><emit><CNPJ>${cnpjEmit}</CNPJ><xNome>Teste</xNome></emit><dest><CNPJ>${cnpjDest}</CNPJ></dest>${itemXml}<total><ICMSTot><vNF>1.00</vNF></ICMSTot></total></infNFe></NFe></nfeProc>`;
    if (pend) {
      const itemXml = `<det nItem="1"><prod><cProd>${pend.CODPROPARC}</cProd><cEAN>SEM GTIN</cEAN><xProd>Teste</xProd><uCom>${pend.CODVOL}</uCom><qCom>1.0000</qCom><vUnCom>${pend.VLRUNIT}</vUnCom><vProd>${pend.VLRUNIT}</vProd></prod></det>`;
      const c = await ex('conferirNfePedidos', { nome: 'teste.xml', conteudoB64: Buffer.from(xmlReal(pend.CGC_CPF, pend.CGC, itemXml)).toString('base64') });
      const res = c.resultado;
      conf('pedido pendente real e encontrado pelo de-para', c.ok === true && res.pedidos.some((p) => Number(p.NUNOTA) === Number(pend.NUNOTA)) && res.itens[0].identificacao.fonte === 'TGFPAP', c.erro ?? res?.situacao);
      const lin = res?.itens[0]?.linhas.find((x) => Number(x.pedido) === Number(pend.NUNOTA) && Number(x.sequencia) === Number(pend.SEQUENCIA));
      conf('quantidades e preco vem do ERP', !!lin && Number(lin.negociada) === Number(pend.QTDNEG) && Number(lin.entregue) === Number(pend.QTDENTREGUE) && Number(lin.pendente) === Number(pend.QTDNEG) - Number(pend.QTDENTREGUE) && !lin.divergencias.includes('PRECO_DIFERENTE'), lin ? `${lin.negociada}/${lin.entregue}/${lin.pendente}` : 'sem linha');
    } else {
      console.log('INFO sem pedido pendente com de-para hoje: teste do pedido real nao exercitado.');
    }
    const nota = (await lerErp(`SELECT * FROM (SELECT C.NUNOTA, C.CHAVENFE, P.CGC_CPF, E.CGC FROM TGFCAB C JOIN TGFPAR P ON P.CODPARC = C.CODPARC JOIN TSIEMP E ON E.CODEMP = C.CODEMP WHERE C.CODTIPOPER = 1419 AND C.CHAVENFE IS NOT NULL AND P.ATIVO = 'S' AND C.DTNEG <= TO_DATE('${hoje}','YYYY-MM-DD') ORDER BY C.NUNOTA DESC) WHERE ROWNUM <= 1`, metaLeitura))[0];
    if (nota) {
      const d = await ex('conferirNfePedidos', { nome: 'teste.xml', conteudoB64: Buffer.from(xmlReal(nota.CGC_CPF, nota.CGC, '<det nItem="1"><prod><cProd>SEM-ESTE-CODIGO</cProd><xProd>Teste</xProd><uCom>UN</uCom><qCom>1</qCom><vUnCom>1</vUnCom><vProd>1</vProd></prod></det>', nota.CHAVENFE)).toString('base64') });
      conf('nota ja existente e apontada como duplicidade pela chave', d.ok === true && d.resultado.duplicidade.some((x) => x.motivo === 'CHAVE' && Number(x.NUNOTA) === Number(nota.NUNOTA)) && d.resultado.alertas.some((a) => a.tipo === 'JA_EXISTE_NO_ERP'), d.erro ?? '');
    }
    const pelaTela = await ex('conferirNfePedidos', { lancamentoId: l.lancamentoId });
    conf('conferencia pelo lancamento responde', pelaTela.ok === true && ['SEM_FORNECEDOR', 'SEM_ITENS', 'PRODUTOS_NAO_IDENTIFICADOS'].includes(pelaTela.resultado.situacao), pelaTela.erro ?? pelaTela.resultado?.situacao);
    conf('conferencia nao grava neste sistema nem no registro de envios', (await contarLocais()) === locaisAntes);
  } finally {
    await limparLancamento(l.lancamentoId);
    await iso.fechar();
  }
} else {
  console.log('\nINFO parte D nao executada: rode com --vivo depois de publicar.');
}
encerrar('Bloqueio de gravacao no ERP');

