// Robo ponta a ponta em modo simulacao, com desfechos distintos. Nao grava no ERP e nao le a caixa.
// Limpa o que criou; com --limpar, apaga tambem restos de rodadas interrompidas.
import { ex, rows, uma, conf, encerrar, consulta, dml, b64, tipo } from './lib/smoke.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chaveValida } = require('./robo/leitura.cjs');

const MARCA = 'smoke-robo';
async function limpar() {
  await dml(`DELETE D FROM DOCUMENTOS D LEFT JOIN LANCAMENTOS L ON L.DOCUMENTO_ID = D.ID WHERE L.ID IS NULL AND D.ARQUIVO_NOME LIKE '${MARCA}%'`);
  const anexos = await consulta(`SELECT ID, EMAIL_ID, LANCAMENTO_ID FROM ROBO_ANEXO WHERE NOME LIKE '${MARCA}%'`);
  for (const a of anexos) {
    if (a.LANCAMENTO_ID) await ex('excluirLancamento', { id: a.LANCAMENTO_ID }).catch(() => {});
    await dml(`DELETE FROM ROBO_ANEXO WHERE ID = ${a.ID}`);
    if (a.EMAIL_ID) await dml(`DELETE FROM ROBO_EMAIL WHERE ID = ${a.EMAIL_ID}`);
  }
  await dml(`DELETE FROM ROBO_EMAIL WHERE ASSUNTO LIKE '${MARCA}%' AND ID NOT IN (SELECT EMAIL_ID FROM ROBO_ANEXO WHERE EMAIL_ID IS NOT NULL)`);
}
if (process.argv.includes('--limpar')) { await limpar(); console.log('Restos removidos.'); }

function chave(cnpj, numero) {
  const base = `3524${'06'}${cnpj}55001${String(numero).padStart(9, '0')}1${'12345678'}`;
  let soma = 0; let peso = 2;
  for (let i = 42; i >= 0; i--) { soma += Number(base[i]) * peso; peso = peso === 9 ? 2 : peso + 1; }
  const r = soma % 11;
  return base + (r < 2 ? 0 : 11 - r);
}
const n = () => Date.now() % 100000000;
const FORN = '11222333000181';
const xml = (destino, numero, valor) => `<?xml version="1.0"?><nfeProc><NFe><infNFe Id="NFe${chave(FORN, numero)}"><ide><nNF>${numero}</nNF><serie>1</serie><dhEmi>2026-01-10T10:00:00-03:00</dhEmi></ide><emit><CNPJ>${FORN}</CNPJ><xNome>Fornecedor Robo</xNome></emit><dest><CNPJ>${destino}</CNPJ></dest><det nItem="1"><prod><xProd>Item</xProd><qCom>1</qCom><vUnCom>${valor}</vUnCom></prod></det><total><ICMSTot><vNF>${valor}</vNF></ICMSTot></total><cobr><dup><dVenc>2026-02-10</dVenc></dup></cobr></infNFe></NFe></nfeProc>`;

