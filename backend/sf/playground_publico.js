const token = String(event.token || '');
if (!/^[0-9a-f]{32}$/.test(token)) return { ok: false, erro: 'Link inválido.' };
const r = await uma(SF._playground_publico_sql, { token });
if (!r) return { ok: false, erro: 'Este estudo não está mais compartilhado.' };
return { ok: true, nome: r.NOME, html: r.HTML, atualizadoEm: r.ATUALIZADO_EM };
