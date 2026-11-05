// O selo da tela de Integracoes fica vermelho para sempre em conector proprio (nao ha endpoint
// de teste): quem decide e a chamada real.
const cfg = {};
(await listar(SF.roboLerConfig, {})).forEach((r) => { cfg[r.CHAVE] = r.VALOR; });
if (cfg.INTEGRACAO === 'imap') {
  // Cada caixa responde por si: uma sem senha nao esconde o resultado da outra.
  const conectadas = [];
  const erros = [];
  for (const caixa of ['boletos', 'notas']) {
    let s = null;
    try {
      const dados = await imapDados(cfg, caixa);
      s = await imapAbrir(dados);
      conectadas.push(dados.usuario + ' (' + s.total + ' mensagens)');
    } catch (e) {
      erros.push(caixa + ': ' + msgErro(e).replace('IMAP_SEM_SENHA: ', ''));
    } finally {
      if (s) s.fechar();
    }
  }
  return { ok: !erros.length, caixas: conectadas, erro: conectadas.concat(erros).join('; ') };
}
try {
  const r = await sdk.callIntegrationMitra({ projectId: PROJECT_ID, connection: cfg.INTEGRACAO || 'gmail', method: 'GET', endpoint: '/gmail/v1/users/me/profile' });
  const http = Number(r && r.statusCode);
  if (http >= 400) return { ok: false, erro: 'A caixa respondeu HTTP ' + http + ': ' + msgErro(r.body) };
  return { ok: true, email: r.body.emailAddress, mensagens: r.body.messagesTotal };
} catch (e) {
  return { ok: false, naoConectada: true, erro: msgErro(e) };
}
