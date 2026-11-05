// Motor de leitura isolado: sem servidor e sem rede.
import { createRequire } from 'node:module';
import zlib from 'node:zlib';
const require = createRequire(import.meta.url);
const { lerDocumento, pontuar, chaveValida, chavePlausivel, hashConteudo } = require('./leitura.cjs');

let falhas = 0;
const conf = (nome, ok, extra = '') => { console.log(`${ok ? 'OK  ' : 'FALHA'} ${nome} ${extra}`); if (!ok) falhas++; };

function dv(ch43) {
  let soma = 0; let peso = 2;
  for (let i = 42; i >= 0; i--) { soma += Number(ch43[i]) * peso; peso = peso === 9 ? 2 : peso + 1; }
  const r = soma % 11; return r < 2 ? 0 : 11 - r;
}
const base = '35240611222333000181' + '55' + '001' + '000012345' + '1' + '12345678';
const CHAVE = base + dv(base);
conf('modulo 11 aceita chave correta', chaveValida(CHAVE));
conf('modulo 11 recusa digito trocado', !chaveValida(CHAVE.slice(0, 10) + ((Number(CHAVE[10]) + 1) % 10) + CHAVE.slice(11)));

conf('44 zeros passam no modulo 11, mas nao sao chave', chaveValida('0'.repeat(44)) && !chavePlausivel('0'.repeat(44)));
conf('chave real e plausivel', chavePlausivel(CHAVE));

const xml = (cobr) => `<?xml version="1.0"?><nfeProc><NFe><infNFe Id="NFe${CHAVE}"><ide><nNF>12345</nNF><serie>1</serie><dhEmi>2024-06-10T10:00:00-03:00</dhEmi></ide>
<emit><CNPJ>11222333000181</CNPJ><xNome>Fornecedor &amp; Filhos</xNome></emit><dest><CNPJ>99888777000166</CNPJ><xNome>Empresa Destino</xNome></dest>
<det nItem="1"><prod><xProd>Item A</xProd><qCom>2.0000</qCom><vUnCom>50.00</vUnCom></prod></det><total><ICMSTot><vNF>100.00</vNF></ICMSTot></total>${cobr}</infNFe></NFe></nfeProc>`;
const empresa = { ID: 1, NOME: 'Empresa Destino', CNPJ: '99888777000166' };
const lx = lerDocumento('n.xml', Buffer.from(xml('<cobr><dup><dVenc>2024-07-10</dVenc></dup></cobr>')));
const px = pontuar(lx, empresa);
conf('XML le campos', lx.numero === '12345' && lx.valorTotal === 100 && lx.dataVencimento === '2024-07-10' && lx.nomeEmitente === 'Fornecedor & Filhos' && lx.itens.length === 1);
conf('XML chega a 100', px.confianca === 100, `(${px.confianca})`);
const lv = lerDocumento('n.xml', Buffer.from(xml('')));
conf('XML a vista pontua vencimento', pontuar(lv, empresa).criterios.find((c) => c.codigo === 'VENCIMENTO').pontos === 15);
conf('XML sem empresa perde destinatario', pontuar(lx, null).confianca === 90);
const outroEmit = lerDocumento('n.xml', Buffer.from(xml('').replace('<CNPJ>11222333000181</CNPJ>', '<CNPJ>44555666000177</CNPJ>')));
conf('chave de outro emitente perde 10', pontuar(outroEmit, empresa).criterios[0].pontos === 30);

function pdfCom(conteudos) {
  let s = '%PDF-1.4\n';
  const partes = [Buffer.from(s, 'latin1')];
  conteudos.forEach((c, i) => {
    const comp = zlib.deflateSync(Buffer.from(c, 'latin1'));
    partes.push(Buffer.from(`${i + 1} 0 obj\n<< /Length ${comp.length} /Filter /FlateDecode >>\nstream\n`, 'latin1'), comp, Buffer.from('\nendstream\nendobj\n', 'latin1'));
  });
  partes.push(Buffer.from('%%EOF', 'latin1'));
  return Buffer.concat(partes);
}
const pagina = `BT (DANFE) Tj 0 -12 Td (CHAVE DE ACESSO ${CHAVE}) Tj 0 -12 Td (DESTINATARIO 99.888.777/0001-66) Tj 0 -12 Td (DATA DE EMISSAO 10/06/2024) Tj 0 -12 Td (VENCIMENTO 10/07/2024) Tj 0 -12 Td (VALOR TOTAL DA NOTA 1.234,56) Tj ET`;
const lp = lerDocumento('n.pdf', pdfCom([pagina]));
const pp = pontuar(lp, empresa);
conf('PDF de sistema le texto comprimido', lp.chave === CHAVE && lp.valorTotal === 1234.56 && lp.dataEmissao === '2024-06-10' && lp.dataVencimento === '2024-07-10');
conf('PDF de sistema chega a 100', pp.confianca === 100, `(${pp.confianca})`);

