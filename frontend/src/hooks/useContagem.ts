import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { SF, umaLinha } from '../lib/api';

// Pendencias de aprovacao para o menu: relido ao navegar, sem polling.
export function useContagem(): number {
  const { pathname } = useLocation();
  const [total, setTotal] = useState(0);
  useEffect(() => {
    let vivo = true;
    umaLinha(SF.contarPendentesAprovacao).then((r) => vivo && setTotal(Number(r?.TOTAL ?? 0))).catch(() => { /* o menu segue sem o numero */ });
    return () => { vivo = false; };
  }, [pathname]);
  return total;
}
