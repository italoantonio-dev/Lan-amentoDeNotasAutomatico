// Guarda o codigo publicado das SFs que a Fase 0 altera, para reversao exata. So le a plataforma.
//   cd backend && node fase0/snapshot.mjs <pasta>
import fs from 'node:fs';
import path from 'node:path';
import { sdk, projectId, DIR_BACKEND } from '../lib/base.mjs';

const pasta = path.join(DIR_BACKEND, 'fase0', process.argv[2] || 'antes');
fs.mkdirSync(pasta, { recursive: true });
const lista = (await sdk.listServerFunctionsMitra({ projectId })).result;
const manifesto = [];
for (const s of lista) {
  const r = await sdk.readServerFunctionMitra({ projectId, serverFunctionId: s.id });
  const code = String(r.result?.code ?? '');
  // Toda SF que carrega o adaptador do ERP, chama integracao ou e citada no inventario de gravacao.
  if (!/SLUG_ERP|callIntegrationMitra|enviarLancamentoParaErp|corrigirCadastroErp|DECISAO = 'LANCADO'/.test(code) && s.type !== 'INTEGRATION') continue;
  const arq = `${s.id}-${s.name}.${s.type === 'JAVASCRIPT' ? 'js' : s.type === 'SQL' ? 'sql' : 'json'}`;
  fs.writeFileSync(path.join(pasta, arq), code);
  manifesto.push({ id: s.id, nome: s.name, tipo: s.type, arquivo: arq, descricao: r.result?.description ?? s.description });
}
fs.writeFileSync(path.join(pasta, 'manifesto.json'), JSON.stringify({ projectId, geradoEm: new Date().toISOString(), funcoes: manifesto }, null, 2));
console.log(`${manifesto.length} funcoes guardadas em ${pasta}`);
