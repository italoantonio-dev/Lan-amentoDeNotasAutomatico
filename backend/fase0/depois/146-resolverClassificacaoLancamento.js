// Apoio comum das SFs JavaScript. Fica em arquivo e e concatenado por lib/base.mjs.
const sdk = require('mitra-sdk');
const PROJECT_ID = Number(process.env.MITRA_PROJECT_ID);
const SF = {"parametroComEmpresa":46,"padraoLocalFornecedor":141,"mapearCodigosErp":142,"verificarDuplicidadeDocumento":47,"criarDocumento":48,"obterDocumentoPorHash":49,"criarLancamento":50,"obterLancamentoPorDocumento":51,"criarItensLancamento":53,"registrarLogsLote":198};
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
// Unica porta de saida para o ERP. Servico fora desta lista nao sai, ligado ou desligado.
const SERVICOS_ERP = {
  'DbExplorerSP.executeQuery': { endpoint: EP_CONSULTA, leitura: true },
  'CRUDServiceProvider.saveRecord': { endpoint: EP_SALVAR, leitura: false },
};
// Regra permanente: o sistema nunca confirma nota. Vale mesmo com a gravacao ligada.
const SERVICO_DE_CONFIRMACAO = /confirm/i;
// Defesa a mais na leitura: o texto entre aspas e ignorado (nome de parceiro pode conter "MERGE").
// Comentario e recusado porque esconderia uma aspa dessa conta e, com ela, um segundo comando.
const SQL_PROIBIDO_ERP = /\b(INSERT|UPDATE|DELETE|MERGE|CREATE|ALTER|DROP|TRUNCATE|RENAME|GRANT|REVOKE|EXEC|EXECUTE|BEGIN|DECLARE|CALL|COMMIT|ROLLBACK|SAVEPOINT|LOCK|DBMS_\w+|UTL_\w+)\b|\bFOR\s+UPDATE\b|;|--|\/\*/i;

function erroBloqueio(codigo, mensagem) {
  const e = new Error(mensagem);
  e.codigo = codigo;
  return e;
}
const ehBloqueioErp = (e) => !!e && (e.codigo === 'GRAVACAO_BLOQUEADA' || e.codigo === 'CONFIRMACAO_PROIBIDA' || e.codigo === 'SERVICO_NAO_PERMITIDO' || e.codigo === 'SQL_NAO_E_LEITURA');

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


// Classificacao e criacao do lancamento: unico caminho para tela, chat e robo.
const MIN_LOCAL = 2;
const MIN_ERP = 3;
const DOMINANCIA = 0.7;

function dominante(valores) {
  const presentes = valores.filter((v) => v !== null && v !== undefined && v !== '');
  if (!presentes.length) return null;
  const cont = new Map();
  presentes.forEach((v) => cont.set(String(v), (cont.get(String(v)) || 0) + 1));
  let topo = null; let n = 0;
  cont.forEach((qtd, chave) => { if (qtd > n) { n = qtd; topo = chave; } });
  return { valor: topo, n, total: presentes.length, parcela: n / presentes.length };
}

async function historicoErp(codemp, codparc) {
  const sql = "SELECT 'NATUREZA' AS DIM, TO_CHAR(CODNAT) AS COD, COUNT(*) AS N FROM TGFFIN WHERE CODEMP = " + codemp + ' AND CODPARC = ' + codparc + ' AND RECDESP = -1 AND DTNEG >= ADD_MONTHS(SYSDATE, -24) AND CODNAT IS NOT NULL GROUP BY CODNAT'
    + " UNION ALL SELECT 'CENTRO', TO_CHAR(CODCENCUS), COUNT(*) FROM TGFFIN WHERE CODEMP = " + codemp + ' AND CODPARC = ' + codparc + ' AND RECDESP = -1 AND DTNEG >= ADD_MONTHS(SYSDATE, -24) AND CODCENCUS IS NOT NULL GROUP BY CODCENCUS'
    + " UNION ALL SELECT 'CONTA', TO_CHAR(CODCTABCOINT), COUNT(*) FROM TGFFIN WHERE CODEMP = " + codemp + ' AND CODPARC = ' + codparc + ' AND RECDESP = -1 AND DTNEG >= ADD_MONTHS(SYSDATE, -24) AND CODCTABCOINT IS NOT NULL GROUP BY CODCTABCOINT';
  return erpConsulta(sql);
}

