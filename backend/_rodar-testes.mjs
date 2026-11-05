// Roda os testes em sequencia, cada um numa janela nova do limite por minuto (que soma as chamadas
// internas das SFs). Uso: node _rodar-testes.mjs [arquivo ...]
import { spawnSync } from 'node:child_process';

const PADRAO = ['_teste-isolamento-parametros', '_smoke-aprovadores', '_smoke-test', '_smoke-erp', '_smoke-padrao', '_smoke-parametros', '_smoke-erp-nota', '_smoke-parceiro-duplicidade', '_smoke-robo', '_smoke-bloqueio-erp'];
const lista = process.argv.slice(2).length ? process.argv.slice(2) : PADRAO;
const PAUSA = Number(process.env.SMOKE_PAUSA_MS ?? 65000);
const resultado = [];
for (const [i, nome] of lista.entries()) {
  if (i) await new Promise((ok) => setTimeout(ok, PAUSA));
  const r = spawnSync('node', [`${nome.replace(/\.mjs$/, '')}.mjs`], { encoding: 'utf8', cwd: new URL('.', import.meta.url).pathname });
  const saida = `${r.stdout}${r.stderr}`;
  const ok = (saida.match(/^OK /gm) ?? []).length;
  const falhas = saida.split('\n').filter((l) => l.startsWith('FALHA') || /Error/.test(l));
  resultado.push({ nome, codigo: r.status, ok, falhas });
  console.log(`${r.status === 0 ? 'PASSOU' : 'FALHOU'} ${nome} (${ok} verificacoes OK)`);
  for (const f of falhas) console.log(`   ${f.slice(0, 220)}`);
  for (const l of saida.split('\n').filter((x) => /^(INFO|AVISO)/.test(x))) console.log(`   ${l.slice(0, 180)}`);
}
process.exit(resultado.every((x) => x.codigo === 0) ? 0 : 1);
