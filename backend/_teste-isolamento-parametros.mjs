// Prova do isolamento dos smokes, sem tocar em parametro real: a recusa acontece antes de chamar o servidor.
import fs from 'node:fs';
import { conf, encerrar, ex, consulta, primeiraEmpresa, tipo, abrirIsolamento } from './lib/smoke.mjs';

const recusa = async (fn) => { try { await fn(); return null; } catch (e) { return e.message; } };
const real = await primeiraEmpresa();
const t = await tipo('BOLETO');
const linha = { empresaId: real.ID, tipoId: t.ID, topId: 0, naturezaId: 0, centroId: 0, contaId: 0, limite: 0, destino: 'FINANCEIRO', codTipTit: 0, codProdPadrao: 0 };
const contar = async () => Number((await consulta('SELECT COUNT(*) AS N FROM PARAMETROS_LANCAMENTO'))[0].N);
const inicio = await contar();

conf('sem isolamento, gravar parametro e recusado', /recusado/.test(await recusa(() => ex('salvarParametro', linha))));
const iso = await abrirIsolamento();
try {
  conf('com isolamento, gravar em par real continua recusado', /recusado: empresa/.test(await recusa(() => ex('salvarParametro', linha))));
  await ex('salvarParametro', { ...linha, empresaId: iso.empresa.ID });
  conf('gravar na empresa de teste funciona', (await contar()) === inicio + 1);
} finally {
  await iso.fechar();
}
conf('tabela voltou ao tamanho inicial', (await contar()) === inicio);
for (const f of ['_smoke-erp', '_smoke-padrao', '_smoke-parametros', '_smoke-erp-nota', '_smoke-parceiro-duplicidade', '_smoke-robo']) {
  const s = fs.readFileSync(new URL(`./${f}.mjs`, import.meta.url), 'utf8');
  conf(`${f} abre e fecha o isolamento`, s.includes('abrirIsolamento()') && s.includes('iso.fechar()'));
}
encerrar('Isolamento de parametros');
