import { execSF, SF } from './api';

export interface CidadeErp {
  CODCID: number;
  NOMECID: string;
}

// Apoio ao cadastro de parceiro: o ERP exige a cidade pelo codigo.
export async function buscarCidades(busca: string): Promise<CidadeErp[]> {
  if (busca.trim().length < 2) return [];
  const r = await execSF<{ itens?: CidadeErp[] }>(SF.sankhyaCidades, { busca });
  return r?.itens ?? [];
}
