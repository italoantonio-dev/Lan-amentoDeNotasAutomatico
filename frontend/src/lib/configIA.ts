import { manageAgentCredentialMitra } from 'mitra-interactions-sdk';
import { callSF, execSF, SF } from './api';

export interface ConfigIA {
  connectionId: string;
  modelo: string;
}

// A connection e o modelo ficam em tabela. Vazio = cada usuario usa a propria credencial.
export async function lerConfigIA(): Promise<ConfigIA> {
  try {
    const linhas = await callSF(SF.configIaLer);
    const achar = (c: string) => String(linhas.find((l) => l.CHAVE === c)?.VALOR ?? '');
    return { connectionId: achar('IA_CONNECTION_ID'), modelo: achar('IA_MODELO') };
  } catch {
    return { connectionId: '', modelo: '' };
  }
}

export async function salvarConfigIA(cfg: ConfigIA): Promise<void> {
  for (const [chave, valor] of [['IA_CONNECTION_ID', cfg.connectionId.trim()], ['IA_MODELO', cfg.modelo.trim()]]) {
    const r = await execSF<{ affectedRows?: number }>(SF.configIaSalvar, { chave, valor });
    if (!Number(r?.affectedRows ?? 0) && valor) throw new Error('Sem permissão: só o administrador altera a connection de IA.');
  }
}

export interface OpcaoModelo {
  value: string;
  label: string;
}

// Passar o connectionId na leitura nao e detalhe: sem ele a lista vem vazia para quem nunca conectou chave.
export async function listarModelos(connectionId: string): Promise<OpcaoModelo[]> {
  try {
    const r = await manageAgentCredentialMitra<{ providers?: { name: string; models?: { modelId: string; name: string }[] }[] }>({
      action: 'list_models',
      ...(connectionId ? { connectionId } : {}),
    } as never);
    return (r?.providers ?? []).flatMap((p) => (p.models ?? []).map((m) => ({ value: m.modelId, label: `${p.name} · ${m.name}` })));
  } catch {
    return [];
  }
}

// O WebSocket do agente e injetado pelo build-proxy: fora de aplicacao publicada, a SDK lanca erro.
export function agenteDisponivel(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean((window as unknown as { __mitraEnv?: { agentWsUrl?: string } }).__mitraEnv?.agentWsUrl);
}