const e = (await consulta(`SELECT ID, CODEMP, NOME, CNPJ FROM EMPRESAS WHERE ATIVO = TRUE AND LENGTH(CNPJ) = 14 AND CNPJ <> '00000000000000' ORDER BY ID LIMIT 1`))[0];
const t = await tipo('NOTA_FISCAL');
const antes = await uma('parametroComEmpresa', { empresaId: e.ID, tipoId: t.ID });
const entrada = (o) => ({ empresaId: e.ID, tipoId: t.ID, topId: 0, naturezaId: 0, centroId: 0, contaId: 0, limite: 0, destino: 'NOTA', codTipTit: 0, codProdPadrao: 0, ...o });
const entregar = (nome, conteudo) => ex('roboProcessarAnexo', { nome: `${MARCA}-${nome}`, conteudoB64: b64(conteudo) });
const antesErp = (await consulta('SELECT COUNT(*) AS N FROM ERP_ENVIO'))[0].N;
try {
  const numero = n();
  conf('chave de teste confere', chaveValida(chave(FORN, numero)));

  const semEmpresa = await entregar('sem-empresa.xml', xml('99999999000199', n() + 1, '10.00'));
  conf('destinatario sem empresa fica na caixa com o motivo', semEmpresa.decisao === 'SEM_EMPRESA' && !semEmpresa.lancamentoId, semEmpresa.motivo);

  await ex('salvarParametro', entrada({ limite: 0 }));
  const acima = await entregar('acima.xml', xml(e.CNPJ, numero, '5000.00'));
  conf('leitura perfeita acima da alcada vai para aprovacao', acima.decisao === 'APROVACAO' && acima.confianca === 100, `${acima.confianca} · ${acima.motivo}`);
  conf('justificativa volta criterio a criterio', acima.criterios.length === 5 && acima.criterios.every((c) => c.detalhe));

  const dup = await entregar('dup.xml', xml(e.CNPJ, numero, '5000.00'));
  conf('mesmo arquivo vira duplicado, sem segundo lancamento', dup.decisao === 'DUPLICADO' && Number(dup.lancamentoId) === Number(acima.lancamentoId), dup.motivo);

  await ex('salvarParametro', entrada({ limite: 1000000 }));
  const dentro = await entregar('dentro.xml', xml(e.CNPJ, n() + 2, '10.00'));
  conf('dentro da alcada, para no parceiro sem tocar no ERP', dentro.decisao === 'ERRO' && /envio pararia/.test(dentro.motivo), dentro.motivo);

  const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Filter /DCTDecode /Length 3 >>\nstream\nabc\nendstream\nendobj\n', 'latin1').toString('latin1');
  const foto = await ex('roboProcessarAnexo', { nome: `${MARCA}-foto.pdf`, conteudoB64: Buffer.from(pdf, 'latin1').toString('base64') });
  conf('foto de papel cai em zero e nao vira lancamento errado', foto.decisao === 'SEM_EMPRESA' && foto.confianca === 0, foto.motivo);

  await ex('roboSalvarConfig', { chave: 'CORTE_CONFIANCA', valor: '100' });
  const semChave = xml(e.CNPJ, n() + 3, '10.00').replace(/Id="NFe\d{44}"/, 'Id="NFe00000000000000000000000000000000000000000000"');
  const abaixo = await entregar('abaixo.xml', semChave);
  conf('abaixo do corte vai para revisao de leitura', abaixo.decisao === 'REVISAO' && abaixo.confianca < 100, abaixo.motivo);
  const lrev = await uma('obterLancamento', { id: abaixo.lancamentoId });
  conf('revisao de leitura e uma situacao do lancamento', lrev.STATUS === 'REVISAO_LEITURA', lrev.STATUS);
  const barrado = await ex('enviarLancamentoParaErp', { lancamentoId: abaixo.lancamentoId, simular: 'S' });
  conf('revisao de leitura nao vai ao ERP', barrado.ok === false && barrado.motivo === 'REVISAO_LEITURA');

  const fila = await rows('roboListarAnexos', { decisao: '', limite: 30, offset: 0 });
  conf('tudo aparece na caixa de entrada', fila.filter((a) => a.NOME.startsWith(MARCA)).length >= 6);
  conf('detalhe traz os criterios', JSON.parse((await uma('roboObterAnexo', { id: fila.find((a) => a.NOME.startsWith(MARCA)).ID })).CRITERIOS).length === 5);

  const caixa = await ex('roboTestarCaixa');
  conf('caixa sem credencial diz que nao esta conectada', caixa.ok === false, String(caixa.erro).slice(0, 120));
  const rodada = await ex('roboVarrerEmails', { origem: 'BOTAO' });
  conf('busca sem caixa conectada nao devolve "0 mensagens"', rodada.ok === false && Boolean(rodada.erro), String(rodada.erro).slice(0, 120));
  const exec = await uma('roboUltimaExecucao');
  conf('a rodada registra o motivo real', exec.STATUS === 'ERRO' && Boolean(exec.MENSAGEM));
  await dml(`DELETE FROM ROBO_EXECUCAO WHERE ID = ${exec.ID}`);
  conf('simulacao nao registrou envio ao ERP', (await consulta('SELECT COUNT(*) AS N FROM ERP_ENVIO'))[0].N === antesErp);
} finally {
  await ex('roboSalvarConfig', { chave: 'CORTE_CONFIANCA', valor: '90' });
  await limpar();
  const atual = await uma('parametroComEmpresa', { empresaId: e.ID, tipoId: t.ID });
  if (!antes && atual) await ex('excluirParametro', { id: atual.ID });
}
encerrar('Robo');
