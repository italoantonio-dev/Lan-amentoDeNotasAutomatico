// V-17: a chamada de integracao exposta pela biblioteca do navegador contorna a porta unica?
// So envia SELECT 1 FROM DUAL pelo servico de consulta. Nunca envia gravacao, em nenhum caso.
//   node _smoke-v17.mjs
//   MITRA_TOKEN_BUSINESS=<jwt de um usuario business de teste> node _smoke-v17.mjs
import dotenv from 'dotenv';
dotenv.config({ path: new URL('./.env', import.meta.url).pathname, quiet: true });

const BASE = process.env.MITRA_BASE_URL;
const PROJETO = Number(process.env.MITRA_PROJECT_ID);
const LEITURA = 'DbExplorerSP.executeQuery';
const pedido = {
  integrationSlug: 'sankhya', projectId: PROJETO, method: 'POST',
  endpoint: `/gateway/v1/mge/service.sbr?serviceName=${LEITURA}&outputType=json`,
  body: { serviceName: LEITURA, requestBody: { sql: 'SELECT 1 AS X FROM DUAL' } },
};

async function sondar(rotulo, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(`${BASE}/interactions/integrations/call`, { method: 'POST', headers, body: JSON.stringify(pedido) });
  const texto = await r.text();
  let corpo; try { corpo = JSON.parse(texto); } catch { corpo = texto; }
  const chegouNoErp = r.ok && String(corpo?.body?.status ?? corpo?.result?.body?.status) === '1';
  console.log(`${rotulo}: HTTP ${r.status} | chegou ao ERP: ${chegouNoErp ? 'SIM' : 'nao'}${r.ok ? '' : ` | ${String(corpo?.message ?? corpo?.error ?? texto).slice(0, 160)}`}`);
  return { status: r.status, chegouNoErp };
}

let falhas = 0;
const anonimo = await sondar('sem token', '');
if (anonimo.chegouNoErp) { falhas++; console.log('FALHA: sem token chegou ao ERP.'); }
const invalido = await sondar('token invalido', 'eyJhbGciOiJIUzI1NiJ9.e30.invalido');
if (invalido.chegouNoErp) { falhas++; console.log('FALHA: token invalido chegou ao ERP.'); }
const dev = await sondar('desenvolvedor', process.env.MITRA_TOKEN);
console.log(`INFO desenvolvedor ${dev.chegouNoErp ? 'alcanca a integracao direto (ele tambem pode alterar as funcoes: nao e fronteira de seguranca para este papel)' : 'nao alcancou a integracao'}.`);
if (process.env.MITRA_TOKEN_BUSINESS) {
  const business = await sondar('business', process.env.MITRA_TOKEN_BUSINESS);
  if (business.chegouNoErp) { falhas++; console.log('FALHA: usuario business contorna a porta unica (V-17 confirmado).'); } else console.log('OK: usuario business nao alcanca a integracao direto.');
} else {
  console.log('PENDENTE: o projeto nao tem usuario business. Rode com MITRA_TOKEN_BUSINESS para concluir o V-17.');
}
process.exit(falhas ? 1 : 0);
