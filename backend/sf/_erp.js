// Adaptador do ERP. O slug e o unico contrato entre o codigo e o Sankhya do cliente:
// URL, usuario e schema ficam na conexao, nunca aqui.
const SLUG_ERP = 'sankhya';
const EP_CONSULTA = '/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json';
const EP_SALVAR = '/gateway/v1/mge/service.sbr?serviceName=CRUDServiceProvider.saveRecord&outputType=json';

// Gravacao LIGADA na conexao de producao por autorizacao escrita do usuario em 06/11/2026, que assumiu
// o controle dos envios. Vale so para as entidades de ENTIDADES_GRAVAVEIS. Nenhum parametro de tela, de
// banco ou de input muda isto: desligar e voltar esta linha para false e publicar as SFs de novo.
const GRAVACAO_ERP_HABILITADA = true;
const ENTIDADES_GRAVAVEIS = ['Financeiro'];
// Alterar cadastro de parceiro no ERP nao entrou na autorizacao.
const CORRECAO_CADASTRO_HABILITADA = false;
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
const ehBloqueioErp = (e) => !!e && ['GRAVACAO_BLOQUEADA', 'CONFIRMACAO_PROIBIDA', 'SERVICO_NAO_PERMITIDO', 'SQL_NAO_E_LEITURA', 'CRIACAO_NOTA_BLOQUEADA', 'ENTIDADE_NAO_LIBERADA'].includes(e.codigo);

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
  if (!s.leitura && !ENTIDADES_GRAVAVEIS.includes(entidade)) {
    throw erroBloqueio('ENTIDADE_NAO_LIBERADA', 'Gravação no ERP liberada só para título financeiro: nada foi enviado ao Sankhya.');
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
