// Apoio comum das SFs JavaScript. Fica em arquivo e e concatenado por lib/base.mjs.
const sdk = require('mitra-sdk');
const PROJECT_ID = Number(process.env.MITRA_PROJECT_ID);
const SF = {"souAdministrador":113,"sankhyaEmpresas":97,"upsertEmpresas":104,"sankhyaTops":98,"upsertTops":105,"sankhyaNaturezas":99,"upsertNaturezas":106,"sankhyaCentros":100,"upsertCentros":107,"sankhyaContas":101,"upsertContas":108,"sankhyaTiposTitulo":102,"upsertTiposTitulo":109,"codigosCadastroExistentes":110,"registrarSincronizacao":111};
let __contador = 0;

function msgErro(e) {
  if (e == null) return 'Erro desconhecido';
  if (typeof e === 'string') return e;
  if (typeof e.message === 'string' && e.message) return e.message;
  if (e.message && typeof e.message === 'object') return msgErro(e.message);
  if (e.error) return msgErro(e.error);
  try { return JSON.stringify(e); } catch (_) { return String(e); }
}

// Toda chamada interna leva o proprio nonce. Falha da SF chamada vira excecao,
// nunca resultado vazio.
async function chamar(id, input) {
  const r = await sdk.executeServerFunctionMitra({
    projectId: PROJECT_ID,
    serverFunctionId: id,
    input: Object.assign({}, input || {}, { _nonce: Date.now() + '-' + ++__contador }),
  });
  const res = r && r.result ? r.result : {};
  if (res.executionStatus === 'FAILED') throw new Error(msgErro(res.error) || 'Falha ao executar a funcao ' + id);
  let out = res.output;
  if (typeof out === 'string') { try { out = JSON.parse(out); } catch (_) { /* mantem texto */ } }
  return out;
}
const linhas = (out) => (out && Array.isArray(out.rows) ? out.rows : []);
async function listar(id, input) { return linhas(await chamar(id, input)); }
async function uma(id, input) { return (await listar(id, input))[0] || null; }
async function afetou(id, input) { const o = await chamar(id, input); return Number((o && o.affectedRows) || 0); }
const paraB64 = (texto) => Buffer.from(String(texto == null ? '' : texto), 'utf8').toString('base64');
const soDigitos = (v) => String(v == null ? '' : v).replace(/\D/g, '');
const inteiro = (v) => { const n = parseInt(String(v), 10); return Number.isFinite(n) ? n : 0; };
const texto = (v, max) => String(v == null ? '' : v).slice(0, max || 500);


// Adaptador do ERP. O slug e o unico contrato entre o codigo e o Sankhya do cliente:
// URL, usuario e schema ficam na conexao, nunca aqui.
const SLUG_ERP = 'sankhya';
const EP_CONSULTA = '/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json';
const EP_SALVAR = '/gateway/v1/mge/service.sbr?serviceName=CRUDServiceProvider.saveRecord&outputType=json';

// O ERP devolve HTTP 200 mesmo recusando: o erro vem em statusMessage, sem responseBody.
function lerResposta(r) {
  const http = Number(r && r.statusCode);
  const b = r && r.body;
  if (http >= 400) {
    const detalhe = b && (b.message || b.error || b.statusMessage);
    throw new Error('O ERP respondeu HTTP ' + http + (detalhe ? ': ' + msgErro(detalhe) : ''));
  }
  if (!b || String(b.status) !== '1') {
    throw new Error((b && msgErro(b.statusMessage)) || 'O ERP nao confirmou a operacao.');
  }
  return b;
}

function linhasDoErp(body) {
  const rb = body.responseBody;
  if (!rb || !Array.isArray(rb.fieldsMetadata)) throw new Error(msgErro(body.statusMessage) || 'O ERP respondeu sem corpo.');
  const cols = rb.fieldsMetadata.map((f) => f.name);
  return (rb.rows || []).map((l) => { const o = {}; cols.forEach((c, i) => { o[c] = l[i]; }); return o; });
}

async function erpConsulta(sql) {
  const r = await sdk.callIntegrationMitra({
    projectId: PROJECT_ID, connection: SLUG_ERP, method: 'POST', endpoint: EP_CONSULTA,
    body: { serviceName: 'DbExplorerSP.executeQuery', requestBody: { sql } },
  });
  return linhasDoErp(lerResposta(r));
}

// Le o resultado de uma SF INTEGRATION de cadastro.
function linhasDaIntegracao(out) {
  return linhasDoErp(lerResposta(out));
}

// CRUDServiceProvider: o servico aplica numeracao, validacao fiscal e defaults.
// Exige status 1 E a chave devolvida; confiar so no HTTP diria "enviado" para o que nao entrou.
async function erpSalvar(entidade, campos, campoChave, chave) {
  const localFields = {};
  for (const k of Object.keys(campos)) {
    if (campos[k] !== null && campos[k] !== undefined && campos[k] !== '') localFields[k] = { $: String(campos[k]) };
  }
  const dataRow = { localFields };
  if (chave) { dataRow.key = {}; dataRow.key[campoChave.split(',')[0]] = { $: String(chave) }; }
  const r = await sdk.callIntegrationMitra({
    projectId: PROJECT_ID, connection: SLUG_ERP, method: 'POST', endpoint: EP_SALVAR,
    body: {
      serviceName: 'CRUDServiceProvider.saveRecord',
      requestBody: { dataSet: { rootEntity: entidade, includePresentationFields: 'N', dataRow, entity: { fieldset: { list: campoChave } } } },
    },
  });
  const b = lerResposta(r);
  const ent = b.responseBody && b.responseBody.entities && b.responseBody.entities.entity;
  const principal = campoChave.split(',')[0];
  const valor = ent && ent[principal] && ent[principal].$;
  if (!valor && !chave) throw new Error('O ERP aceitou o pedido, mas nao devolveu a chave de ' + entidade + '.');
  return String(valor || chave);
}

