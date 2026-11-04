// Apoio comum das SFs JavaScript. Fica em arquivo e e concatenado por lib/base.mjs.
const sdk = require('mitra-sdk');
const PROJECT_ID = Number(process.env.MITRA_PROJECT_ID);
const SF = {};
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

// FASE 0 (modulo-documental/fase0-plano-execucao.md): gravacao no ERP desligada.
// Nenhum parametro de tela, de banco ou de input liga a gravacao: religar exige autorizacao
// escrita e uma mudanca revisada nesta linha, publicada de novo em todas as SFs que usam este arquivo.
const GRAVACAO_ERP_HABILITADA = false;
// Criacao de nota: proibicao TEMPORARIA, separada da trava geral. So religa com servico oficial
// homologado (V-01, V-03) e autorizacao explicita. O caminho previsto e faturar um pedido de compra
// existente e salvar a nota resultante NAO CONFIRMADA. Ligar esta linha nao libera confirmacao.
const CRIACAO_NOTA_HABILITADA = false;
const ENTIDADES_DE_NOTA = ['CabecalhoNota', 'ItemNota'];
// Unica porta de saida para o ERP. Servico fora desta lista nao sai, ligado ou desligado.
const SERVICOS_ERP = {
  'DbExplorerSP.executeQuery': { endpoint: EP_CONSULTA, leitura: true },
  'CRUDServiceProvider.saveRecord': { endpoint: EP_SALVAR, leitura: false },
};
// Regra PERMANENTE: o sistema nunca confirma nota. Vale com qualquer trava ligada.
const SERVICO_DE_CONFIRMACAO = /confirm/i;
// Defesa a mais na leitura: o texto entre aspas e ignorado (nome de parceiro pode conter "MERGE").
// Comentario e recusado porque esconderia uma aspa dessa conta e, com ela, um segundo comando.
const SQL_PROIBIDO_ERP = /\b(INSERT|UPDATE|DELETE|MERGE|CREATE|ALTER|DROP|TRUNCATE|RENAME|GRANT|REVOKE|EXEC|EXECUTE|BEGIN|DECLARE|CALL|COMMIT|ROLLBACK|SAVEPOINT|LOCK|DBMS_\w+|UTL_\w+)\b|\bFOR\s+UPDATE\b|;|--|\/\*/i;

function erroBloqueio(codigo, mensagem) {
  const e = new Error(mensagem);
  e.codigo = codigo;
  return e;
}
const ehBloqueioErp = (e) => !!e && ['GRAVACAO_BLOQUEADA', 'CONFIRMACAO_PROIBIDA', 'SERVICO_NAO_PERMITIDO', 'SQL_NAO_E_LEITURA', 'CRIACAO_NOTA_BLOQUEADA'].includes(e.codigo);

function exigirSqlDeLeitura(sql) {
  const semTexto = String(sql || '').replace(/'(?:[^']|'')*'/g, "''");
  if (!/^\s*(SELECT|WITH)\b/i.test(semTexto) || SQL_PROIBIDO_ERP.test(semTexto)) {
    throw erroBloqueio('SQL_NAO_E_LEITURA', 'Consulta ao ERP recusada: só SELECT, sem comando de gravação.');
  }
}

// Toda chamada ao ERP passa aqui. As travas vem antes de qualquer rede.
async function erpChamar(servico, requestBody) {
  if (SERVICO_DE_CONFIRMACAO.test(String(servico))) {
    throw erroBloqueio('CONFIRMACAO_PROIBIDA', 'Confirmar nota no ERP é exclusivo de uma pessoa, dentro do Sankhya. O sistema nunca confirma.');
  }
  const s = Object.prototype.hasOwnProperty.call(SERVICOS_ERP, servico) ? SERVICOS_ERP[servico] : null;
  if (!s) throw erroBloqueio('SERVICO_NAO_PERMITIDO', 'Serviço do ERP fora da lista permitida: ' + String(servico).slice(0, 80) + '.');
  if (!s.leitura && !GRAVACAO_ERP_HABILITADA) {
    throw erroBloqueio('GRAVACAO_BLOQUEADA', 'Gravação no ERP desligada nesta fase: nada foi enviado ao Sankhya.');
  }
  const entidade = requestBody && requestBody.dataSet && requestBody.dataSet.rootEntity;
  if (!s.leitura && ENTIDADES_DE_NOTA.includes(entidade) && !CRIACAO_NOTA_HABILITADA) {
    throw erroBloqueio('CRIACAO_NOTA_BLOQUEADA', 'Criação de nota no ERP bloqueada até existir serviço oficial homologado e autorização explícita.');
  }
  if (s.leitura) exigirSqlDeLeitura(requestBody && requestBody.sql);
  return sdk.callIntegrationMitra({
    projectId: PROJECT_ID, connection: SLUG_ERP, method: 'POST', endpoint: s.endpoint,
    body: { serviceName: servico, requestBody },
  });
}

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
  const r = await erpChamar('DbExplorerSP.executeQuery', { sql });
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
  // Passa pela porta unica: com a gravacao desligada, para aqui sem sair para a rede.
  const r = await erpChamar('CRUDServiceProvider.saveRecord', {
    dataSet: { rootEntity: entidade, includePresentationFields: 'N', dataRow, entity: { fieldset: { list: campoChave } } },
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
  const limpo = String(v == null ? '' : v).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 &.\-/]/g, ' ').replace(/-{2,}/g, '-').replace(/\s+/g, ' ').trim();
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


const busca = sqlTextoBusca(event.busca);
if (busca.length < 2) return { ok: true, itens: [] };
const itens = await erpConsulta(
  "SELECT * FROM (SELECT C.CODCID, C.NOMECID, C.UF FROM TSICID C WHERE UPPER(C.NOMECID) LIKE '" + busca + "%' ORDER BY C.NOMECID) WHERE ROWNUM <= 20",
);
return { ok: true, itens };
