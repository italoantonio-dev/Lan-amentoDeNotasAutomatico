// A mesma funcao atende a tela e o chat: o que muda e o canal, nao a regra.
const d = Object.assign({}, event, { origem: event.origem === 'TELA' ? 'TELA' : 'CHAT' });
const anexoId = inteiro(event.anexoId);
if (anexoId) {
  const a = await uma(SF.chatObterAnexo, { id: anexoId });
  if (!a) return { ok: false, erro: 'Anexo não encontrado nesta conversa.' };
  if (a.STATUS === 'LANCADO') return { ok: false, duplicado: true, lancamentoId: a.LANCAMENTO_ID, erro: 'Este anexo já virou o lançamento ' + a.LANCAMENTO_ID + '.' };
  d.hash = a.HASH; d.arquivoNome = a.NOME; d.arquivoKey = a.URL;
}
const r = await criarLancamentoNucleo(d);
if (r.ok && anexoId) await chamar(SF.chatMarcarAnexoLancado, { id: anexoId, lancamentoId: r.lancamentoId });
return r;
