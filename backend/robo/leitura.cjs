// Motor de leitura do robo. Roda no sandbox das Server Functions, que nao tem navegador
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
      // Referencia ao pedido informada pelo fornecedor (opcional na NF-e) e desconto do item.
      xPed: valorTag(prod, 'xPed').slice(0, 15), nItemPed: valorTag(prod, 'nItemPed').slice(0, 6), valorDesconto: Number(valorTag(prod, 'vDesc')) || 0,
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

module.exports = { lerDocumento, pontuar, hashConteudo, chaveValida, chavePlausivel, extrairTextoPdf, soDigitos };
