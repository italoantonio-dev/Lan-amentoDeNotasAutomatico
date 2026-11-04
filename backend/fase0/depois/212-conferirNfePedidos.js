// Apoio comum das SFs JavaScript. Fica em arquivo e e concatenado por lib/base.mjs.
const sdk = require('mitra-sdk');
const PROJECT_ID = Number(process.env.MITRA_PROJECT_ID);
const SF = {"podeConferirNfe":211,"erpDadosEnvio":133,"keyArquivoDocumento":143,"listarItensLancamento":55,"roboEmpresas":171};
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
  // Codigo do fornecedor, GTIN e unidade alimentam a conferencia com pedidos; o nucleo de criacao
  // so le descricao, quantidade, valor unitario e codprod.
  const itens = [...texto.matchAll(/<(?:\w+:)?det\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?det>/g)].map((m) => {
    const prod = tag(m[2], 'prod');
    const nItem = (/nItem="(\d+)"/.exec(m[1]) || [])[1] || '';
    return {
      descricao: valorTag(prod, 'xProd').slice(0, 300), quantidade: Number(valorTag(prod, 'qCom')) || 1, valorUnitario: Number(valorTag(prod, 'vUnCom')) || Number(valorTag(prod, 'vProd')) || 0, codprod: 0,
      nItem: nItem ? Number(nItem) : null, cProd: valorTag(prod, 'cProd').slice(0, 60), cEAN: valorTag(prod, 'cEAN').slice(0, 20), unidade: valorTag(prod, 'uCom').slice(0, 10), valorTotal: Number(valorTag(prod, 'vProd')) || 0,
    };
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
const correspondencia = (function () { // Motor de correspondencia entre NF-e e pedidos de compra (Fases 1 e 2: somente leitura).
// Puro: nao acessa rede, banco nem relogio. O mesmo codigo roda na SF, nos testes e na avaliacao
// historica. Compara, classifica e explica. NAO aplica tolerancia comercial nem regra fiscal
// (aprovacoes A-04 e A-07 pendentes): toda diferenca aparece como diferenca, e quando mais de um
// pedido serve o motor diz que e ambiguo e mostra os candidatos, sem escolher.
'use strict';

// Arredondamento tecnico de ponto flutuante. Nao e tolerancia: 0,01 de diferenca ja e divergencia.
const ARRED = 1e-6;

const num = (v) => {
  const n = Number(String(v == null ? '' : v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
const igual = (a, b) => Math.abs(num(a) - num(b)) <= ARRED;
// Codigo do fornecedor comparado sem espacos nas pontas e sem diferenca de caixa. Zeros a esquerda
// e outros caracteres ficam como vieram: tratar "0123" como "123" seria uma regra inventada.
const codigo = (v) => String(v == null ? '' : v).trim().toUpperCase();
const unicos = (lista) => [...new Set(lista)];
const arred = (v, casas) => Math.round(num(v) * 10 ** casas) / 10 ** casas;

// Identificacao do produto do ERP a partir do item da NF-e. So identificam o produto informado por
// uma pessoa e o de-para do proprio Sankhya (TGFPAP): no historico do piloto ele nao errou nenhum
// item. A referencia do fornecedor (TGFPRO.REFFORN) errou 22% das vezes, entao e so SUGESTAO: aparece
// para a pessoa conferir e nao entra na decisao. REFERENCIA (62% de erro) e GTIN (100%) nao sao usados.
function identificarProduto(item, codparcs, dePara, referencias) {
  if (num(item.codprod) > 0) return { situacao: 'IDENTIFICADO', fonte: 'INFORMADO', codprods: [num(item.codprod)], sugestoes: [] };
  const c = codigo(item.cProd);
  if (!c) return { situacao: 'NAO_IDENTIFICADO', fonte: '', codprods: [], sugestoes: [] };
  const achados = unicos(dePara.filter((d) => codparcs.includes(num(d.CODPARC)) && codigo(d.CODPROPARC) === c).map((x) => num(x.CODPROD)).filter((x) => x > 0));
  if (achados.length) return { situacao: achados.length === 1 ? 'IDENTIFICADO' : 'AMBIGUO', fonte: 'TGFPAP', codprods: achados, sugestoes: [] };
  const sugestoes = unicos(referencias.filter((r) => codigo(r.REFFORN) === c).map((x) => num(x.CODPROD)).filter((x) => x > 0));
  return { situacao: 'NAO_IDENTIFICADO', fonte: '', codprods: [], sugestoes };
}

// Saldo do item do pedido. Saldo oficial ainda a confirmar (V-05): aqui e QTDNEG - QTDENTREGUE,
// zerado quando o Sankhya marca o item como nao pendente.
function saldo(it) {
  const negociada = num(it.QTDNEG);
  const entregue = num(it.QTDENTREGUE);
  const pendente = String(it.PENDENTE || 'S').toUpperCase() === 'N' ? 0 : Math.max(0, negociada - entregue);
  return { negociada, entregue, pendente };
}

function compararLinha(itemDoc, pedido, it) {
  const s = saldo(it);
  const qtdDocumento = num(itemDoc.quantidade);
  const precoDocumento = num(itemDoc.valorUnitario);
  const precoPedido = num(it.VLRUNIT);
  const unidadeDocumento = codigo(itemDoc.unidade);
  const unidadePedido = codigo(it.CODVOL);
  const divergencias = [];
  const mesmaUnidade = !unidadeDocumento || !unidadePedido || unidadeDocumento === unidadePedido;
  if (!mesmaUnidade) divergencias.push('UNIDADE_DIFERENTE');
  if (mesmaUnidade && qtdDocumento > s.pendente + ARRED) divergencias.push('QUANTIDADE_ACIMA_DO_PENDENTE');
  if (!igual(precoDocumento, precoPedido)) divergencias.push('PRECO_DIFERENTE');
  return {
    pedido: num(pedido.NUNOTA), numeroPedido: pedido.NUMNOTA ?? null, sequencia: num(it.SEQUENCIA), codprod: num(it.CODPROD), descricao: it.DESCRPROD || '',
    negociada: s.negociada, entregue: s.entregue, pendente: s.pendente, quantidadeDocumento: qtdDocumento,
    saldoAposDocumento: mesmaUnidade ? arred(s.pendente - qtdDocumento, 6) : null,
    unidadePedido, unidadeDocumento, precoPedido, precoDocumento,
    diferencaPreco: arred(precoDocumento - precoPedido, 6),
    diferencaPrecoPct: precoPedido ? arred(((precoDocumento - precoPedido) / precoPedido) * 100, 4) : null,
    divergencias,
  };
}

// entrada: { documento, empresas, parceiros, dePara, referencias, pedidos, existentes }
//   empresas: um mesmo CNPJ pode pertencer a mais de um codigo de empresa no Sankhya: vale o conjunto.
//   documento.itens: [{ nItem, cProd, cEAN, xProd, quantidade, unidade, valorUnitario, valorTotal, codprod? }]
//   pedidos: [{ NUNOTA, NUMNOTA, CODEMP, CODPARC, DTNEG, CODTIPOPER, itens: [...TGFITE], vinculos: [...TGFVAR] }]
//   existentes: notas no ERP com a mesma chave ou o mesmo numero/serie/parceiro
function conferir(entrada) {
  const doc = entrada.documento || {};
  const empresas = entrada.empresas || [];
  const codemps = empresas.map((e) => num(e.CODEMP));
  const parceiros = entrada.parceiros || [];
  const codparcs = parceiros.map((p) => num(p.CODPARC));
  const pedidos = entrada.pedidos || [];
  const alertas = [];
  const resultado = {
    versao: 1, somenteLeitura: true, situacao: '', resumo: '',
    documento: { chave: doc.chave || '', numero: doc.numero || '', serie: doc.serie || '', dataEmissao: doc.dataEmissao || '', cnpjEmitente: doc.cnpjEmitente || '', cnpjDestinatario: doc.cnpjDestinatario || '', valorTotal: num(doc.valorTotal), itens: (doc.itens || []).length },
    empresas: empresas.map((e) => ({ CODEMP: num(e.CODEMP), NOME: e.NOME || '' })),
    parceiros: parceiros.map((p) => ({ CODPARC: num(p.CODPARC), NOME: p.RAZAOSOCIAL || p.NOMEPARC || '', FORNECEDOR: p.FORNECEDOR || '' })),
    duplicidade: (entrada.existentes || []).map((n) => ({ NUNOTA: num(n.NUNOTA) || null, NUMNOTA: n.NUMNOTA ?? null, SERIENOTA: n.SERIENOTA ?? null, CODTIPOPER: num(n.CODTIPOPER) || null, STATUSNOTA: n.STATUSNOTA || '', motivo: String(n.MOTIVO || '') })),
    itens: [], pedidos: [], alertas,
  };
  if (resultado.duplicidade.length) {
    const textos = { CHAVE: 'nota com a mesma chave de acesso', NUMERO: 'compra com o mesmo número do mesmo fornecedor', PORTAL: 'o XML já importado no portal de XML' };
    const partes = resultado.duplicidade.map((d) => (textos[d.motivo] || d.motivo) + (d.NUNOTA ? ' (NUNOTA ' + d.NUNOTA + ')' : ' (ainda sem nota gerada)'));
    alertas.push({ tipo: 'JA_EXISTE_NO_ERP', mensagem: 'Esta NF-e já aparece no ERP: ' + unicos(partes).join('; ') + '.' });
  }
  if (!empresas.length) {
    resultado.situacao = 'SEM_EMPRESA';
    resultado.resumo = 'O CNPJ do destinatário não corresponde a nenhuma empresa cadastrada.';
    return resultado;
  }
  if (!parceiros.length) {
    resultado.situacao = 'SEM_FORNECEDOR';
    resultado.resumo = 'Nenhum parceiro ativo no ERP com o CNPJ do emitente.';
    return resultado;
  }

  const daEmpresa = pedidos.filter((p) => codemps.includes(num(p.CODEMP)) && codparcs.includes(num(p.CODPARC)));
  const outrasEmpresas = pedidos.filter((p) => !codemps.includes(num(p.CODEMP)) && codparcs.includes(num(p.CODPARC)));

  for (const itemDoc of doc.itens || []) {
    const ident = identificarProduto(itemDoc, codparcs, entrada.dePara || [], entrada.referencias || []);
    const linhas = [];
    for (const p of daEmpresa) {
      for (const it of p.itens || []) {
        if (!ident.codprods.includes(num(it.CODPROD))) continue;
        if (saldo(it).pendente <= ARRED) continue;
        linhas.push(compararLinha(itemDoc, p, it));
      }
    }
    // Sugestao nao decide: as linhas aparecem so para a pessoa conferir.
    const linhasSugeridas = [];
    for (const p of daEmpresa) {
      for (const it of p.itens || []) {
        if (ident.sugestoes.includes(num(it.CODPROD)) && saldo(it).pendente > ARRED) linhasSugeridas.push(compararLinha(itemDoc, p, it));
      }
    }
    const pedidosDoItem = unicos(linhas.map((l) => l.pedido));
    let situacao;
    if (ident.situacao === 'NAO_IDENTIFICADO') situacao = 'PRODUTO_NAO_IDENTIFICADO';
    else if (!linhas.length) situacao = 'SEM_PEDIDO';
    else if (pedidosDoItem.length === 1) situacao = 'PEDIDO_UNICO';
    else situacao = 'AMBIGUO';
    const emOutraEmpresa = ident.codprods.length ? unicos(outrasEmpresas.filter((p) => (p.itens || []).some((it) => ident.codprods.includes(num(it.CODPROD)) && saldo(it).pendente > ARRED)).map((p) => num(p.CODEMP))) : [];
    const pendenteNoPedido = pedidosDoItem.map((nu) => linhas.filter((l) => l.pedido === nu).reduce((s, l) => s + l.pendente, 0));
    resultado.itens.push({
      nItem: itemDoc.nItem ?? null, cProd: itemDoc.cProd || '', cEAN: itemDoc.cEAN || '', xProd: itemDoc.xProd || itemDoc.descricao || '',
      quantidade: num(itemDoc.quantidade), unidade: codigo(itemDoc.unidade), valorUnitario: num(itemDoc.valorUnitario), valorTotal: num(itemDoc.valorTotal),
      identificacao: ident, situacao, pedidos: pedidosDoItem, linhas, linhasSugeridas,
      saldoSuficienteEm: pedidosDoItem.filter((_, i) => pendenteNoPedido[i] + ARRED >= num(itemDoc.quantidade)),
      pendenteEmOutraEmpresa: emOutraEmpresa,
    });
    if (situacao === 'SEM_PEDIDO' && emOutraEmpresa.length) alertas.push({ tipo: 'PEDIDO_EM_OUTRA_EMPRESA', mensagem: 'Item ' + (itemDoc.nItem ?? '') + ': há saldo deste produto em pedido do fornecedor para outra empresa (' + emOutraEmpresa.join(', ') + ').' });
    // Codigo ligado a varios produtos: so vira alerta quando o pedido nao desfaz a duvida.
    if (ident.situacao === 'AMBIGUO' && unicos(linhas.map((l) => l.codprod)).length !== 1) alertas.push({ tipo: 'PRODUTO_AMBIGUO', mensagem: 'Item ' + (itemDoc.nItem ?? '') + ': o código ' + (itemDoc.cProd || '') + ' corresponde a mais de um produto (' + ident.codprods.join(', ') + ').' });
  }

  // Pedidos candidatos, com as contagens que sustentam a ordem de apresentacao. A ordem e so
  // apresentacao: com mais de um candidato a situacao continua AMBIGUO ate uma pessoa decidir.
  // No empate vem o pedido mais recente, por evidencia historica (relatorio de precisao), nao por regra.
  const identificados = resultado.itens.filter((i) => i.identificacao.situacao !== 'NAO_IDENTIFICADO').length;
  const candidatos = unicos(resultado.itens.flatMap((i) => i.pedidos));
  resultado.pedidos = candidatos.map((nu) => {
    const p = daEmpresa.find((x) => num(x.NUNOTA) === nu);
    const doPedido = resultado.itens.map((i) => i.linhas.filter((l) => l.pedido === nu)).filter((ls) => ls.length);
    const itensCobertos = doPedido.length;
    const conta = (f) => doPedido.filter((ls) => ls.some(f)).length;
    const codprodsDoc = unicos(resultado.itens.flatMap((i) => i.identificacao.codprods));
    const foraDoDocumento = (p.itens || []).filter((it) => saldo(it).pendente > ARRED && !codprodsDoc.includes(num(it.CODPROD)));
    const vinculos = p.vinculos || [];
    return {
      NUNOTA: nu, NUMNOTA: p.NUMNOTA ?? null, DTNEG: p.DTNEG || '', CODEMP: num(p.CODEMP), CODPARC: num(p.CODPARC), CODTIPOPER: num(p.CODTIPOPER), STATUSNOTA: p.STATUSNOTA || '',
      itensCobertos, cobreTodosOsItens: identificados > 0 && itensCobertos === identificados,
      itensComSaldoSuficiente: conta((l) => l.saldoAposDocumento !== null && l.saldoAposDocumento >= -ARRED),
      itensComPrecoIgual: conta((l) => !l.divergencias.includes('PRECO_DIFERENTE')),
      itensComQuantidadeIgualAoPendente: conta((l) => !l.divergencias.includes('UNIDADE_DIFERENTE') && igual(l.pendente, l.quantidadeDocumento)),
      jaFaturadoParcialmente: vinculos.length > 0 || (p.itens || []).some((it) => num(it.QTDENTREGUE) > ARRED),
      vinculos: vinculos.map((v) => ({ NUNOTA: num(v.NUNOTA), NUMNOTA: v.NUMNOTA ?? null, CODTIPOPER: num(v.CODTIPOPER), STATUSNOTA: v.STATUSNOTA || '', SEQUENCIAORIG: num(v.SEQUENCIAORIG), QTDATENDIDA: num(v.QTDATENDIDA) })),
      itensPendentesForaDoDocumento: foraDoDocumento.length,
    };
  }).sort((a, b) => (b.cobreTodosOsItens - a.cobreTodosOsItens) || (b.itensCobertos - a.itensCobertos) || (b.itensComSaldoSuficiente - a.itensComSaldoSuficiente)
    || (b.itensComPrecoIgual - a.itensComPrecoIgual) || (b.itensComQuantidadeIgualAoPendente - a.itensComQuantidadeIgualAoPendente) || (b.NUNOTA - a.NUNOTA));

  const sit = resultado.itens.map((i) => i.situacao);
  const nTotal = sit.length;
  const conta = (s) => sit.filter((x) => x === s).length;
  const comPedido = conta('PEDIDO_UNICO') + conta('AMBIGUO');
  const pedidosUnicos = unicos(resultado.itens.filter((i) => i.situacao === 'PEDIDO_UNICO').flatMap((i) => i.pedidos));
  if (!nTotal) resultado.situacao = 'SEM_ITENS';
  else if (!comPedido) resultado.situacao = conta('PRODUTO_NAO_IDENTIFICADO') === nTotal ? 'PRODUTOS_NAO_IDENTIFICADOS' : 'SEM_PEDIDO';
  else if (conta('AMBIGUO')) resultado.situacao = 'AMBIGUO';
  else if (comPedido < nTotal) resultado.situacao = 'PARCIAL';
  else resultado.situacao = pedidosUnicos.length === 1 ? 'PEDIDO_UNICO' : 'MULTIPLOS_PEDIDOS';

  const divergentes = resultado.itens.filter((i) => i.situacao === 'PEDIDO_UNICO' && i.linhas.every((l) => l.divergencias.length)).length;
  const textos = {
    SEM_ITENS: 'O documento não tem itens para comparar.',
    PRODUTOS_NAO_IDENTIFICADOS: 'Nenhum item da nota foi associado a um produto do ERP.',
    SEM_PEDIDO: 'Nenhum item tem saldo em pedido deste fornecedor para esta empresa.',
    AMBIGUO: conta('AMBIGUO') + ' de ' + nTotal + ' item(ns) cabem em mais de um pedido: uma pessoa precisa escolher.',
    PARCIAL: comPedido + ' de ' + nTotal + ' item(ns) têm pedido; os demais não.',
    PEDIDO_UNICO: 'Todos os itens correspondem ao mesmo pedido.',
    MULTIPLOS_PEDIDOS: 'Cada item corresponde a um único pedido, em ' + pedidosUnicos.length + ' pedidos.',
  };
  resultado.resumo = textos[resultado.situacao] + (divergentes ? ' ' + divergentes + ' item(ns) com divergência.' : '');
  return resultado;
}

return { conferir, identificarProduto, saldo, codigo, ARRED };

 })();

// Leitura no ERP para a conferencia de NF-e com pedidos de compra (Fases 1 e 2). So consultas,
// pela porta unica. Piloto aprovado: pedido TOP 1314 para notas TOP 1419/1420; ampliar exige
// aprovacao (A-01). Nenhuma tolerancia e aplicada aqui: o motor compara e explica.
const PILOTO_CORRESPONDENCIA = { topPedido: [1314], topNota: [1419, 1420] };
const LIMITE_LINHAS_ERP = 5000;

// Codigo vindo do XML entra no SQL do ERP: so letras, numeros, espaco e . _ / -. Aspas nunca.
const sqlCodigo = (v) => correspondencia.codigo(v).replace(/[^A-Z0-9 ._/-]/g, '').replace(/-{2,}/g, '-').slice(0, 60);
const sqlTextos = (lista) => [...new Set(lista.map(sqlCodigo).filter(Boolean))].slice(0, 900).map((v) => "'" + v + "'").join(',');
const sqlInteiros = (lista) => [...new Set(lista.map((v) => inteiro(v)).filter((v) => v > 0))].slice(0, 900).join(',');

function agruparPedidos(linhas) {
  const mapa = new Map();
  for (const l of linhas) {
    const nu = Number(l.NUNOTA);
    if (!mapa.has(nu)) mapa.set(nu, { NUNOTA: nu, NUMNOTA: l.NUMNOTA, CODEMP: l.CODEMP, CODPARC: l.CODPARC, DTNEG: l.DTNEG, CODTIPOPER: l.CODTIPOPER, STATUSNOTA: l.STATUSNOTA, itens: [], vinculos: [] });
    mapa.get(nu).itens.push({ SEQUENCIA: l.SEQUENCIA, CODPROD: l.CODPROD, DESCRPROD: l.DESCRPROD, QTDNEG: l.QTDNEG, QTDENTREGUE: l.QTDENTREGUE, VLRUNIT: l.VLRUNIT, CODVOL: l.CODVOL, PENDENTE: l.PENDENTE });
  }
  return mapa;
}

async function dadosDaCorrespondencia(documento) {
  const alertasLeitura = [];
  const vazio = { parceiros: [], dePara: [], referencias: [], pedidos: [], existentes: [], alertasLeitura };
  const parceiros = await parceirosPorCnpj(documento.cnpjEmitente);
  if (!parceiros.length) return vazio;
  const codparcs = sqlInteiros(parceiros.map((p) => p.CODPARC));
  const codigos = sqlTextos(documento.itens.map((i) => i.cProd));
  const dePara = codigos ? await erpConsulta('SELECT CODPARC, CODPROPARC, CODPROD FROM TGFPAP WHERE CODPARC IN (' + codparcs + ') AND UPPER(TRIM(CODPROPARC)) IN (' + codigos + ')') : [];
  const referencias = codigos ? await erpConsulta('SELECT CODPROD, REFFORN FROM TGFPRO WHERE UPPER(TRIM(REFFORN)) IN (' + codigos + ')') : [];

  const codparcsNum = parceiros.map((p) => Number(p.CODPARC));
  const codprods = sqlInteiros(documento.itens.flatMap((i) => {
    const id = correspondencia.identificarProduto(i, codparcsNum, dePara, referencias);
    return [...id.codprods, ...id.sugestoes];
  }));
  let pedidos = [];
  if (codprods) {
    const linhas = await erpConsulta(
      "SELECT C.NUNOTA, C.NUMNOTA, C.CODEMP, C.CODPARC, TO_CHAR(C.DTNEG, 'YYYY-MM-DD') AS DTNEG, C.CODTIPOPER, C.STATUSNOTA, I.SEQUENCIA, I.CODPROD, P.DESCRPROD, I.QTDNEG, I.QTDENTREGUE, I.VLRUNIT, I.CODVOL, I.PENDENTE"
      + ' FROM TGFCAB C JOIN TGFITE I ON I.NUNOTA = C.NUNOTA JOIN TGFPRO P ON P.CODPROD = I.CODPROD'
      + ' WHERE C.CODTIPOPER IN (' + PILOTO_CORRESPONDENCIA.topPedido.join(',') + ') AND C.CODPARC IN (' + codparcs + ')'
      + " AND C.NUNOTA IN (SELECT I2.NUNOTA FROM TGFITE I2 WHERE I2.CODPROD IN (" + codprods + ") AND I2.PENDENTE = 'S')"
      + ' ORDER BY C.NUNOTA, I.SEQUENCIA',
    );
    if (linhas.length >= LIMITE_LINHAS_ERP) alertasLeitura.push({ tipo: 'LEITURA_CORTADA', mensagem: 'O ERP devolveu o limite de ' + LIMITE_LINHAS_ERP + ' linhas de pedido: a lista de candidatos pode estar incompleta.' });
    const mapa = agruparPedidos(linhas);
    const nus = sqlInteiros([...mapa.keys()]);
    if (nus) {
      const vinculos = await erpConsulta(
        "SELECT V.NUNOTAORIG, V.SEQUENCIAORIG, V.NUNOTA, V.SEQUENCIA, V.QTDATENDIDA, D.NUMNOTA, D.CODTIPOPER, D.STATUSNOTA, TO_CHAR(D.DTNEG, 'YYYY-MM-DD') AS DTNEG"
        + ' FROM TGFVAR V JOIN TGFCAB D ON D.NUNOTA = V.NUNOTA WHERE V.NUNOTAORIG IN (' + nus + ')',
      );
      vinculos.forEach((v) => { const p = mapa.get(Number(v.NUNOTAORIG)); if (p) p.vinculos.push(v); });
    }
    pedidos = [...mapa.values()];
  }

  // Duplicidade: a mesma chave no ERP, o mesmo numero do mesmo fornecedor numa compra, ou o XML
  // ja importado no portal de XML do Sankhya.
  const chave = /^\d{44}$/.test(String(documento.chave || '')) ? documento.chave : '';
  const numero = inteiro(soDigitos(documento.numero).slice(0, 15));
  const partes = [];
  if (chave) partes.push("SELECT C.NUNOTA, C.NUMNOTA, C.SERIENOTA, C.CODTIPOPER, C.STATUSNOTA, 'CHAVE' AS MOTIVO FROM TGFCAB C WHERE C.CHAVENFE = '" + chave + "'");
  if (numero) partes.push("SELECT C.NUNOTA, C.NUMNOTA, C.SERIENOTA, C.CODTIPOPER, C.STATUSNOTA, 'NUMERO' AS MOTIVO FROM TGFCAB C WHERE C.CODPARC IN (" + codparcs + ') AND C.NUMNOTA = ' + numero + " AND C.TIPMOV = 'C'" + (chave ? " AND (C.CHAVENFE IS NULL OR C.CHAVENFE <> '" + chave + "')" : ''));
  if (chave) partes.push("SELECT X.NUNOTA, X.NUMNOTA, NULL AS SERIENOTA, X.CODTIPOPER, NULL AS STATUSNOTA, 'PORTAL' AS MOTIVO FROM TGFIXN X WHERE X.CHAVEACESSO = '" + chave + "'");
  const existentes = partes.length ? await erpConsulta(partes.join(' UNION ALL ')) : [];
  return { parceiros, dePara, referencias, pedidos, existentes, alertasLeitura };
}


// Conferencia de NF-e com pedidos de compra (Fases 1 e 2). SOMENTE LEITURA: consulta o ERP pela
// porta unica; nao cria nota, nao altera pedido, nao gera provisao e nao grava neste sistema.
const pode = await uma(SF.podeConferirNfe, {});
if (!pode || Number(pode.PODE) !== 1) return { ok: false, erro: 'Você não tem acesso à conferência de notas fiscais.' };

const lancamentoId = inteiro(event.lancamentoId);
let lido = null;
let origem = '';
let empresaDoLancamento = null; // sem XML, a empresa vem do lancamento
if (lancamentoId) {
  const d = await uma(SF.erpDadosEnvio, { id: lancamentoId });
  if (!d) return { ok: false, erro: 'Lançamento não encontrado, ou fora dos tipos que você enxerga.' };
  empresaDoLancamento = { CODEMP: d.CODEMP, NOME: d.EMPRESA };
  const arq = d.DOCUMENTO_ID ? await uma(SF.keyArquivoDocumento, { id: d.DOCUMENTO_ID }) : null;
  if (arq && arq.CHAVE_ARQUIVO) {
    try {
      const blob = await sdk.downloadFilePrivateMitra({ projectId: PROJECT_ID, key: arq.CHAVE_ARQUIVO });
      const l = leitura.lerDocumento(String(arq.NOME || ''), Buffer.from(await blob.arrayBuffer()));
      if (l.formato === 'XML') { lido = l; origem = 'XML do lançamento'; }
    } catch (_) { /* arquivo ilegivel: segue com os dados do lancamento */ }
  }
  if (!lido) {
    const itens = await listar(SF.listarItensLancamento, { lancamentoId });
    lido = {
      chave: '', cnpjEmitente: soDigitos(d.CNPJ_FORNECEDOR), cnpjsCandidatos: [], numero: d.NUMERO_DOC || '', serie: d.SERIE || '', dataEmissao: d.DATA_EMISSAO || '', valorTotal: d.VALOR_TOTAL,
      itens: itens.map((i, k) => ({ nItem: k + 1, descricao: i.DESCRICAO, quantidade: i.QUANTIDADE, valorUnitario: i.VALOR_UNITARIO, valorTotal: Number(i.QUANTIDADE) * Number(i.VALOR_UNITARIO), codprod: i.CODPROD })),
    };
    origem = 'dados do lançamento, sem XML: só os itens com produto do ERP informado são comparados';
  }
} else if (event.conteudoB64) {
  const b64 = String(event.conteudoB64);
  if (b64.length > 4 * 1024 * 1024) return { ok: false, erro: 'Arquivo grande demais para a conferência (limite de 3 MB).' };
  lido = leitura.lerDocumento(texto(event.nome || 'nota.xml', 200), Buffer.from(b64, 'base64'));
  if (lido.formato !== 'XML') return { ok: false, erro: 'A conferência com pedidos precisa do XML da NF-e.' };
  origem = 'XML enviado para conferência';
} else {
  return { ok: false, erro: 'Informe o lançamento ou o XML da nota.' };
}

const destinatarios = (lido.cnpjsCandidatos || []).filter((c) => c && c !== lido.cnpjEmitente);
// Um CNPJ pode pertencer a mais de um codigo de empresa: vale o conjunto.
const cadastradas = await listar(SF.roboEmpresas, {});
const pelaNota = cadastradas.filter((e) => destinatarios.includes(soDigitos(e.CNPJ))).map((e) => ({ CODEMP: e.CODEMP, NOME: e.NOME }));
const empresas = pelaNota.length ? pelaNota : (!destinatarios.length && empresaDoLancamento ? [empresaDoLancamento] : []);
const documento = {
  chave: lido.chave || '', numero: lido.numero || '', serie: lido.serie || '', dataEmissao: lido.dataEmissao || '', cnpjEmitente: soDigitos(lido.cnpjEmitente), cnpjDestinatario: destinatarios[0] || '', valorTotal: Number(lido.valorTotal) || 0,
  itens: (lido.itens || []).slice(0, 990).map((i) => ({ nItem: i.nItem, cProd: i.cProd || '', cEAN: i.cEAN || '', xProd: i.descricao || '', quantidade: i.quantidade, unidade: i.unidade || '', valorUnitario: i.valorUnitario, valorTotal: i.valorTotal, codprod: inteiro(i.codprod) })),
};
let dados = { parceiros: [], dePara: [], referencias: [], pedidos: [], existentes: [], alertasLeitura: [] };
try {
  if (empresas.length) dados = await dadosDaCorrespondencia(documento);
} catch (e) {
  return { ok: false, erro: 'Não consegui consultar o ERP: ' + msgErro(e) };
}
const resultado = correspondencia.conferir({ documento, empresas, parceiros: dados.parceiros, dePara: dados.dePara, referencias: dados.referencias, pedidos: dados.pedidos, existentes: dados.existentes });
resultado.alertas.push(...dados.alertasLeitura);
if (empresaDoLancamento && pelaNota.length && !pelaNota.some((e) => Number(e.CODEMP) === Number(empresaDoLancamento.CODEMP))) {
  resultado.alertas.push({ tipo: 'EMPRESA_DIFERENTE_DO_LANCAMENTO', mensagem: 'O destinatário da NF-e é a empresa ' + pelaNota.map((e) => e.CODEMP).join(' ou ') + ', mas o lançamento está na empresa ' + empresaDoLancamento.CODEMP + '.' });
}
return { ok: true, origem, piloto: PILOTO_CORRESPONDENCIA, resultado };
