// Recebe so a key do arquivo que a tela subiu: a senha nao passa pelo input, que fica no log.
const key = String(event.key || '');
if (!/^ai-files\/private\/[^,'"]+$/.test(key)) return { ok: false, erro: 'Arquivo inválido.' };
const antes = await uma(SF.roboImapSegredo, {});
await chamar(SF.roboImapGravarKey, { key });
const agora = await uma(SF.roboImapSegredo, {});
if (!agora || agora.VALOR !== key) {
  await sdk.deleteFileMitra({ projectId: PROJECT_ID, key }).catch(() => {});
  return { ok: false, erro: 'Só administrador pode informar a senha da caixa.' };
}
if (antes && antes.VALOR && antes.VALOR !== key) await sdk.deleteFileMitra({ projectId: PROJECT_ID, key: antes.VALOR }).catch(() => {});
return { ok: true };
