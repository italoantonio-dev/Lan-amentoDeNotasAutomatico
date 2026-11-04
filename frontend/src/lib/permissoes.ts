import { useCallback, useEffect, useState } from 'react';
import { SF, umaLinha } from './api';

interface Permissoes {
  carregando: boolean;
  erro: string;
  usuarioId: number;
  email: string;
  isDev: boolean;
  administrador: boolean;
  totalAdmins: number;
  perfilAdminId: number;
  recarregar: () => void;
}

// Decide no servidor: esconder botao e cortesia. Enquanto carrega, a guarda nao mostra nem a
// tela nem a recusa, para nao jogar o administrador para fora no primeiro instante.
export function usePermissoes(): Permissoes {
  const [estado, setEstado] = useState({ carregando: true, erro: '', usuarioId: 0, email: '', isDev: false, administrador: false, totalAdmins: 0, perfilAdminId: 0 });
  const [versao, setVersao] = useState(0);
  const recarregar = useCallback(() => setVersao((v) => v + 1), []);

  useEffect(() => {
    let vivo = true;
    umaLinha(SF.permissoesUsuarioAtual)
      .then((r) => {
        if (!vivo) return;
        setEstado({
          carregando: false,
          erro: '',
          usuarioId: Number(r?.ID ?? 0),
          email: String(r?.EMAIL ?? ''),
          isDev: Boolean(Number(r?.ISDEV ?? 0)),
          administrador: Number(r?.ADMINISTRADOR ?? 0) === 1,
          totalAdmins: Number(r?.TOTAL_ADMINS ?? 0),
          perfilAdminId: Number(r?.PERFIL_ADMIN_ID ?? 0),
        });
      })
      .catch((e) => vivo && setEstado((s) => ({ ...s, carregando: false, erro: e instanceof Error ? e.message : 'Não consegui ler as permissões.' })));
    return () => { vivo = false; };
  }, [versao]);

  return { ...estado, recarregar };
}