// A TOP nunca e aprendida: ela responde ao tipo de documento, nao a quem emitiu.
// O limiar e por dimensao: um fornecedor pode ser 97% consistente em natureza e 52% em conta.
async function resolverClassificacao(empresaId, tipoId, cnpj) {
  const param = await uma(SF.parametroComEmpresa, { empresaId, tipoId });
  const res = {
    topId: param ? inteiro(param.TOP_ID) : 0,
    naturezaId: param ? inteiro(param.NATUREZA_ID) : 0,
    centroId: param ? inteiro(param.CENTRO_ID) : 0,
    contaId: param ? inteiro(param.CONTA_ID) : 0,
    origem: param ? 'PARAMETRO' : '',
    justificativas: [],
    temParametro: Boolean(param),
    avisos: [],
  };
  const DIMS = [
    { chave: 'naturezaId', dim: 'NATUREZA', campo: 'NATUREZA_ID', cod: 'CODNAT', desc: 'NATUREZA_DESC', rotulo: 'Natureza' },
    { chave: 'centroId', dim: 'CENTRO', campo: 'CENTRO_ID', cod: 'CODCENCUS', desc: 'CENTRO_DESC', rotulo: 'Centro' },
    { chave: 'contaId', dim: 'CONTA', campo: 'CONTA_ID', cod: 'CODCTABCO', desc: 'CONTA_DESC', rotulo: 'Conta' },
  ];
  const c = soDigitos(cnpj);
  if (!c) return res;

  const local = await listar(SF.padraoLocalFornecedor, { empresaId, cnpj: c });
  const resolvidas = new Set();
  for (const d of DIMS) {
    const dom = dominante(local.map((l) => l[d.campo]));
    if (dom && dom.total >= MIN_LOCAL && dom.parcela >= DOMINANCIA) {
      const ref = local.find((l) => String(l[d.campo]) === dom.valor) || {};
      res[d.chave] = Number(dom.valor);
      res.origem = 'PADRAO_HISTORICO';
      resolvidas.add(d.dim);
      res.justificativas.push(d.rotulo + ' ' + (ref[d.cod] || '') + ' ' + (ref[d.desc] || '') + ' herdada do histórico deste sistema (' + dom.n + ' de ' + dom.total + ' lançamentos)');
    }
  }
  if (resolvidas.size === DIMS.length || !param) return res;

  // Historico do ERP: so para o que o historico local nao resolveu. Falha aqui nao trava a criacao.
  try {
    const parceiros = await parceirosPorCnpj(c);
    const forn = parceiros.filter((p) => String(p.FORNECEDOR).toUpperCase() === 'S');
    const unicos = forn.length ? forn : parceiros;
    if (unicos.length !== 1) return res;
    const hist = await historicoErp(Number(param.CODEMP), Number(unicos[0].CODPARC));
    const porDim = { NATUREZA: [], CENTRO: [], CONTA: [] };
    hist.forEach((h) => porDim[h.DIM] && porDim[h.DIM].push({ cod: String(h.COD), n: Number(h.N) }));
    const escolhidos = {};
    for (const d of DIMS) {
      if (resolvidas.has(d.dim)) continue;
      const lista = porDim[d.dim];
      const total = lista.reduce((s, x) => s + x.n, 0);
      const topo = lista.slice().sort((a, b) => b.n - a.n)[0];
      if (topo && total >= MIN_ERP && topo.n / total >= DOMINANCIA) escolhidos[d.dim] = { cod: topo.cod, n: topo.n, total, d };
    }
    if (!Object.keys(escolhidos).length) return res;
    const mapa = await listar(SF.mapearCodigosErp, {
      naturezas: (escolhidos.NATUREZA || {}).cod || '', centros: (escolhidos.CENTRO || {}).cod || '', contas: (escolhidos.CONTA || {}).cod || '',
    });
    for (const dim of Object.keys(escolhidos)) {
      const e = escolhidos[dim];
      const m = mapa.find((x) => x.DIM === dim && String(x.COD) === e.cod);
      if (!m) continue;
      res[e.d.chave] = Number(m.ID);
      res.origem = 'PADRAO_HISTORICO';
      res.justificativas.push(e.d.rotulo + ' ' + e.cod + ' ' + (m.DESCRICAO || '') + ' herdada do histórico do fornecedor no ERP (' + e.n + ' de ' + e.total + ' títulos)');
    }
  } catch (e) {
    res.avisos.push('Histórico do fornecedor no ERP indisponível: ' + msgErro(e));
  }
  return res;
}

function hashDeCampos(d) {
  const base = [d.empresaId, d.tipoId, soDigitos(d.cnpj), d.numeroDoc, d.valorTotal, d.dataEmissao].join('|');
  return require('crypto').createHash('sha256').update(base).digest('hex');
}

