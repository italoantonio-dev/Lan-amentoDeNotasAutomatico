// O selo da tela de Integracoes fica vermelho para sempre em conector proprio (nao ha endpoint
// de teste): quem decide e a chamada real.
const cfg = {};
(await listar(SF.roboLerConfig, {})).forEach((r) => { cfg[r.CHAVE] = r.VALOR; });
if (cfg.INTEGRACAO === 'imap') {
  let s = null;
  try {
    const dados = await imapDados(cfg);
    s = await imapAbrir(dados);
    return { ok: true, email: dados.usuario, mensagens: s.total };
  } catch (e) {
    return { ok: false, naoConectada: /IMAP_SEM_SENHA/.test(msgErro(e)), erro: msgErro(e).replace('IMAP_SEM_SENHA: ', '') };
  } finally {
    if (s) s.fechar();
  }
}
try {
  const r = await sdk.callIntegrationMitra({ projectId: PROJECT_ID, connection: cfg.INTEGRACAO || 'gmail', method: 'GET', endpoint: '/gmail/v1/users/me/profile' });
  const http = Number(r && r.statusCode);
  if (http >= 400) return { ok: false, erro: 'A caixa respondeu HTTP ' + http + ': ' + msgErro(r.body) };
  return { ok: true, email: r.body.emailAddress, mensagens: r.body.messagesTotal };
} catch (e) {
  return { ok: false, naoConectada: true, erro: msgErro(e) };
}
