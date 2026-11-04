// A tela pede o arquivo pelo registro, nunca pela key: quem confere se o usuario pode ver e a SF SQL.
const id = inteiro(event.id);
const origem = String(event.origem || '');
const fontes = { DOCUMENTO: SF.keyArquivoDocumento, ANEXO_CHAT: SF.keyArquivoAnexoChat, ANEXO_ROBO: SF.keyArquivoAnexoRobo };
if (!id || !fontes[origem]) return { ok: false, erro: 'Pedido inválido.' };
const r = await uma(fontes[origem], { id });
if (!r || !r.CHAVE_ARQUIVO) return { ok: false, erro: 'Arquivo não encontrado ou sem permissão.' };
const link = await sdk.getFileLinkMitra({ projectId: PROJECT_ID, key: r.CHAVE_ARQUIVO, ttlSeconds: 300 });
return { ok: true, url: link.result.url, nome: r.NOME };
