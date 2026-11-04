// Aprovador do ERP nao e usuario do sistema: o vinculo sai do e-mail, no servidor.
export function situacaoVinculo(a: { EMAIL?: string | null; USUARIO_MITRA_ID?: number | null; LOGIN?: string | null }): { vinculado: boolean; texto: string } {
  if (a.USUARIO_MITRA_ID) return { vinculado: true, texto: `Aprova como ${a.LOGIN ?? 'usuário vinculado'}` };
  if (a.EMAIL) return { vinculado: false, texto: `Nenhum login com o e-mail ${a.EMAIL}` };
  return { vinculado: false, texto: 'Sem e-mail: ninguém aprova em nome dele' };
}
