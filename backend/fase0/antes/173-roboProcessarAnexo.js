// Apoio comum das SFs JavaScript. Fica em arquivo e e concatenado por lib/base.mjs.
const sdk = require('mitra-sdk');
const PROJECT_ID = Number(process.env.MITRA_PROJECT_ID);
const SF = {"parametroComEmpresa":46,"padraoLocalFornecedor":141,"mapearCodigosErp":142,"verificarDuplicidadeDocumento":47,"criarDocumento":48,"obterDocumentoPorHash":49,"criarLancamento":50,"obterLancamentoPorDocumento":51,"criarItensLancamento":53,"registrarLogsLote":198,"roboLerConfig":157,"roboRegistrarAnexo":170,"enviarLancamentoParaErp":139,"roboEmpresas":171,"listarTiposDocumento":15,"roboRegistrarEmail":168,"roboEmailPorMensagem":169,"roboConcluirEmail":199};
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


const leitura = (function () { // Motor de leitura do robo. Roda no sandbox das Server Functions, que nao tem navegador
// nem pacote externo: so zlib, crypto e buffer do Node.
const zlib = require('zlib');
const crypto = require('crypto');

function hashConteudo(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// Modulo 11 da chave de acesso: um digito trocado na leitura nao passa.
function chaveValida(chave) {
  if (!/^\d{44}$/.test(chave)) return false;
  let soma = 0;
  let peso = 2;
  for (let i = 42; i >= 0; i--) {
    soma += Number(chave[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const dv = resto < 2 ? 0 : 11 - resto;
  return dv === Number(chave[43]);
}

// O modulo 11 sozinho aceita 44 zeros. A chave tambem precisa ter UF, mes e modelo de documento fiscal.
const UFS = new Set([11, 12, 13, 14, 15, 16, 17, 21, 22, 23, 24, 25, 26, 27, 28, 29, 31, 32, 33, 35, 41, 42, 43, 50, 51, 52, 53]);
function chavePlausivel(chave) {
  if (!chaveValida(chave)) return false;
  const mes = Number(chave.slice(4, 6));
  const modelo = chave.slice(20, 22);
  return UFS.has(Number(chave.slice(0, 2))) && mes >= 1 && mes <= 12 && (modelo === '55' || modelo === '65') && !/^0+$/.test(chave.slice(6, 20));
}

function camposDaChave(chave) {
  return { cnpjEmitente: chave.slice(6, 20), serie: String(Number(chave.slice(22, 25))), numero: String(Number(chave.slice(25, 34))) };
}

const soDigitos = (v) => String(v == null ? '' : v).replace(/\D/g, '');
const decodeXml = (s) => String(s || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");

function tag(xml, nome) {
  const m = new RegExp('<(?:\\w+:)?' + nome + '(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?' + nome + '>').exec(xml);
  return m ? m[1] : '';
}
const valorTag = (xml, nome) => decodeXml(tag(xml, nome)).trim();

// XML da NF-e: cada campo vem nomeado e assinado pelo emitente; nao ha interpretacao.
function lerXml(texto) {
  const infMatch = /<(?:\w+:)?infNFe[^>]*\bId="NFe(\d{44})"/.exec(texto);
  const chave = infMatch ? infMatch[1] : soDigitos(valorTag(texto, 'chNFe'));
  const ide = tag(texto, 'ide');
  const emit = tag(texto, 'emit');
  const dest = tag(texto, 'dest');
  const icmsTot = tag(texto, 'ICMSTot');
  const cobr = tag(texto, 'cobr');
  const dups = [...cobr.matchAll(/<(?:\w+:)?dup>([\s\S]*?)<\/(?:\w+:)?dup>/g)].map((m) => valorTag(m[1], 'dVenc')).filter(Boolean);
  const itens = [...texto.matchAll(/<(?:\w+:)?det\b[^>]*>([\s\S]*?)<\/(?:\w+:)?det>/g)].map((m) => {
    const prod = tag(m[1], 'prod');
    return { descricao: valorTag(prod, 'xProd').slice(0, 300), quantidade: Number(valorTag(prod, 'qCom')) || 1, valorUnitario: Number(valorTag(prod, 'vUnCom')) || Number(valorTag(prod, 'vProd')) || 0, codprod: 0 };
  });
  const emissao = (valorTag(ide, 'dhEmi') || valorTag(ide, 'dEmi')).slice(0, 10);
  const valor = Number(valorTag(icmsTot, 'vNF')) || 0;
  return {
    formato: 'XML',
    texto: '',
    chave: /^\d{44}$/.test(chave) ? chave : '',
    cnpjEmitente: soDigitos(valorTag(emit, 'CNPJ') || valorTag(emit, 'CPF')),
    nomeEmitente: valorTag(emit, 'xNome'),
    cnpjsCandidatos: [soDigitos(valorTag(dest, 'CNPJ') || valorTag(dest, 'CPF'))].filter(Boolean),
    nomeDestinatario: valorTag(dest, 'xNome'),
    numero: valorTag(ide, 'nNF'),
    serie: valorTag(ide, 'serie'),
    dataEmissao: emissao,
    dataVencimento: dups.length ? dups.sort()[0] : '',
    aVista: dups.length === 0,
    valorTotal: valor,
    valorRotulado: valor > 0,
    tipoProvavel: 'NOTA_FISCAL',
    itens,
  };
}

// ---- PDF ----
function blocosStream(buf) {
  const blocos = [];
  const bin = buf.toString('latin1');
  const re = /stream\r?\n/g;
  let m;
  while ((m = re.exec(bin))) {
    const ini = m.index + m[0].length;
    const fim = bin.indexOf('endstream', ini);
    if (fim < 0) break;
    const cabecalho = bin.slice(Math.max(0, m.index - 400), m.index);
    const dict = cabecalho.slice(cabecalho.lastIndexOf('obj'));
    let dados = buf.subarray(ini, fim);
    let ok = true;
    if (/FlateDecode/.test(dict)) {
      try { dados = zlib.inflateSync(dados); } catch (_) {
        try { dados = zlib.inflateRawSync(dados); } catch (__) {
          try { dados = zlib.unzipSync(dados, { finishFlush: zlib.constants.Z_SYNC_FLUSH }); } catch (___) { ok = false; }
        }
      }
    } else if (/\/Filter/.test(dict)) {
      ok = false; // DCT, JBIG2 e afins sao imagem: nao ha texto
    }
    if (ok) blocos.push(dados.toString('latin1'));
    re.lastIndex = fim + 'endstream'.length;
  }
  return blocos;
}

// Fonte embutida como subconjunto escreve indice de glifo em hexadecimal, nao letra.
// Quem traduz e o ToUnicode: sem ele, um PDF de texto puro parece escaneado.
function mapaToUnicode(blocos) {
  const mapa = new Map();
  const hexParaTexto = (hex) => {
    let t = '';
    for (let i = 0; i + 4 <= hex.length; i += 4) t += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
    return t;
  };
  for (const b of blocos) {
    if (!/begincmap|beginbf/.test(b)) continue;
    for (const bloco of b.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
      for (const p of bloco[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
        mapa.set(p[1].toUpperCase().padStart(4, '0'), hexParaTexto(p[2]));
      }
    }
    for (const bloco of b.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
      for (const p of bloco[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
        const ini = parseInt(p[1], 16);
        const fim = parseInt(p[2], 16);
        const dest = parseInt(p[3], 16);
        for (let c = ini; c <= fim && c - ini < 2000; c++) {
          mapa.set(c.toString(16).toUpperCase().padStart(4, '0'), String.fromCharCode(dest + c - ini));
        }
      }
      for (const p of bloco[1].matchAll(/<([0-9A-Fa-f]+)>\s*<[0-9A-Fa-f]+>\s*\[([^\]]*)\]/g)) {
        const ini = parseInt(p[1], 16);
        [...p[2].matchAll(/<([0-9A-Fa-f]+)>/g)].forEach((d, i) => {
          mapa.set((ini + i).toString(16).toUpperCase().padStart(4, '0'), hexParaTexto(d[1]));
        });
      }
    }
  }
  return mapa;
}

function decodificarHex(hex, mapa) {
  const h = hex.replace(/\s/g, '').toUpperCase();
  if (mapa.size && h.length % 4 === 0) {
    let t = '';
    for (let i = 0; i < h.length; i += 4) t += mapa.has(h.slice(i, i + 4)) ? mapa.get(h.slice(i, i + 4)) : '';
    return t;
  }
  let t = '';
  for (let i = 0; i + 2 <= h.length; i += 2) {
    const code = h.slice(i, i + 2);
    const m = mapa.get(code.padStart(4, '0'));
    t += m !== undefined ? m : String.fromCharCode(parseInt(code, 16));
  }
  return t;
}

function decodificarLiteral(s) {
  return s.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (_, c) => {
    if (/^[0-7]/.test(c)) return String.fromCharCode(parseInt(c, 8));
    return { n: '\n', r: '\n', t: ' ', b: '', f: '', '(': '(', ')': ')', '\\': '\\' }[c];
  });
}

function textoDePagina(conteudo, mapa) {
  let saida = '';
  const re = /\[((?:[^\][]|\\.)*)\]\s*TJ|\(((?:[^()\\]|\\.|\((?:[^()\\]|\\.)*\))*)\)\s*(?:Tj|'|")|<([0-9A-Fa-f\s]+)>\s*Tj|(-?[\d.]+)\s+(-?[\d.]+)\s+T[dD]|T\*|ET/g;
  let m;
  while ((m = re.exec(conteudo))) {
    if (m[1] !== undefined) {
      for (const p of m[1].matchAll(/\(((?:[^()\\]|\\.|\((?:[^()\\]|\\.)*\))*)\)|<([0-9A-Fa-f\s]*)>|(-?[\d.]+)/g)) {
        if (p[1] !== undefined) saida += decodificarLiteral(p[1]);
        else if (p[2] !== undefined) saida += decodificarHex(p[2], mapa);
        else if (p[3] !== undefined && Number(p[3]) < -200) saida += ' ';
      }
    } else if (m[2] !== undefined) {
      saida += decodificarLiteral(m[2]);
    } else if (m[3] !== undefined) {
      saida += decodificarHex(m[3], mapa);
    } else if (m[4] !== undefined) {
      saida += Number(m[5]) !== 0 ? '\n' : ' ';
    } else {
      saida += '\n';
    }
  }
  return saida;
}

function extrairTextoPdf(buf) {
  const blocos = blocosStream(buf);
  const mapa = mapaToUnicode(blocos);
  const partes = [];
  for (const b of blocos) {
    if (/BT[\s\S]*?ET/.test(b) && !/begincmap/.test(b)) partes.push(textoDePagina(b, mapa));
  }
  return partes.join('\n').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
}

const MOEDA = /(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/;
const paraNumero = (s) => Number(String(s).replace(/\./g, '').replace(',', '.')) || 0;
const dataIso = (s) => {
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(String(s || ''));
  if (!m) return '';
  const d = Number(m[1]); const mes = Number(m[2]); const a = Number(m[3]);
  if (d < 1 || d > 31 || mes < 1 || mes > 12 || a < 2000 || a > 2100) return '';
  return m[3] + '-' + m[2] + '-' + m[1];
};

function acharRotulado(texto, rotulos, padrao, alcance) {
  for (const r of rotulos) {
    const re = new RegExp(r + '[\\s\\S]{0,' + (alcance || 80) + '}?' + padrao.source, 'i');
    const m = re.exec(texto);
    if (m) return m[m.length - 1];
  }
  return '';
}

function lerTexto(texto) {
  const normal = texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
  // Chave de acesso: procura 44 digitos, com ou sem espaco, e so aceita o que confere.
  let chave = '';
  for (const m of normal.matchAll(/\d(?:[ .]?\d){43,}/g)) {
    const d = soDigitos(m[0]);
    for (let i = 0; i + 44 <= d.length; i++) {
      if (chavePlausivel(d.slice(i, i + 44))) { chave = d.slice(i, i + 44); break; }
    }
    if (chave) break;
  }
  const daChave = chave ? camposDaChave(chave) : {};
  const cnpjs = [...new Set([...normal.matchAll(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g)].map((m) => soDigitos(m[0])).filter((c) => c.length === 14))];

  const rotuladoValor = acharRotulado(normal, ['VALOR\\s+TOTAL\\s+DA\\s+NOTA', 'V\\.?\\s*TOTAL\\s+DA\\s+NOTA', 'VALOR\\s+DO\\s+DOCUMENTO', 'VALOR\\s+COBRADO', 'VALOR\\s+TOTAL', 'TOTAL\\s+A\\s+PAGAR', 'VALOR\\s+A\\s+PAGAR', 'TOTAL\\s+LIQUIDO'], MOEDA);
  const todos = [...normal.matchAll(new RegExp(MOEDA.source, 'g'))].map((m) => paraNumero(m[1]));
  const maior = todos.length ? Math.max(...todos) : 0;

  const emissao = dataIso(acharRotulado(normal, ['DATA\\s+(?:DE|DA)?\\s*EMISSAO', 'EMISSAO', 'DATA\\s+DO\\s+DOCUMENTO'], /(\d{2}\/\d{2}\/\d{4})/));
  const vencimento = dataIso(acharRotulado(normal, ['VENCIMENTO', 'VENCTO', 'DATA\\s+DE\\s+VENC'], /(\d{2}\/\d{2}\/\d{4})/));
  const numero = daChave.numero || acharRotulado(normal, ['NOTA\\s+FISCAL\\s*(?:N|NO|NUMERO)?', 'N(?:o|\\u00ba|\\u00b0|UMERO)\\.?\\s+DO\\s+DOCUMENTO', 'NUMERO\\s+DO\\s+DOCUMENTO', 'NF-?E\\s*N'], /(\d[\d.]{0,14})/, 20).replace(/\./g, '');

  let tipoProvavel = 'BOLETO';
  if (chave || /DANFE|NOTA\s+FISCAL/i.test(normal)) tipoProvavel = 'NOTA_FISCAL';
  else if (/DARF|GPS|GUIA\s+DA\s+PREVIDENCIA|DAS\b|GRF|FGTS|DAE\b/i.test(normal)) tipoProvavel = 'GUIA_IMPOSTO';
  else if (/FOLHA\s+DE\s+PAGAMENTO|HOLERITE|RECIBO\s+DE\s+PAGAMENTO/i.test(normal)) tipoProvavel = 'FOLHA_PAGAMENTO';

  const emitente = daChave.cnpjEmitente || '';
  const nomeRotulado = /(?:EMITENTE|RAZAO\s+SOCIAL|BENEFICIARIO|CEDENTE)[:\s]+([A-Z0-9][^\n]{2,80})/i.exec(normal);
  return {
    formato: 'PDF',
    texto,
    chave,
    cnpjEmitente: emitente,
    nomeEmitente: nomeRotulado ? nomeRotulado[1].trim().slice(0, 200) : '',
    cnpjsCandidatos: cnpjs,
    nomeDestinatario: '',
    numero: numero || '',
    serie: daChave.serie || '',
    dataEmissao: emissao,
    dataVencimento: vencimento,
    aVista: false,
    valorTotal: rotuladoValor ? paraNumero(rotuladoValor) : maior,
    valorRotulado: Boolean(rotuladoValor),
    tipoProvavel,
    itens: [],
  };
}

function lerDocumento(nome, buffer) {
  const inicio = buffer.subarray(0, 400).toString('latin1').trimStart();
  if (/\.xml$/i.test(nome) || inicio.startsWith('<?xml') || /^<(?:\w+:)?nfeProc|^<(?:\w+:)?NFe/.test(inicio)) {
    return lerXml(buffer.toString('utf8'));
  }
  if (inicio.startsWith('%PDF') || /\.pdf$/i.test(nome)) {
    return lerTexto(extrairTextoPdf(buffer));
  }
  return { formato: 'OUTRO', texto: '', chave: '', cnpjEmitente: '', nomeEmitente: '', cnpjsCandidatos: [], nomeDestinatario: '', numero: '', serie: '', dataEmissao: '', dataVencimento: '', aVista: false, valorTotal: 0, valorRotulado: false, tipoProvavel: 'BOLETO', itens: [] };
}

// Cada criterio vale o que ele evita de erro. A justificativa volta junto: um percentual
// sem justificativa nao sustenta uma decisao automatica.
function pontuar(leitura, empresa) {
  const c = [];
  const add = (codigo, rotulo, peso, pontos, detalhe) => c.push({ codigo, rotulo, peso, pontos, situacao: pontos >= peso ? 'ok' : pontos > 0 ? 'parcial' : 'faltou', detalhe });
  if (leitura.formato === 'XML') {
    const confere = leitura.chave && chavePlausivel(leitura.chave) && (!leitura.cnpjEmitente || leitura.chave.slice(6, 20) === leitura.cnpjEmitente);
    if (confere) add('CHAVE', 'Chave de acesso', 40, 40, 'XML assinado; dígito verificador e emitente conferem.');
    else add('CHAVE', 'Chave de acesso', 40, 30, 'XML eletrônico, mas a chave não confere (dígito, UF, data ou CNPJ do emitente).');
  } else if (leitura.chave) {
    add('CHAVE', 'Chave de acesso', 40, 40, 'Chave encontrada e conferida pelo módulo 11.');
  } else {
    add('CHAVE', 'Chave de acesso', 40, 0, 'Não encontrei chave de acesso válida no documento.');
  }
  if (leitura.valorTotal > 0 && leitura.valorRotulado) add('VALOR', 'Valor total', 25, 25, 'Lido de um campo rotulado.');
  else if (leitura.valorTotal > 0) add('VALOR', 'Valor total', 25, 10, 'Sem rótulo: usei o maior valor da página, que pode não ser o total.');
  else add('VALOR', 'Valor total', 25, 0, 'Não encontrei valor no documento.');
  if (leitura.dataVencimento) add('VENCIMENTO', 'Vencimento', 15, 15, 'Vencimento lido do documento.');
  else if (leitura.formato === 'XML' && leitura.aVista) add('VENCIMENTO', 'Vencimento', 15, 15, 'Nota à vista: o XML não traz duplicata, e isso é informação.');
  else add('VENCIMENTO', 'Vencimento', 15, 0, 'Não encontrei vencimento.');
  if (leitura.dataEmissao) add('EMISSAO', 'Data de emissão', 10, 10, 'Emissão lida do documento.');
  else add('EMISSAO', 'Data de emissão', 10, 0, 'Não encontrei a data de emissão.');
  if (empresa) add('DESTINATARIO', 'Destinatário', 10, 10, 'Destinatário é a empresa ' + empresa.NOME + '.');
  else add('DESTINATARIO', 'Destinatário', 10, 0, 'Nenhum CNPJ do documento bate com empresa cadastrada.');
  return { confianca: c.reduce((s, x) => s + x.pontos, 0), criterios: c };
}

return { lerDocumento, pontuar, hashConteudo, chaveValida, chavePlausivel, extrairTextoPdf, soDigitos };

 })();

async function configRobo() {
  const out = {};
  (await listar(SF.roboLerConfig, {})).forEach((r) => { out[r.CHAVE] = r.VALOR; });
  return out;
}

async function subirPrivado(nome, buffer) {
  const arquivo = new File([buffer], nome, { type: /\.xml$/i.test(nome) ? 'application/xml' : 'application/pdf' });
  const up = await sdk.uploadFilePrivateMitra({ projectId: PROJECT_ID, file: arquivo });
  return (up && up.result && up.result.key) || '';
}

// O robo repete a sequencia da tela e do chat e termina no mesmo envio ao ERP: nenhuma
// regra e reescrita nem afrouxada aqui.
async function processarAnexo(ctx) {
  const { nome, buffer, emailId, simulacao, config, empresas, tipos } = ctx;
  const corte = Number(config.CORTE_CONFIANCA ?? 90);
  const hash = leitura.hashConteudo(buffer);
  const lido = leitura.lerDocumento(nome, buffer);
  const emitente = lido.cnpjEmitente;
  const candidatos = lido.cnpjsCandidatos.filter((c) => c !== emitente);
  // Numa nota de entrada, quem emite e o fornecedor; quem recebe e a empresa cadastrada aqui.
  const empresa = empresas.find((e) => candidatos.includes(soDigitos(e.CNPJ))) || null;
  const nota = leitura.pontuar(lido, empresa);
  const cnpjFornecedor = emitente || candidatos.find((c) => !empresa || c !== soDigitos(empresa.CNPJ)) || '';
  const campos = {
    fornecedor: lido.nomeEmitente, cnpjFornecedor, numero: lido.numero, serie: lido.serie, dataEmissao: lido.dataEmissao, dataVencimento: lido.dataVencimento,
    valorTotal: lido.valorTotal, chave: lido.chave, tipo: lido.tipoProvavel, empresa: empresa ? empresa.NOME : '', itens: lido.itens.length, cnpjsLidos: lido.cnpjsCandidatos,
  };
  const registro = {
    emailId: emailId || 0, nome: texto(nome, 300), tipo: lido.formato, tamanho: buffer.length, hash, origemLeitura: simulacao ? 'SIMULACAO' : 'EMAIL', confianca: nota.confianca,
    criterios: paraB64(JSON.stringify(nota.criterios)), campos: paraB64(JSON.stringify(campos)), lancamentoId: 0, documentoId: 0, chaveErp: '', arquivoKey: '',
  };
  const fechar = async (decisao, motivo, extra) => {
    await chamar(SF.roboRegistrarAnexo, Object.assign(registro, { decisao, motivo: texto(motivo, 500) }, extra || {}));
    return { decisao, motivo, confianca: nota.confianca, criterios: nota.criterios, campos, lancamentoId: (extra && extra.lancamentoId) || 0, chaveErp: (extra && extra.chaveErp) || '' };
  };

  const dup = await uma(SF.verificarDuplicidadeDocumento, { hash });
  if (dup && dup.LANCAMENTO_ID) return fechar('DUPLICADO', 'Este arquivo já entrou' + (dup.LANCAMENTO_ID ? ' no lançamento ' + dup.LANCAMENTO_ID : '') + '.', { lancamentoId: dup.LANCAMENTO_ID || 0, documentoId: dup.DOCUMENTO_ID || 0 });

  const arquivoKey = await subirPrivado(nome, buffer);
  registro.arquivoKey = arquivoKey;

  if (!empresa) {
    const lidos = lido.cnpjsCandidatos.length ? lido.cnpjsCandidatos.join(', ') : 'nenhum';
    return fechar('SEM_EMPRESA', 'Nenhum CNPJ de destinatário bate com empresa cadastrada (lidos: ' + lidos + '). Quem recebe a nota precisa ser uma empresa cadastrada aqui; quem emite é o fornecedor.');
  }

  const tipo = tipos.find((t) => t.CODIGO === lido.tipoProvavel) || tipos.find((t) => t.CODIGO === 'BOLETO');
  const abaixo = nota.confianca < corte;
  const criado = await criarLancamentoNucleo({
    logsExtras: [{ etapa: 'LEITURA', status: abaixo ? 'ATENCAO' : 'OK', mensagem: 'Leitura ' + lido.formato + ' com confiança ' + nota.confianca + ' (corte ' + corte + ').' }],
    empresaId: empresa.ID, tipoId: tipo.ID, hash, arquivoNome: nome, arquivoKey, cnpj: cnpjFornecedor, nome: lido.nomeEmitente || 'Fornecedor não identificado', numeroDoc: lido.numero, serie: lido.serie,
    dataEmissao: lido.dataEmissao, dataVencimento: lido.dataVencimento, valorTotal: lido.valorTotal, itens: lido.itens, origem: simulacao ? 'ROBO (simulação)' : 'ROBO', revisao: abaixo,
  });
  if (!criado.ok) return fechar('ERRO', criado.erro || 'Não consegui criar o lançamento.');
  const base = { lancamentoId: criado.lancamentoId, documentoId: criado.documentoId };

  if (abaixo) return fechar('REVISAO', 'Confiança ' + nota.confianca + ' < corte ' + corte + ': precisa de conferência humana.', base);
  if (criado.status !== 'APROVADO') return fechar('APROVACAO', 'Confiança ' + nota.confianca + ' ≥ corte ' + corte + ', mas o valor está acima da alçada: foi para a fila de aprovação.', base);

  const envio = await chamar(SF.enviarLancamentoParaErp, { lancamentoId: criado.lancamentoId, simular: simulacao ? 'S' : '' });
  if (simulacao) {
    if (envio && envio.ok) return fechar('SIMULADO', 'Confiança ' + nota.confianca + ' ≥ corte ' + corte + ' e valor dentro da alçada: o robô lançaria no ERP. Na simulação nada é gravado; abra o lançamento para enviar.', base);
    return fechar('ERRO', 'Confiança ' + nota.confianca + ' ≥ corte ' + corte + ', mas o envio pararia: ' + ((envio && envio.mensagem) || 'motivo desconhecido'), base);
  }
  if (envio && envio.ok) return fechar('LANCADO', 'Confiança ' + nota.confianca + ' ≥ corte ' + corte + ' e valor dentro da alçada: lançado pelo robô (chave ' + envio.chave + ').', Object.assign(base, { chaveErp: String(envio.chave || '') }));
  return fechar('ERRO', 'Confiança ' + nota.confianca + ' ≥ corte ' + corte + ', mas o envio parou: ' + ((envio && envio.mensagem) || 'motivo desconhecido'), base);
}


// Modo simulacao: o arquivo entregue pela tela passa pelo mesmo motor. Nada e gravado no ERP.
const nome = texto(event.nome, 300).trim();
const b64 = String(event.conteudoB64 || '');
if (!nome || !b64) return { ok: false, erro: 'Entregue um arquivo.' };
if (!/\.(xml|pdf)$/i.test(nome)) return { ok: false, erro: 'O robô lê arquivos XML e PDF.' };
const buffer = Buffer.from(b64, 'base64');
if (!buffer.length) return { ok: false, erro: 'Arquivo vazio.' };
if (buffer.length > 12 * 1024 * 1024) return { ok: false, erro: 'Arquivo acima de 12 MB.' };
const config = await configRobo();
const empresas = await listar(SF.roboEmpresas, {});
const tipos = await listar(SF.listarTiposDocumento, {});
const mensagemId = 'simulacao-' + Date.now() + '-' + Math.random().toString(16).slice(2, 10);
await chamar(SF.roboRegistrarEmail, { mensagemId, remetente: 'Entrega pela tela', assunto: nome, recebidoEm: new Date().toISOString().slice(0, 19), execucaoId: 0, anexos: 1, mensagem: 'Modo simulação' });
const email = await uma(SF.roboEmailPorMensagem, { mensagemId });
const r = await processarAnexo({ nome, buffer, emailId: email ? email.ID : 0, simulacao: true, config, empresas, tipos });
if (email) await chamar(SF.roboConcluirEmail, { id: email.ID });
return Object.assign({ ok: true }, r);
