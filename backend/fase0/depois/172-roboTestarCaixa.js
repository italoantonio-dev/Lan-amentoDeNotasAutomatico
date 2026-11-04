// Apoio comum das SFs JavaScript. Fica em arquivo e e concatenado por lib/base.mjs.
const sdk = require('mitra-sdk');
const PROJECT_ID = Number(process.env.MITRA_PROJECT_ID);
const SF = {"roboLerConfig":157};
let __contador = 0;

function msgErro(e) {
  if (e == null) return 'Erro desconhecido';
  if (typeof e === 'string') return e;
  if (typeof e.message === 'string' && e.message) return e.message;
  if (e.message && typeof e.message === 'object') return msgErro(e.message);
  if (e.error) return msgErro(e.error);
  try { return JSON.stringify(e); } catch (_) { return String(e); }
}

// Toda chamada interna leva o proprio nonce. Falha da SF chamada vira excecao,
// nunca resultado vazio.
async function chamar(id, input) {
  const r = await sdk.executeServerFunctionMitra({
    projectId: PROJECT_ID,
    serverFunctionId: id,
    input: Object.assign({}, input || {}, { _nonce: Date.now() + '-' + ++__contador }),
  });
  const res = r && r.result ? r.result : {};
  if (res.executionStatus === 'FAILED') throw new Error(msgErro(res.error) || 'Falha ao executar a funcao ' + id);
  let out = res.output;
  if (typeof out === 'string') { try { out = JSON.parse(out); } catch (_) { /* mantem texto */ } }
  return out;
}
const linhas = (out) => (out && Array.isArray(out.rows) ? out.rows : []);
async function listar(id, input) { return linhas(await chamar(id, input)); }
async function uma(id, input) { return (await listar(id, input))[0] || null; }
async function afetou(id, input) { const o = await chamar(id, input); return Number((o && o.affectedRows) || 0); }
const paraB64 = (texto) => Buffer.from(String(texto == null ? '' : texto), 'utf8').toString('base64');
const soDigitos = (v) => String(v == null ? '' : v).replace(/\D/g, '');
const inteiro = (v) => { const n = parseInt(String(v), 10); return Number.isFinite(n) ? n : 0; };
const texto = (v, max) => String(v == null ? '' : v).slice(0, max || 500);


// O selo da tela de Integracoes fica vermelho para sempre em conector proprio (nao ha endpoint
// de teste): quem decide e a chamada real.
const cfg = {};
(await listar(SF.roboLerConfig, {})).forEach((r) => { cfg[r.CHAVE] = r.VALOR; });
try {
  const r = await sdk.callIntegrationMitra({ projectId: PROJECT_ID, connection: cfg.INTEGRACAO || 'gmail', method: 'GET', endpoint: '/gmail/v1/users/me/profile' });
  const http = Number(r && r.statusCode);
  if (http >= 400) return { ok: false, erro: 'A caixa respondeu HTTP ' + http + ': ' + msgErro(r.body) };
  return { ok: true, email: r.body.emailAddress, mensagens: r.body.messagesTotal };
} catch (e) {
  return { ok: false, naoConectada: true, erro: msgErro(e) };
}
