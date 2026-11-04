// Conversa, ferramentas e isolamento por usuario.
import { ex, rows, uma, conf, encerrar, chave, b64, dml, consulta } from './lib/smoke.mjs';

const k = chave();
await ex('chatCriarConversa', { chave: k, titulo: "Conversa d'Agua Smoke", modelo: '' });
const c = await uma('chatObterConversa', { chave: k, id: 0 });
conf('cria e relê pela chave', Boolean(c?.ID));
let alheia = 0;
try {
  const km = chave();
  await ex('chatSalvarMensagem', { chave: km, conversaId: c.ID, autor: 'USUARIO', conteudo: b64("Olá, ação com 'aspas' e acentuação"), sequencia: 1, status: 'OK' });
  const m = await uma('chatObterMensagemPorChave', { chave: km });
  conf('conteudo com aspas e acento grava em base64', (await rows('chatListarMensagens', { conversaId: c.ID, limite: 10, offset: 0 }))[0].CONTEUDO === "Olá, ação com 'aspas' e acentuação");

  // Checkpoint: rascunho PARCIAL promovido na mesma linha.
  const kr = chave();
  await ex('chatSalvarMensagem', { chave: kr, conversaId: c.ID, autor: 'ASSISTENTE', conteudo: b64('parc'), sequencia: 2, status: 'PARCIAL' });
  const rasc = await uma('chatObterMensagemPorChave', { chave: kr });
  await ex('chatAtualizarMensagem', { id: rasc.ID, conteudo: b64('parcial completo'), status: 'OK' });
  const msgs = await rows('chatListarMensagens', { conversaId: c.ID, limite: 10, offset: 0 });
  conf('rascunho vira a mensagem final sem duplicar', msgs.length === 2 && msgs[1].CONTEUDO === 'parcial completo');
  await ex('chatAtualizarMensagem', { id: rasc.ID, conteudo: b64(''), status: 'DESCARTADA' });
  conf('turno sem texto some da conversa', (await rows('chatListarMensagens', { conversaId: c.ID, limite: 10, offset: 0 })).length === 1);
  conf('contagem nao inclui descartada', Number((await rows('chatListarConversas', { busca: 'Smoke', arquivada: 0, limite: 5, offset: 0 }))[0].TOTAL_MENSAGENS) === 1);

  await ex('chatRegistrarFerramenta', { conversaId: c.ID, mensagemId: m.ID, ferramenta: 'indicadores', argumentos: b64('{}'), resultado: b64('{"resumo":"ok"}'), sucesso: 1, duracaoMs: 12 });
  conf('registra a ferramenta', (await rows('chatListarFerramentas', { conversaId: c.ID })).length === 1);

  await ex('chatRenomearConversa', { id: c.ID, titulo: 'Outro nome Smoke' });
  await ex('chatArquivarConversa', { id: c.ID, arquivada: 1 });
  conf('arquivada sai da lista principal', !(await rows('chatListarConversas', { busca: 'Outro nome', arquivada: 0, limite: 5, offset: 0 })).length);
  conf('arquivada aparece nas arquivadas', (await rows('chatListarConversas', { busca: 'Outro nome', arquivada: 1, limite: 5, offset: 0 })).length === 1);

  // Isolamento: conversa de outro usuario gravada direto no banco.
  const eu = Number((await uma('chatUsuarioAtual')).ID);
  const kOutro = chave();
  await dml(`INSERT INTO CHAT_CONVERSA (CHAVE, USUARIO_ID, TITULO, ARQUIVADA) VALUES ('${kOutro}', ${eu === 1 ? 2 : 1 + eu}, 'De outro', FALSE)`);
  alheia = Number((await consulta(`SELECT ID FROM CHAT_CONVERSA WHERE CHAVE = '${kOutro}'`))[0].ID);
  conf('conversa de outro nao abre pelo id', (await rows('chatObterConversa', { chave: '', id: alheia })).length === 0);
  conf('conversa de outro nao abre pela chave', (await rows('chatObterConversa', { chave: kOutro, id: 0 })).length === 0);
  await ex('chatSalvarMensagem', { chave: chave(), conversaId: alheia, autor: 'USUARIO', conteudo: b64('intruso'), sequencia: 1, status: 'OK' });
  conf('nao grava na conversa de outro', Number((await consulta(`SELECT COUNT(*) AS N FROM CHAT_MENSAGEM WHERE CONVERSA_ID = ${alheia}`))[0].N) === 0);
  conf('nao renomeia a conversa de outro', Number((await ex('chatRenomearConversa', { id: alheia, titulo: 'x' })).affectedRows) === 0);
  conf('nao exclui a conversa de outro', Number((await ex('chatExcluirConversa', { id: alheia })).affectedRows) === 0);
  conf('nao lista mensagens de outro', (await rows('chatListarMensagens', { conversaId: alheia, limite: 5, offset: 0 })).length === 0);
} finally {
  await ex('chatExcluirAnexos', { id: c.ID });
  await ex('chatExcluirFerramentasConversa', { id: c.ID });
  await ex('chatExcluirMensagensConversa', { id: c.ID });
  await ex('chatExcluirConversa', { id: c.ID });
  if (alheia) await dml(`DELETE FROM CHAT_CONVERSA WHERE ID = ${alheia}`);
}
conf('excluir na ordem certa remove tudo', (await rows('chatObterConversa', { chave: k, id: 0 })).length === 0);
encerrar('Chat');