// Fonte em subconjunto: hexadecimal de 4 digitos e indice de glifo, traduzido pelo ToUnicode.
const glifos = {}; let prox = 3;
const hexDe = (t) => [...t].map((ch) => { if (!glifos[ch]) glifos[ch] = (prox++).toString(16).padStart(4, '0').toUpperCase(); return glifos[ch]; }).join('');
const pagGlifo = `BT [<${hexDe('VALOR TOTAL DA NOTA')}>] TJ 0 -12 Td [<${hexDe('987,65')}>] TJ 0 -12 Td [<${hexDe('EMISSAO')}>] TJ 0 -12 Td [<${hexDe('01/02/2024')}>] TJ ET`;
const cmap = `/CIDInit begincmap\n${Object.keys(glifos).length} beginbfchar\n${Object.entries(glifos).map(([ch, g]) => `<${g}> <${ch.charCodeAt(0).toString(16).padStart(4, '0').toUpperCase()}>`).join('\n')}\nendbfchar\nendcmap`;
const lg = lerDocumento('g.pdf', pdfCom([pagGlifo, cmap]));
conf('PDF com ToUnicode decodifica glifos', lg.valorTotal === 987.65 && lg.dataEmissao === '2024-02-01', `(${lg.texto.slice(0, 60)})`);
conf('PDF com ToUnicode nao marca zero', pontuar(lg, null).confianca >= 35);

const lf = lerDocumento('foto.pdf', Buffer.from('%PDF-1.4\n1 0 obj\n<< /Filter /DCTDecode /Length 3 >>\nstream\nabc\nendstream\nendobj\n'));
conf('PDF que e foto cai em zero', pontuar(lf, null).confianca === 0);
conf('hash estavel', hashConteudo(Buffer.from('a')) === hashConteudo(Buffer.from('a')) && hashConteudo(Buffer.from('a')).length === 64);

const NFSE = '31702062207951563000295000000000044626110801955830';
const pNfse = `BT (DANFSe v2.0 Documento Auxiliar da NFS-e) Tj 0 -12 Td (CHAVE DE ACESSO DA NFS-e ${NFSE}) Tj 0 -12 Td (DATA E HORA DA EMISSAO DA NFS-e 05/11/2026 13:59:22) Tj 0 -12 Td (EMITENTE DA NFS- e Prestador) Tj 0 -12 Td (Nome / Nome Empresarial BRASIL CLOUD SERVICOS LTDA Municipio / Sigla UF Uberlandia) Tj 0 -12 Td (TOMADOR 07.542.498/0001- 63) Tj 0 -12 Td (DESTINATARIO DAS NOTAS) Tj 0 -12 Td (Valor Liquido da NFS-e R$ 1.234,56) Tj ET`;
const ln = lerDocumento('n.pdf', pdfCom([pNfse]));
conf('NFS-e nacional: chave, emitente, numero e tipo nota', ln.chave === NFSE && ln.modelo === 'NFSE' && ln.cnpjEmitente === '07951563000295' && ln.numero === '446' && ln.tipoProvavel === 'NOTA_FISCAL', JSON.stringify({ c: ln.chave, e: ln.cnpjEmitente, n: ln.numero, t: ln.tipoProvavel }));
conf('CNPJ com espaco depois do hifen', ln.cnpjsCandidatos.includes('07542498000163'), JSON.stringify(ln.cnpjsCandidatos));
conf('NFS-e: nome do prestador, nao o rotulo', ln.nomeEmitente === 'BRASIL CLOUD SERVICOS LTDA', ln.nomeEmitente);
conf('NFS-e: valor liquido e emissao', ln.valorTotal === 1234.56 && ln.dataEmissao === '2026-11-05', JSON.stringify({ v: ln.valorTotal, d: ln.dataEmissao }));
conf('NFS-e nunca passa do corte padrao', pontuar(ln, { NOME: 'X' }).confianca < 90, String(pontuar(ln, { NOME: 'X' }).confianca));
conf('chave NFS-e com digito trocado e recusada', !lerDocumento('n.pdf', pdfCom([pNfse.replace(NFSE, NFSE.slice(0, 49) + '1')])).chave);

console.log(falhas ? `\n${falhas} falha(s).` : '\nMotor de leitura OK.');
process.exit(falhas ? 1 : 0);
