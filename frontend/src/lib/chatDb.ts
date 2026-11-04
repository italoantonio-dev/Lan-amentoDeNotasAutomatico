import { callSF, execSF, novaChave, paraB64, SF, umaLinha } from './api';

type Linha = Record<string, any>;

// A tela e reconstruida do banco, nunca do historico do agente: ele morre com o sandbox.
export async function criarConversa(titulo: string, modelo: string): Promise<Linha> {
  const chave = novaChave();
  await execSF(SF.chatCriarConversa, { chave, titulo, modelo });
  // O INSERT nao devolve o id: e para isso que existe a chave gerada no cliente.
  const c = await umaLinha(SF.chatObterConversa, { chave, id: 0 });
  if (!c) throw new Error('Não consegui criar a conversa.');
  return c;
}

export async function salvarMensagem(conversaId: number, autor: string, conteudo: string, sequencia: number, status: string): Promise<number> {
  const chave = novaChave();
  await execSF(SF.chatSalvarMensagem, { chave, conversaId, autor, conteudo: paraB64(conteudo), sequencia, status });
  const m = await umaLinha(SF.chatObterMensagemPorChave, { chave });
  return Number(m?.ID ?? 0);
}

export const atualizarMensagem = (id: number, conteudo: string, status: string) => execSF(SF.chatAtualizarMensagem, { id, conteudo: paraB64(conteudo), status });

export async function excluirConversa(id: number): Promise<void> {
  // Anexo referencia mensagem: fora desta ordem, trava na chave estrangeira.
  await execSF(SF.chatExcluirAnexos, { id });
  await execSF(SF.chatExcluirFerramentasConversa, { id });
  await execSF(SF.chatExcluirMensagensConversa, { id });
  await execSF(SF.chatExcluirConversa, { id });
}

export const listarConversas = (busca: string, arquivada: boolean) => callSF(SF.chatListarConversas, { busca, arquivada: arquivada ? 1 : 0, limite: 100, offset: 0 });
export const listarMensagens = (conversaId: number) => callSF(SF.chatListarMensagens, { conversaId, limite: 500, offset: 0 });
export const listarFerramentas = (conversaId: number) => callSF(SF.chatListarFerramentas, { conversaId });
export const listarAnexos = (conversaId: number) => callSF(SF.chatListarAnexos, { conversaId });

export function resumoDaTranscricao(mensagens: { autor: string; conteudo: string }[]): string {
  const recentes = mensagens.slice(-30);
  return recentes.map((m) => `${m.autor === 'USUARIO' ? 'Usuário' : 'Assistente'}: ${m.conteudo.slice(0, 800)}`).join('\n');
}
