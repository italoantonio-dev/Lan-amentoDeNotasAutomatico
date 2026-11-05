// Leitura de caixa IMAP sem biblioteca: o sandbox da SF nao tem imapflow. So abre com EXAMINE e so
// baixa com BODY.PEEK: a caixa nao muda (nem o "lido"). Nenhuma mensagem de erro carrega a senha.
function imapSessao(socket) {
  let buf = Buffer.alloc(0);
  let atual = { texto: '', literais: [] };
  let linhas = [];
  let espera = null;
  let seq = 0;
  let falha = null;
  const encerrar = (e) => { falha = e; if (espera) { const f = espera; espera = null; f.rejeitar(e); } };
  function consumir() {
    for (;;) {
      const fim = buf.indexOf('\r\n');
      if (fim < 0) return;
      const linha = buf.slice(0, fim).toString('latin1');
      const lit = /\{(\d+)\}$/.exec(linha);
      if (lit) {
        const n = Number(lit[1]);
        if (buf.length < fim + 2 + n) return;
        atual.texto += linha;
        atual.literais.push(buf.slice(fim + 2, fim + 2 + n));
        buf = buf.slice(fim + 2 + n);
        continue;
      }
      buf = buf.slice(fim + 2);
      atual.texto += linha;
      const pronta = atual;
      atual = { texto: '', literais: [] };
      if (espera && espera.tag && pronta.texto.startsWith(espera.tag + ' ')) {
        const f = espera; espera = null;
        const ok = pronta.texto.slice(f.tag.length + 1).startsWith('OK');
        if (ok) f.resolver(linhas);
        else f.rejeitar(new Error('O servidor de e-mail recusou: ' + pronta.texto.slice(f.tag.length + 1, 200)));
        linhas = [];
      } else if (espera && !espera.tag && pronta.texto.startsWith('* ')) {
        const f = espera; espera = null;
        f.resolver([pronta]);
      } else {
        linhas.push(pronta);
      }
    }
  }
  socket.on('data', (d) => { buf = Buffer.concat([buf, d]); consumir(); });
  socket.on('error', (e) => encerrar(new Error('Falha de rede com o servidor de e-mail: ' + (e.code || 'erro'))));
  socket.on('close', () => encerrar(new Error('O servidor de e-mail encerrou a conexão.')));
  const aguardar = (tag) => new Promise((resolver, rejeitar) => {
    if (falha) return rejeitar(falha);
    const t = setTimeout(() => encerrar(new Error('O servidor de e-mail não respondeu a tempo.')), 60000);
    espera = { tag, resolver: (v) => { clearTimeout(t); resolver(v); }, rejeitar: (e) => { clearTimeout(t); rejeitar(e); } };
    consumir();
  });
  return {
    saudacao: () => aguardar(null),
    comando(texto) {
      const tag = 'A' + (++seq);
      const p = aguardar(tag);
      socket.write(tag + ' ' + texto + '\r\n');
      return p;
    },
    fechar() { falha = falha || new Error('fechada'); try { socket.destroy(); } catch (_) { /* ja fechada */ } },
  };
}

const imapAspas = (s) => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';

function imapDecodificar(bytes, charset) {
  try { return new TextDecoder(/^(utf-?8|iso-8859-\d+|windows-\d+)$/i.test(charset || '') ? charset : 'utf-8').decode(bytes); } catch (_) { return Buffer.from(bytes).toString('latin1'); }
}

function imapQp(s, cabecalho) {
  const t = cabecalho ? s.replace(/_/g, ' ') : s.replace(/=\r?\n/g, '');
  const saida = [];
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(t.slice(i + 1, i + 3))) { saida.push(parseInt(t.slice(i + 1, i + 3), 16)); i += 2; } else saida.push(t.charCodeAt(i) & 255);
  }
  return Buffer.from(saida);
}

// Assunto e nome de arquivo chegam como =?charset?B|Q?...?=
function imapPalavraMime(s) {
  return String(s || '').replace(/\?=\s+=\?/g, '?==?').replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, cs, enc, v) => imapDecodificar(/b/i.test(enc) ? Buffer.from(v, 'base64') : imapQp(v, true), cs));
}

