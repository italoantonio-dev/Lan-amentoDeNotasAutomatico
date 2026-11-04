// Reversao da Fase 0: devolve o codigo e a descricao publicados ANTES das travas.
// ATENCAO: isso RELIGA a gravacao no ERP de producao (envio de titulo e nota, correcao de
// cadastro, envio automatico do robo). So com autorizacao escrita do Grupo Lidon.
//   cd backend && node fase0/reverter.mjs --religa-gravacao-erp --autorizacao "<quem, quando, onde>"
// Sem os dois argumentos, so mostra o que seria restaurado.
import fs from 'node:fs';
import path from 'node:path';
import { sdk, projectId, DIR_BACKEND } from '../lib/base.mjs';

const args = process.argv.slice(2);
const i = args.indexOf('--autorizacao');
const autorizacao = i >= 0 ? String(args[i + 1] || '').trim() : '';
const executar = args.includes('--religa-gravacao-erp') && autorizacao.length >= 10;

const pasta = path.join(DIR_BACKEND, 'fase0/antes');
const m = JSON.parse(fs.readFileSync(path.join(pasta, 'manifesto.json'), 'utf8'));
if (m.projectId !== projectId) throw new Error(`Copia de outro projeto (${m.projectId}).`);

// So as SFs que a Fase 0 alterou; as demais da copia ficam como estao.
const { JS_COM_ERP, SQL_ALTERADAS } = await import('./funcoes.mjs');
const alvo = new Set([...Object.keys(JS_COM_ERP), ...Object.keys(SQL_ALTERADAS)]);
const restaurar = m.funcoes.filter((f) => alvo.has(f.nome));

console.log(`${restaurar.length} funcoes seriam restauradas para o estado de ${m.geradoEm}:`);
restaurar.forEach((f) => console.log(`  ${f.id} ${f.nome}`));
if (!executar) {
  console.log('\nNada foi alterado. Para executar: --religa-gravacao-erp --autorizacao "<quem autorizou, quando, por qual meio>"');
  process.exit(0);
}
for (const f of restaurar) {
  const code = fs.readFileSync(path.join(pasta, f.arquivo), 'utf8');
  await sdk.updateServerFunctionMitra({ projectId, serverFunctionId: f.id, code, description: f.descricao });
  console.log(`restaurada ${f.nome}`);
}
fs.appendFileSync(path.join(DIR_BACKEND, 'fase0/reversoes.log'), `${new Date().toISOString()} restauradas ${restaurar.length} SFs. Autorizacao: ${autorizacao}\n`);
console.log('\nGravacao no ERP RELIGADA. Instrucoes do agente e telas voltam por git revert do commit da Fase 0 (ver fase0-plano-execucao.md).');
