// Cliente IMAP contra um servidor falso local: nao toca em caixa real nem na plataforma.
import fs from 'node:fs';
import net from 'node:net';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const f = fs.readFileSync(new URL('./sf/_imap.js', import.meta.url), 'utf8');
const api = new Function('require', 'Buffer', 'SF', 'uma', 'sdk', 'PROJECT_ID', `${f}; return { imapAbrir, imapCandidatos, imapBaixar, imapAspas };`)(require, Buffer, {}, null, null, 0);
let falhas = 0;
const conf = (n, ok, x = '') => { console.log(`${ok ? 'OK' : 'FALHA'} ${n}${ok ? '' : ' ' + x}`); if (!ok) falhas++; };
const pdf = Buffer.from('%PDF-1.4 boleto binario é', 'latin1');
const msg = Buffer.from([
  'From: =?UTF-8?B?TG9jYWxpemE=?= <a@b.com>', 'Subject: =?ISO-8859-1?Q?Cobran=E7a?=', 'Date: Thu, 05 Nov 2026 10:00:00 -0300',
  'Content-Type: multipart/mixed; boundary="x1"', '', '--x1', 'Content-Type: text/plain', '', 'corpo', '--x1',
  'Content-Type: application/pdf', "Content-Disposition: attachment; filename*=UTF-8''cobran%C3%A7a.pdf", 'Content-Transfer-Encoding: base64', '', pdf.toString('base64'), '--x1',
  'Content-Type: image/png; name="a.png"', 'Content-Transfer-Encoding: base64', '', 'AAAA', '--x1--', ''].join('\r\n'));
const comandos = [];
const srv = net.createServer((s) => {
  s.write('* OK pronto\r\n');
  let b = '';
  s.on('error', () => {});
  s.on('data', (d) => {
    b += d;
    let i;
    while ((i = b.indexOf('\r\n')) >= 0) {
      const l = b.slice(0, i); b = b.slice(i + 2);
      const [tag, ...r] = l.split(' '); const c = r.join(' ');
      comandos.push(c);
      if (c.startsWith('LOGIN')) s.write(c.includes('errada') ? `${tag} NO [AUTHENTICATIONFAILED] falhou\r\n` : `${tag} OK\r\n`);
      else if (c === 'EXAMINE INBOX') s.write(`* 3 EXISTS\r\n* OK [UIDVALIDITY 77] v\r\n${tag} OK [READ-ONLY]\r\n`);
      else if (c.startsWith('UID SEARCH')) s.write(`* SEARCH 10 11 12\r\n${tag} OK\r\n`);
      else if (c.includes('BODYSTRUCTURE')) {
        const h1 = 'Subject: =?ISO-8859-1?Q?Cobran=E7a?=\r\n\r\n'; const h2 = 'Subject: oi\r\n\r\n';
        s.write(`* 1 FETCH (UID 10 RFC822.SIZE 100 BODYSTRUCTURE (("APPLICATION" "PDF" NIL NIL NIL "BASE64" 5)) BODY[HEADER.FIELDS (SUBJECT)] {${h1.length}}\r\n${h1})\r\n`);
        s.write(`* 2 FETCH (UID 11 RFC822.SIZE 100 BODYSTRUCTURE (("APPLICATION" "PDF" NIL NIL NIL "BASE64" 5)) BODY[HEADER.FIELDS (SUBJECT)] {${h2.length}}\r\n${h2})\r\n`);
        s.write(`* 3 FETCH (UID 12 RFC822.SIZE 100 BODYSTRUCTURE ("TEXT" "PLAIN" NIL NIL NIL "7BIT" 5) BODY[HEADER.FIELDS (SUBJECT)] {${h1.length}}\r\n${h1})\r\n${tag} OK\r\n`);
      } else if (c.includes('BODY.PEEK[]')) { s.write(`* 1 FETCH (BODY[] {${msg.length}}\r\n`); s.write(msg); s.write(`)\r\n${tag} OK\r\n`); }
      else s.write(`${tag} BAD\r\n`);
    }
  });
});
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const conectar = () => net.connect(srv.address().port, '127.0.0.1');
const s = await api.imapAbrir({ usuario: 'u', senha: 'a"b\\c' }, conectar);
conf('senha com caractere especial vai escapada', comandos[0] === 'LOGIN "u" "a\\"b\\\\c"', comandos[0]);
conf('abre a caixa somente leitura', comandos.includes('EXAMINE INBOX') && !comandos.includes('SELECT INBOX'));
conf('le total e uidvalidity', s.total === 3 && s.uidValidity === '77');
const ids = await api.imapCandidatos(s, ['cobranca'], 7, Date.UTC(2026, 10, 5));
conf('filtra por PDF e palavra, sem acento', ids.join() === 'imap:77:10', ids.join());
conf('data do SINCE no formato IMAP', comandos.some((c) => c === 'UID SEARCH SINCE 29-Oct-2026'), comandos.join('|'));
const m = await api.imapBaixar(s, ids[0]);
conf('decodifica assunto e remetente', m.cab.subject === 'Cobrança' && m.cab.from.startsWith('Localiza'), JSON.stringify(m.cab));
conf('so o PDF vira anexo, com nome decodificado', m.anexos.length === 1 && m.anexos[0].nome === 'cobrança.pdf', JSON.stringify(m.anexos.map((a) => a.nome)));
conf('conteudo do PDF identico', m.anexos[0].buffer.equals(pdf));
conf('data de recebimento', m.recebido === '2026-11-05T13:00:00', m.recebido);
s.fechar();
conf('nenhum comando altera a caixa', !comandos.some((c) => /STORE|EXPUNGE|DELETE|MOVE|COPY|APPEND|SELECT /.test(c) || /BODY\[\]/.test(c)), comandos.join('|'));
let erro = '';
await api.imapAbrir({ usuario: 'u', senha: 'errada' }, conectar).catch((e) => { erro = e.message; });
conf('login recusado vira erro claro', /AUTHENTICATIONFAILED/.test(erro), erro);
conf('erro nao carrega a senha', !erro.includes('errada'), erro);
srv.close();
process.exit(falhas ? 1 : 0);
