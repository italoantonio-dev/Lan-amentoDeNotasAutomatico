import { useCallback, useState } from 'react';
import { execSF, SF } from '../lib/api';
import { getMitraErrorMessage } from '../lib/utils';

// So controla o que a tela oferece. Quem libera ou bloqueia de verdade e o backend (sf/_erp.js).
export const GRAVACAO_ERP_LIBERADA = true as boolean;
export const CORRECAO_CADASTRO_LIBERADA = false as boolean;

interface Candidato { codparc: number; nome: string; fornecedor: boolean }
interface Conferencia { destino?: string; entidade?: string; campos?: Record<string, unknown>; parceiro?: { codparc: number; origem: string; nome?: string }; correspondencia?: { resumo: string } & Record<string, unknown>; origemDocumento?: string }
interface RespostaEnvio extends Conferencia { ok: boolean; simulado?: boolean; motivo?: string; mensagem?: string; chave?: string; jaEnviado?: boolean; escolhaParceiro?: boolean; candidatos?: Candidato[]; semParceiro?: boolean }

export function useEnvioErp(lancamentoId: number, aoMudar: () => void) {
  const [enviando, setEnviando] = useState(false);
  const [recusa, setRecusa] = useState<{ motivo: string; mensagem: string; semParceiro?: boolean } | null>(null);
  const [candidatos, setCandidatos] = useState<Candidato[] | null>(null);
  const [conferencia, setConferencia] = useState<Conferencia | null>(null);

  const executar = useCallback(async (simular: boolean, codparc?: number) => {
    setEnviando(true);
    setRecusa(null);
    setConferencia(null);
    try {
      const r = await execSF<RespostaEnvio>(SF.enviarLancamentoParaErp, { lancamentoId, ...(simular ? { simular: 'S' } : {}), ...(codparc ? { codparc } : {}) });
      if (r.escolhaParceiro) {
        setCandidatos(r.candidatos ?? []);
      } else {
        setCandidatos(null);
        if (!r.ok) setRecusa({ motivo: r.motivo ?? '', mensagem: r.mensagem ?? 'O envio não foi concluído.', semParceiro: r.semParceiro });
        else if (r.simulado) setConferencia(r);
      }
      return r;
    } catch (e) {
      const mensagem = getMitraErrorMessage(e);
      setRecusa({ motivo: 'FALHA', mensagem });
      return { ok: false, mensagem } as RespostaEnvio;
    } finally {
      setEnviando(false);
      aoMudar();
    }
  }, [lancamentoId, aoMudar]);

  const enviar = useCallback((codparc?: number) => executar(false, codparc), [executar]);
  const conferir = useCallback((codparc?: number) => executar(true, codparc), [executar]);

  return { enviando, recusa, candidatos, conferencia, enviar, conferir, limparCandidatos: () => setCandidatos(null) };
}
