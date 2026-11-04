const usuarioId = inteiro(event.usuarioId);
if (!usuarioId) return { ok: false, erro: 'Informe o usuário.' };
const todos = event.todos === true || event.todos === 1 || event.todos === '1' ? 1 : 0;
const tipos = (Array.isArray(event.tipos) ? event.tipos : []).map(inteiro).filter(Boolean).join(',');
const n = await afetou(SF.gravarPermissaoUsuario, { usuarioId, todos });
if (!n) return { ok: false, erro: 'Sem permissão: só o administrador altera acessos.' };
await chamar(SF.limparTiposUsuario, { usuarioId });
if (!todos && tipos) await chamar(SF.gravarTiposUsuario, { usuarioId, tipos });
return { ok: true };
