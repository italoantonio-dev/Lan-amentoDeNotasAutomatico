// Corte de leitura: o unico numero que decide se um documento chega ao ERP sem olhar humano.
import { ex, uma, rows, conf, encerrar, comPerfilTemporario, b64, consulta, dml } from './lib/smoke.mjs';

const lerCorte = async () => (await rows('roboLerConfig')).find((c) => c.CHAVE === 'CORTE_CONFIANCA').VALOR;
const original = await lerCorte();
const tenta = (valor) => ex('roboSalvarConfig', { chave: 'CORTE_CONFIANCA', valor });
const mensagens = [];
try {
  for (const invalido of ['', 'abc', '85.5', '-1', '101', '9 0']) {
    const r = await tenta(invalido);
    conf(`recusa "${invalido}"`, Number(r.affectedRows) === 0 && (await lerCorte()) === original);
  }
  const fora = await ex('roboSalvarConfig', { chave: 'ATIVO', valor: 'S' });
  conf('tela nao liga a varredura automatica', Number(fora.affectedRows) === 0);

  await comPerfilTemporario(async (copiar) => {
    const s = await copiar('roboSalvarConfig');
    conf('quem nao e administrador nao altera (zero linhas)', Number((await s({ chave: 'CORTE_CONFIANCA', valor: '10' })).affectedRows) === 0 && (await lerCorte()) === original);
  });

  // O valor salvo e o usado na rodada seguinte: um XML sem destinatario cadastrado e simples o bastante.
  const novo = original === '70' ? '71' : '70';
  await tenta(novo);
  conf('valor valido grava', (await lerCorte()) === novo);
  const e = (await consulta(`SELECT ID, CNPJ FROM EMPRESAS WHERE ATIVO = TRUE AND LENGTH(CNPJ) = 14 AND CNPJ <> '00000000000000' LIMIT 1`))[0];
  const texto = `<?xml version="1.0"?><nfeProc><NFe><infNFe Id="NFe00000000000000000000000000000000000000000000"><ide><nNF>${Date.now() % 100000000}</nNF><serie>1</serie><dhEmi>2026-01-10T10:00:00-03:00</dhEmi></ide><emit><CNPJ>11222333000181</CNPJ><xNome>Fornecedor Ajuste</xNome></emit><dest><CNPJ>${e.CNPJ}</CNPJ></dest><total><ICMSTot><vNF>10.00</vNF></ICMSTot></total></infNFe></NFe></nfeProc>`;
  const r = await ex('roboProcessarAnexo', { nome: 'ajuste.xml', conteudoB64: b64(texto) });
  conf('a rodada seguinte usa o corte novo, e o motivo o registra', new RegExp(`corte ${novo}`).test(r.motivo), r.motivo);
  if (r.lancamentoId) await ex('excluirLancamento', { id: r.lancamentoId });
  const a = (await consulta(`SELECT ID, EMAIL_ID FROM ROBO_ANEXO WHERE NOME = 'ajuste.xml' ORDER BY ID DESC LIMIT 1`))[0];
  if (a) { await dml(`DELETE FROM ROBO_ANEXO WHERE ID = ${a.ID}`); await dml(`DELETE FROM ROBO_EMAIL WHERE ID = ${a.EMAIL_ID}`); }
} finally {
  await tenta(original);
}
conf('valor original restaurado', (await lerCorte()) === original, `corte ${original}`);
conf('roboKpis responde', Boolean(await uma('roboKpis')), mensagens.join());
encerrar('Ajustes');
