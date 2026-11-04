import { uploadFilePrivateMitra } from 'mitra-interactions-sdk';
import { callSF, execSF, novaChave, paraB64, PROJECT_ID, SF, umaLinha } from './api';
import { hashArquivo } from './hash';
import { lerArquivo } from './ocr';
import type { LeituraDocumento } from './ocr';
import { getMitraErrorMessage } from './utils';

export interface AnexoPipeline {
  chave: string;
  nome: string;
  etapa: string;
  progresso?: number;
  status: 'LENDO' | 'LIDO' | 'SEM_LEITURA' | 'DUPLICADO' | 'ERRO';
  id?: number;
  lancamentoId?: number;
  campos?: LeituraDocumento['campos'];
  erro?: string;
}

// Duplicidade -> upload -> leitura. Duplicado para no primeiro passo: nao gasta OCR nem armazenamento.
// Falha de leitura nao derruba o anexo: ele entra como SEM_LEITURA e a IA pede os dados na conversa.
export async function processarAnexo(arquivo: File, conversaId: number, aoMudar: (a: AnexoPipeline) => void): Promise<AnexoPipeline> {
  const chave = novaChave();
  let a: AnexoPipeline = { chave, nome: arquivo.name, etapa: 'Conferindo se já entrou', status: 'LENDO' };
  const mudar = (p: Partial<AnexoPipeline>) => { a = { ...a, ...p }; aoMudar(a); };
  mudar({});
  try {
    const hash = await hashArquivo(arquivo);
    const dup = await callSF(SF.verificarDuplicidadeDocumento, { hash });
    const salvar = async (status: string, key: string, texto: string, campos: unknown, lancamentoId: number) => {
      await execSF(SF.chatSalvarAnexo, { chave, conversaId, nome: arquivo.name.slice(0, 255), tipoArquivo: arquivo.type.slice(0, 120), tamanho: arquivo.size, arquivoKey: key, hash, texto: paraB64(texto), campos: paraB64(JSON.stringify(campos)), status, lancamentoId });
      const r = await umaLinha(SF.chatObterAnexoPorChave, { chave });
      return Number(r?.ID ?? 0);
    };
    if (dup.length) {
      const lancamentoId = Number(dup[0].LANCAMENTO_ID) || 0;
      const id = await salvar('DUPLICADO', '', '', {}, lancamentoId);
      mudar({ status: 'DUPLICADO', etapa: 'Já lançado', id, lancamentoId });
      return a;
    }
    mudar({ etapa: 'Guardando o arquivo' });
    const up = await uploadFilePrivateMitra({ projectId: PROJECT_ID, file: arquivo });
    const key = up?.result?.key ?? '';
    let leitura: LeituraDocumento = { texto: '', origem: 'SEM_LEITURA', campos: {}, itens: [] };
    try {
      leitura = await lerArquivo(arquivo, (etapa, progresso) => mudar({ etapa, progresso }));
    } catch { /* segue como SEM_LEITURA */ }
    const semLeitura = leitura.origem === 'SEM_LEITURA' || Object.keys(leitura.campos).length === 0;
    const id = await salvar(semLeitura ? 'SEM_LEITURA' : 'LIDO', key, leitura.texto, { ...leitura.campos, _itens: leitura.itens }, 0);
    mudar({ status: semLeitura ? 'SEM_LEITURA' : 'LIDO', etapa: semLeitura ? 'Sem leitura' : 'Lido', progresso: undefined, id, campos: leitura.campos });
    return a;
  } catch (e) {
    mudar({ status: 'ERRO', etapa: 'Falhou', erro: getMitraErrorMessage(e) });
    return a;
  }
}

// O que a IA recebe e o resultado da leitura, campo a campo, com a confianca de cada um.
export function descreverAnexo(a: AnexoPipeline): string {
  if (a.status === 'DUPLICADO') return `[Anexo ${a.id} "${a.nome}": DUPLICADO, já entrou${a.lancamentoId ? ` no lançamento ${a.lancamentoId}` : ''}. Não crie outro.]`;
  if (a.status === 'SEM_LEITURA' || !a.campos) return `[Anexo ${a.id} "${a.nome}": não consegui ler. Peça os dados ao usuário.]`;
  const campos = Object.entries(a.campos).map(([k, v]) => `  ${k}: ${v.valor}${v.confianca === 'CONFERIR' ? ' (CONFERIR: saiu de heurística, confirme antes de lançar)' : ''}`).join('\n');
  return `[Anexo ${a.id} "${a.nome}", lido no navegador:\n${campos}\n]`;
}
