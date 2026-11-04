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