// Valores que entram no SQL do ERP: so formato fechado, validado aqui.
function sqlTextoBusca(v) {
  const limpo = String(v == null ? '' : v).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 &.\-/]/g, ' ').replace(/\s+/g, ' ').trim();
  return limpo.slice(0, 60);
}
function dataErp(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? m[3] + '/' + m[2] + '/' + m[1] : '';
}
const ehErroCredencial = (m) => /PREENCHER|401|403|n[aã]o autorizado|unauthor|invalid_client|Authentication failed/i.test(String(m || ''));

// Parceiro: CNPJ exato, nunca LIKE. Fornecedor tem preferencia; sobrando mais de um, o sistema para.
async function parceirosPorCnpj(cnpj) {
  const d = soDigitos(cnpj);
  if (d.length !== 11 && d.length !== 14) return [];
  return erpConsulta(
    "SELECT CODPARC, NOMEPARC, RAZAOSOCIAL, CGC_CPF, FORNECEDOR, CLIENTE, ATIVO FROM TGFPAR WHERE CGC_CPF = '" + d + "' AND ATIVO = 'S' ORDER BY CODPARC",
  );
}


const adm = await uma(SF.souAdministrador, {});
if (!adm || Number(adm.ADMIN) !== 1) return { ok: false, erro: 'Somente o administrador pode sincronizar com o ERP.' };

const MOV = { C: 'Compra', V: 'Venda', D: 'Devolução de venda', E: 'Devolução de compra', I: 'Interno / financeiro', P: 'Pedido de compra', O: 'Pedido de venda', J: 'Requisição', T: 'Transferência', L: 'Lançamento', Z: 'Outros', Q: 'Requisição', F: 'Produção' };
const sn = (v) => (String(v).toUpperCase() === 'S' ? 1 : 0);
const CARGAS = [
  { nome: 'EMPRESAS', ler: SF.sankhyaEmpresas, gravar: SF.upsertEmpresas, cod: 'CODEMP', map: (r) => ({ cod: r.CODEMP, desc: r.NOMEFANTASIA || r.RAZAOSOCIAL, cnpj: soDigitos(r.CGC) }) },
  { nome: 'TOPS', ler: SF.sankhyaTops, gravar: SF.upsertTops, cod: 'CODTIPOPER', map: (r) => ({ cod: r.CODTIPOPER, desc: r.DESCROPER, ativo: sn(r.ATIVO), tipmov: r.TIPMOV, movimento: MOV[r.TIPMOV] || r.TIPMOV, atualFin: r.ATUALFIN }) },
  { nome: 'NATUREZAS', ler: SF.sankhyaNaturezas, gravar: SF.upsertNaturezas, cod: 'CODNAT', map: (r) => ({ cod: r.CODNAT, desc: r.DESCRNAT, ativo: sn(r.ATIVA) }) },
  { nome: 'CENTROS', ler: SF.sankhyaCentros, gravar: SF.upsertCentros, cod: 'CODCENCUS', map: (r) => ({ cod: r.CODCENCUS, desc: r.DESCRCENCUS, ativo: sn(r.ATIVO) }) },
  { nome: 'CONTAS', ler: SF.sankhyaContas, gravar: SF.upsertContas, cod: 'CODCTABCOINT', map: (r) => ({ cod: r.CODCTABCOINT, desc: r.DESCRICAO, banco: r.CODBCO == null ? '' : 'Banco ' + r.CODBCO, ativo: sn(r.ATIVA) }) },
  { nome: 'TIPOS_TITULO', ler: SF.sankhyaTiposTitulo, gravar: SF.upsertTiposTitulo, cod: 'CODTIPTIT', map: (r) => ({ cod: r.CODTIPTIT, desc: r.DESCRTIPTIT, ativo: sn(r.ATIVO) }) },
];

const existentes = {};
for (const r of await listar(SF.codigosCadastroExistentes, {})) {
  (existentes[r.T] = existentes[r.T] || new Set()).add(String(r.C));
}

const resultado = [];
for (const c of CARGAS) {
  try {
    const lidos = linhasDaIntegracao(await chamar(c.ler, {}));
    if (!lidos.length) throw new Error('O ERP não devolveu nenhuma linha. Nada foi alterado.');
    // TGFTOP pode empatar em DHALTER: o codigo natural manda.
    const porCodigo = new Map();
    for (const r of lidos) porCodigo.set(String(r[c.cod]), c.map(r));
    const lista = [...porCodigo.values()];
    for (let i = 0; i < lista.length; i += 100) {
      await chamar(c.gravar, { linhas: paraB64(JSON.stringify(lista.slice(i, i + 100))) });
    }
    const jaTinha = existentes[c.nome] || new Set();
    const novos = lista.filter((x) => !jaTinha.has(String(x.cod))).length;
    const atualizados = lista.length - novos;
    await chamar(SF.registrarSincronizacao, { cadastro: c.nome, lidos: lidos.length, novos, atualizados, total: lista.length });
    resultado.push({ cadastro: c.nome, ok: true, lidos: lidos.length, novos, atualizados });
  } catch (e) {
    const m = msgErro(e);
    resultado.push({ cadastro: c.nome, ok: false, erro: m });
    if (ehErroCredencial(m)) return { ok: false, naoConfigurada: true, erro: 'Integração com o ERP não configurada: ' + m, resultado };
  }
}
return { ok: resultado.every((r) => r.ok), resultado };
