const id = inteiro(event.playgroundId);
const chave = String(event.chave || '');
const nome = texto(event.nome, 200).trim();
if (!id || !/^[0-9a-f]{32}$/.test(chave) || !nome) return { ok: false, erro: 'Informe playgroundId, chave e nome.' };
const n = await afetou(SF._playground_gravar_nome, { id, chave, nome: paraB64(nome) });
if (n !== 1) return { ok: false, erro: 'Estudo não encontrado para esta chave.' };
return { ok: true };