async function criarLancamentoNucleo(d) {
  const empresaId = inteiro(d.empresaId);
  const tipoId = inteiro(d.tipoId);
  const valorTotal = Number(d.valorTotal);
  if (!empresaId) return { ok: false, erro: 'Informe a empresa.' };
  if (!tipoId) return { ok: false, erro: 'Informe o tipo de documento.' };
  if (!Number.isFinite(valorTotal) || valorTotal < 0) return { ok: false, erro: 'Informe um valor válido.' };
  const emData = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : '');
  const arquivoKey = /^ai-files\/private\//.test(String(d.arquivoKey || '')) ? String(d.arquivoKey) : '';
  const hash = /^[0-9a-f]{64}$/i.test(String(d.hash || '')) ? String(d.hash).toLowerCase() : hashDeCampos(d);

  const dup = await uma(SF.verificarDuplicidadeDocumento, { hash });
  if (dup && dup.LANCAMENTO_ID) return { ok: false, duplicado: true, lancamentoId: dup.LANCAMENTO_ID, documentoId: dup.DOCUMENTO_ID, erro: 'Este documento já entrou no lançamento ' + dup.LANCAMENTO_ID + '.' };

  // Documento sem lancamento e sobra de uma tentativa interrompida: retoma em vez de travar o arquivo.
  if (!dup) await chamar(SF.criarDocumento, { empresaId, tipoId, nome: texto(d.arquivoNome || 'Sem arquivo', 300), arquivoKey, hash });
  const doc = await uma(SF.obterDocumentoPorHash, { hash });
  if (!doc) return { ok: false, erro: 'Não consegui registrar o documento.' };

  const c = await resolverClassificacao(empresaId, tipoId, d.cnpj);
  await chamar(SF.criarLancamento, {
    documentoId: doc.ID, cnpj: soDigitos(d.cnpj), nome: texto(d.nome, 200), codparc: inteiro(d.codparc), numeroDoc: texto(d.numeroDoc, 30), serie: texto(d.serie, 10),
    dataEmissao: emData(d.dataEmissao), dataVencimento: emData(d.dataVencimento), valorTotal,
    topId: c.topId, naturezaId: c.naturezaId, centroId: c.centroId, contaId: c.contaId, origem: c.origem, revisao: d.revisao ? 'S' : '',
  });
  const l = await uma(SF.obterLancamentoPorDocumento, { documentoId: doc.ID });
  if (!l) return { ok: false, erro: 'Não consegui criar o lançamento.' };

  const itens = Array.isArray(d.itens) ? d.itens : [];
  if (itens.length) {
    const lista = itens.slice(0, 500).map((i) => ({ descricao: texto(i.descricao, 300), quantidade: Number(i.quantidade) || 1, valorUnitario: Number(i.valorUnitario) || 0, codprod: inteiro(i.codprod) }));
    await chamar(SF.criarItensLancamento, { lancamentoId: l.ID, linhas: paraB64(JSON.stringify(lista)) });
  }
  // Trilha em uma chamada so: chamada entre SFs tambem conta no limite por minuto do projeto.
  const PORTAS = { TELA: 'pela tela de Lançamentos', CHAT: 'pelo Assistente', ROBO: 'pelo robô de e-mail', 'ROBO (simulação)': 'pelo robô, em simulação' };
  const trilha = [{ etapa: 'ENTRADA', status: 'OK', mensagem: 'Documento recebido ' + (PORTAS[d.origem] || 'pela tela de Lançamentos') + (d.arquivoNome ? ': ' + texto(d.arquivoNome, 200) : '') + '.' }];
  (d.logsExtras || []).forEach((x) => trilha.push(x));
  if (c.justificativas.length) c.justificativas.forEach((j) => trilha.push({ etapa: 'CLASSIFICACAO', status: 'OK', mensagem: j }));
  else if (c.temParametro) trilha.push({ etapa: 'CLASSIFICACAO', status: 'OK', mensagem: 'Classificação vinda do parâmetro da empresa e tipo.' });
  else trilha.push({ etapa: 'CLASSIFICACAO', status: 'ATENCAO', mensagem: 'Sem parâmetro cadastrado para esta empresa e tipo: o lançamento aguarda aprovação e a classificação precisa ser informada.' });
  c.avisos.forEach((a) => trilha.push({ etapa: 'CLASSIFICACAO', status: 'ATENCAO', mensagem: a }));
  trilha.push({ etapa: 'ALCADA', status: 'OK', mensagem: l.STATUS === 'APROVADO' ? 'Valor dentro do limite de aprovação: aprovado automaticamente.' : l.STATUS === 'REVISAO_LEITURA' ? 'Leitura abaixo do corte: aguarda conferência humana.' : 'Valor acima do limite, ou sem limite cadastrado: aguarda aprovação.' });
  await chamar(SF.registrarLogsLote, { lancamentoId: l.ID, linhas: paraB64(JSON.stringify(trilha)) });
  return { ok: true, lancamentoId: l.ID, documentoId: doc.ID, status: l.STATUS, origemClassificacao: c.origem, justificativas: c.justificativas, avisos: c.avisos };
}


const r = await resolverClassificacao(inteiro(event.empresaId), inteiro(event.tipoId), event.cnpj);
return Object.assign({ ok: true }, r);
