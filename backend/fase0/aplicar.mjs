// Publica as funcoes que alcancam o ERP (travas da Fase 0 e conferencia das Fases 1 e 2).
// So atualiza SFs existentes (mesmo id), cria as novas da lista, inclui as novas nos perfis e
// atualiza o texto do agente.
//   cd backend && node fase0/aplicar.mjs
// Recusa publicar com a criacao de nota ou a correcao de cadastro ligadas, ou com outra entidade liberada para gravar.
import fs from 'node:fs';
import path from 'node:path';
import { sdk, projectId, sf, consulta, garantirPerfis, DIR_BACKEND } from '../lib/base.mjs';
import { INSTRUCOES_AGENTE } from '../lib/instrucoes-agente.mjs';
import { JS_COM_ERP, SQL_ALTERADAS, codigoEsperado } from './funcoes.mjs';

const fonteErp = fs.readFileSync(path.join(DIR_BACKEND, 'sf/_erp.js'), 'utf8');
if (!/^const ENTIDADES_GRAVAVEIS = \['Financeiro'\];$/m.test(fonteErp)) throw new Error('sf/_erp.js libera gravacao alem do titulo financeiro. Publicacao recusada.');
for (const trava of ['CORRECAO_CADASTRO_HABILITADA', 'CRIACAO_NOTA_HABILITADA']) {
  if (!new RegExp(`^const ${trava} = false;$`, 'm').test(fonteErp)) throw new Error(`sf/_erp.js nao tem "const ${trava} = false;". Publicacao recusada.`);
}
const manifesto = path.join(DIR_BACKEND, 'fase0/antes/manifesto.json');
if (!fs.existsSync(manifesto)) throw new Error('Falta a copia de reversao (fase0/antes). Rode antes: node fase0/snapshot.mjs antes');
const antes = new Map(JSON.parse(fs.readFileSync(manifesto, 'utf8')).funcoes.map((f) => [f.nome, f]));
for (const [nome, f] of Object.entries(JS_COM_ERP)) {
  if (!f.nova && !antes.get(nome)) throw new Error(`${nome} nao esta na copia de reversao: publicacao interrompida antes de alterar.`);
}

const novas = [];
for (const [nome, sql] of Object.entries(SQL_ALTERADAS)) {
  if (!antes.get(nome)) novas.push(nome);
  const id = await sf(nome, 'SQL', sql, antes.get(nome)?.descricao ?? (nome === 'podeEnviarErp' ? 'Diz se o usuario logado pode gravar no ERP (perfil Administrador ou Aprovador)' : nome === 'podeConferirNfe' ? 'Diz se o usuario logado pode conferir nota fiscal (alcance por tipo de documento)' : 'Indicadores da Caixa de entrada'));
  console.log(`publicada ${nome} (${id})`);
}
for (const [nome, f] of Object.entries(JS_COM_ERP)) {
  if (f.nova) novas.push(nome);
  const id = await sf(nome, 'JAVASCRIPT', await codigoEsperado(nome), f.description ?? antes.get(nome).descricao);
  console.log(`publicada ${nome} (${id})`);
}

// Funcao nova de tela entra nos perfis no mesmo turno. A lista e regravada inteira: le a atual e acrescenta.
const mapa = new Map((await sdk.listServerFunctionsMitra({ projectId })).result.map((s) => [s.name, s.id]));
const idsNovos = novas.map((n) => mapa.get(n)).filter(Boolean);
for (const [perfil, profileId] of Object.entries(await garantirPerfis())) {
  const atuais = (await consulta(`SELECT SERVERFUNCTIONID FROM INT_PROFILESERVERFUNCTION WHERE PROFILEID = ${Number(profileId)}`)).map((r) => Number(r.SERVERFUNCTIONID));
  const faltam = idsNovos.filter((id) => !atuais.includes(id));
  if (!faltam.length) continue;
  await sdk.setProfileServerFunctionsMitra({ projectId, profileId, serverFunctionIds: [...atuais, ...faltam] });
  console.log(`perfil ${perfil}: +${faltam.length} (de ${atuais.length} para ${atuais.length + faltam.length})`);
}
await sdk.updateAdditionalBusinessInstructionsMitra({ projectId, instructions: INSTRUCOES_AGENTE });
console.log('instrucoes do agente atualizadas');
