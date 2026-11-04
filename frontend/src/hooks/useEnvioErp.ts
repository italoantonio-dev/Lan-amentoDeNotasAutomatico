import { useCallback, useState } from 'react';
import { execSF, SF } from '../lib/api';
import { getMitraErrorMessage } from '../lib/utils';

interface Candidato { codparc: number; nome: string; fornecedor: boolean }
interface RespostaEnvio { ok: boolean; motivo?: string; mensagem?: string; chave?: string; jaEnviado?: boolean; escolhaParceiro?: boolean; candidatos?: Candidato[]; semParceiro?: boolean }

export function useEnvioErp(lancamentoId: number, aoMudar: () => void) {
  const [enviando, setEnviando] = useState(false);
  const [recusa, setRecusa] = useState<{ motivo: string; mensagem: string; semParceiro?: boolean } | null>(null);
  const [candidatos, setCandidatos] = useState<Candidato[] | null>(null);

  const enviar = useCallback(async (codparc?: number) => {
    setEnviando(true);
    setRecusa(null);
    try {
      const r = await execSF<RespostaEnvio>(SF.enviarLancamentoParaErp, { lancamentoId, ...(codparc ? { codparc } : {}) });
      if (r.escolhaParceiro) {
        setCandidatos(r.candidatos ?? []);
      } else {
        setCandidatos(null);
        if (!r.ok) setRecusa({ motivo: r.motivo ?? '', mensagem: r.mensagem ?? 'O envio não foi concluído.', semParceiro: r.semParceiro });
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

  return { enviando, recusa, candidatos, enviar, limparCandidatos: () => setCandidatos(null) };
}
