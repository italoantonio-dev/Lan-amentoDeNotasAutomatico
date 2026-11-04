import { executeServerFunctionMitra } from 'mitra-interactions-sdk';
import { getMitraErrorMessage } from './utils';
import { SF } from './sfIds';

export { SF };
export const PROJECT_ID = Number(import.meta.env.VITE_MITRA_PROJECT_ID);

let contador = 0;

// Filtro opcional que nao vier precisa chegar como '': sem isso o placeholder iria literal na query.
const FILTROS_OPCIONAIS: Record<number, string[]> = {
  [SF.listarLancamentos]: ['empresaId', 'tipoId', 'status', 'busca'],
  [SF.contarLancamentos]: ['empresaId', 'tipoId', 'status'],
  [SF.kpisDashboard]: ['empresaId', 'status'],
  [SF.resumoPorStatus]: ['empresaId'],
  [SF.resumoPorEmpresa]: ['status'],
  [SF.lancamentosRecentes]: ['empresaId', 'status'],
  [SF.roboListarAnexos]: ['decisao'],
  [SF.chatListarConversas]: ['busca'],
  [SF.listarEmpresas]: ['busca'],
  [SF.listarTops]: ['busca'],
  [SF.listarNaturezas]: ['busca'],
  [SF.listarCentros]: ['busca'],
  [SF.listarContas]: ['busca'],
  [SF.listarTiposTitulo]: ['busca'],
};

function normalizar(res: unknown): unknown {
  let saida = (res as { result?: { output?: unknown } })?.result?.output;
  if (typeof saida === 'string') {
    try { saida = JSON.parse(saida); } catch { /* fica como texto */ }
  }
  return saida;
}

// Toda chamada passa por aqui: injeta o nonce (a plataforma cacheia pela assinatura), preenche os
// filtros opcionais e transforma FAILED em excecao legivel.
export async function execSF<T = Record<string, any>>(sfId: number, input: Record<string, unknown> = {}): Promise<T> {
  const entrada: Record<string, unknown> = { ...input, _nonce: `${Date.now()}-${++contador}` };
  for (const f of FILTROS_OPCIONAIS[sfId] ?? []) {
    if (entrada[f] === undefined || entrada[f] === null) entrada[f] = '';
  }
  const res = await executeServerFunctionMitra({ projectId: PROJECT_ID, serverFunctionId: sfId, input: entrada });
  const r = (res as { result?: { executionStatus?: string; error?: unknown } })?.result;
  if (r?.executionStatus === 'FAILED') throw new Error(getMitraErrorMessage(r.error));
  return normalizar(res) as T;
}

export async function callSF<T = Record<string, any>>(sfId: number, input: Record<string, unknown> = {}): Promise<T[]> {
  const saida = await execSF<{ rows?: T[] }>(sfId, input);
  return saida?.rows ?? [];
}

export async function umaLinha<T = Record<string, any>>(sfId: number, input: Record<string, unknown> = {}): Promise<T | null> {
  return (await callSF<T>(sfId, input))[0] ?? null;
}

// UPDATE/INSERT recusado pela conferencia no SQL nao da erro: afeta zero linhas.
export async function exigirAfetou(sfId: number, input: Record<string, unknown>, mensagem: string): Promise<void> {
  const saida = await execSF<{ affectedRows?: number }>(sfId, input);
  if (!Number(saida?.affectedRows ?? 0)) throw new Error(mensagem);
}

export function paraB64(texto: string): string {
  const bytes = new TextEncoder().encode(texto);
  let bin = '';
  const passo = 0x8000;
  for (let i = 0; i < bytes.length; i += passo) bin += String.fromCharCode(...bytes.subarray(i, i + passo));
  return btoa(bin);
}

export function novaChave(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}