function imapCabecalhos(texto) {
  const cab = {};
  texto.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/).forEach((l) => {
    const i = l.indexOf(':');
    if (i > 0) { const k = l.slice(0, i).trim().toLowerCase(); if (!(k in cab)) cab[k] = l.slice(i + 1).trim(); }
  });
  return cab;
}

function imapParametro(valor, nome) {
  const v = String(valor || '');
  const estendido = [...v.matchAll(new RegExp(nome + '\\*(\\d*)\\*?=\\s*"?([^";]*)"?', 'gi'))];
  if (estendido.length) {
    const junto = estendido.map((m) => m[2]).join('');
    const m = /^([^']*)'[^']*'(.*)$/.exec(junto);
    if (m) return imapDecodificar(Buffer.from(m[2].replace(/%([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))), 'latin1'), m[1]);
    return junto;
  }
  const s = new RegExp('(?:^|[;\\s])' + nome + '=\\s*(?:"([^"]*)"|([^;\\s]+))', 'i').exec(v);
  return s ? imapPalavraMime(s[1] != null ? s[1] : s[2]) : '';
}

function imapAnexosPdf(bruto, saida, prof, ext) {
  const extensao = ext || /\.pdf$/i;
  saida = saida || [];
  const prf = prof || 0;
  if (prf > 10) return saida;
  let corte = bruto.indexOf('\r\n\r\n');
  let salto = 4;
  if (corte < 0) { corte = bruto.indexOf('\n\n'); salto = 2; }
  if (corte < 0) return saida;
  const cab = imapCabecalhos(bruto.slice(0, corte).toString('latin1'));
  const corpo = bruto.slice(corte + salto);
  const tipo = String(cab['content-type'] || 'text/plain');
  if (/^multipart\//i.test(tipo)) {
    const fronteira = imapParametro(tipo, 'boundary');
    if (!fronteira) return saida;
    const marca = Buffer.from('--' + fronteira);
    let pos = corpo.indexOf(marca);
    while (pos >= 0) {
      const inicio = pos + marca.length;
      if (corpo.slice(inicio, inicio + 2).toString() === '--') break;
      const prox = corpo.indexOf(marca, inicio);
      const parte = corpo.slice(inicio, prox < 0 ? corpo.length : prox);
      imapAnexosPdf(parte.slice(parte.indexOf('\n') + 1), saida, prf + 1, extensao);
      pos = prox;
    }
    return saida;
  }
  if (/^message\/rfc822/i.test(tipo)) return imapAnexosPdf(corpo, saida, prf + 1, extensao);
  const nome = imapParametro(cab['content-disposition'], 'filename') || imapParametro(tipo, 'name');
  if (!extensao.test(nome)) return saida;
  const enc = String(cab['content-transfer-encoding'] || '').toLowerCase();
  const buffer = enc === 'base64' ? Buffer.from(corpo.toString('latin1').replace(/\s+/g, ''), 'base64') : enc === 'quoted-printable' ? imapQp(corpo.toString('latin1')) : corpo;
  saida.push({ nome, buffer });
  return saida;
}

const imapSemAcento = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

async function imapAbrir(dados, conectar) {
  const socket = conectar ? conectar() : require('tls').connect(993, dados.host, { servername: dados.host });
  const s = imapSessao(socket);
  await s.saudacao();
  await s.comando('LOGIN ' + imapAspas(dados.usuario) + ' ' + imapAspas(dados.senha));
  const r = await s.comando('EXAMINE INBOX');
  const uv = r.map((l) => /UIDVALIDITY (\d+)/.exec(l.texto)).find(Boolean);
  const existe = r.map((l) => /^\* (\d+) EXISTS/.exec(l.texto)).find(Boolean);
  s.uidValidity = uv ? uv[1] : '0';
  s.total = existe ? Number(existe[1]) : 0;
  return s;
}

// Ids novos primeiro. O cabecalho e a estrutura bastam para filtrar sem baixar anexo.
// Caixa de notas: so XML, sem palavra. E outra caixa, entao o id leva outro prefixo (UIDs se repetem entre caixas).
async function imapCandidatos(s, palavras, dias, agora, notas) {
  const d = new Date((agora || Date.now()) - dias * 86400000);
  const desde = d.getUTCDate() + '-' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()] + '-' + d.getUTCFullYear();
  const achado = (await s.comando('UID SEARCH SINCE ' + desde)).map((l) => /^\* SEARCH(.*)$/.exec(l.texto)).find(Boolean);
  const uids = (achado ? achado[1].trim().split(/\s+/).filter(Boolean) : []).map(Number).sort((a, b) => b - a).slice(0, 200);
  if (!uids.length) return [];
  const linhas = await s.comando('UID FETCH ' + uids.join(',') + ' (UID RFC822.SIZE BODYSTRUCTURE BODY.PEEK[HEADER.FIELDS (SUBJECT)])');
  const lista = palavras.map(imapSemAcento).filter(Boolean);
  const ids = [];
  linhas.forEach((l) => {
    const uid = /\bUID (\d+)/.exec(l.texto);
    if (!uid) return;
    const tam = /RFC822\.SIZE (\d+)/.exec(l.texto);
    if (tam && Number(tam[1]) > 25 * 1024 * 1024) return;
    const est = imapSemAcento(l.texto);
    if (!(notas ? /\.xml|"application" "xml"|"text" "xml"|"application" "octet-stream"/ : /\.pdf|"application" "pdf"|"application" "octet-stream"/).test(est)) return;
    const assunto = l.literais[0] ? imapCabecalhos(l.literais[0].toString('latin1')).subject || '' : '';
    const alvo = imapSemAcento(imapPalavraMime(assunto)) + ' ' + est;
    if (lista.length && !lista.some((p) => alvo.includes(p))) return;
    ids.push(Number(uid[1]));
  });
  return ids.sort((a, b) => b - a).map((u) => (notas ? 'imapnotas:' : 'imap:') + s.uidValidity + ':' + u);
}

// Na caixa de notas, XML que nao e NF-e e descartado aqui, sem chegar ao robo.
const imapEhNfe = (buffer) => /<(nfeProc|NFe)[\s>]/.test(buffer.toString('utf8'));

async function imapBaixar(s, id) {
  const notas = String(id).startsWith('imapnotas:');
  const uid = String(id).split(':')[2];
  const l = (await s.comando('UID FETCH ' + uid + ' (BODY.PEEK[])')).find((x) => x.literais.length);
  if (!l) throw new Error('A mensagem não está mais na caixa.');
  const bruto = l.literais[0];
  const fim = bruto.indexOf('\r\n\r\n');
  const cab = imapCabecalhos(bruto.slice(0, fim < 0 ? bruto.length : fim).toString('latin1'));
  const data = Date.parse(cab.date || '');
  return {
    cab: { from: imapPalavraMime(cab.from), subject: imapPalavraMime(cab.subject) },
    recebido: Number.isNaN(data) ? '' : new Date(data).toISOString().slice(0, 19),
    anexos: notas ? imapAnexosPdf(bruto, [], 0, /\.xml$/i).filter((a) => imapEhNfe(a.buffer)) : imapAnexosPdf(bruto),
  };
}

// A senha fica num arquivo privado, fora de tabela e do log das SFs. So administrador alcanca a key.
async function imapDados(config, caixa) {
  const usuario = caixa === 'notas' ? config.IMAP_NOTAS_USUARIO : config.IMAP_USUARIO;
  if (!config.IMAP_HOST || !usuario) throw new Error('IMAP_SEM_SENHA: caixa não configurada.');
  const linha = await uma(SF.roboImapSegredo, { caixa: caixa || 'boletos' });
  if (!linha || !linha.VALOR) throw new Error('IMAP_SEM_SENHA: a senha da caixa ' + usuario + ' ainda não foi informada, ou você não é administrador.');
  const arq = await sdk.downloadFilePrivateMitra({ projectId: PROJECT_ID, key: linha.VALOR });
  const senha = await arq.text();
  if (!senha || /[\r\n]/.test(senha)) throw new Error('IMAP_SEM_SENHA: a senha guardada é inválida.');
  return { host: config.IMAP_HOST, usuario, senha };
}
