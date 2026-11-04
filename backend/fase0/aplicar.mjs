// Fase 0: publica as travas. So atualiza SFs que ja existem (mesmo id) e o texto do agente.
//   cd backend && node fase0/aplicar.mjs
// Recusa publicar se a trava estiver ligada no fonte: este script nao serve para religar gravacao.
import fs from 'node:fs';
import path from 'node:path';
import { sdk, projectId, sf, DIR_BACKEND } from '../lib/base.mjs';
import { INSTRUCOES_AGENTE } from '../lib/instrucoes-agente.mjs';
import { JS_COM_ERP, SQL_ALTERADAS, codigoEsperado } from './funcoes.mjs';

const fonteErp = fs.readFileSync(path.join(DIR_BACKEND, 'sf/_erp.js'), 'utf8');
if (!/^const GRAVACAO_ERP_HABILITADA = false;$/m.test(fonteErp)) {
  throw new Error('sf/_erp.js nao tem "const GRAVACAO_ERP_HABILITADA = false;". Publicacao recusada.');
}
const manifesto = path.join(DIR_BACKEND, 'fase0/antes/manifesto.json');
if (!fs.existsSync(manifesto)) throw new Error('Falta a copia de reversao (fase0/antes). Rode antes: node fase0/snapshot.mjs antes');
const antes = new Map(JSON.parse(fs.readFileSync(manifesto, 'utf8')).funcoes.map((f) => [f.nome, f]));

for (const [nome, f] of Object.entries(JS_COM_ERP)) {
  const anterior = antes.get(nome);
  if (!anterior) throw new Error(`${nome} nao esta na copia de reversao: publicacao interrompida antes de alterar.`);
}
for (const [nome, f] of Object.entries(JS_COM_ERP)) {
  const id = await sf(nome, 'JAVASCRIPT', await codigoEsperado(nome), f.description ?? antes.get(nome).descricao);
  console.log(`publicada ${nome} (${id})`);
}
for (const [nome, sql] of Object.entries(SQL_ALTERADAS)) {
  const id = await sf(nome, 'SQL', sql, antes.get(nome)?.descricao ?? 'Indicadores da Caixa de entrada');
  console.log(`publicada ${nome} (${id})`);
}
await sdk.updateAdditionalBusinessInstructionsMitra({ projectId, instructions: INSTRUCOES_AGENTE });
console.log('instrucoes do agente atualizadas');
console.log('Fase 0 publicada. Guarde o estado: node fase0/snapshot.mjs depois');
