// Vinculo de aprovadores com login. SOMENTE LEITURA: nao altera APROVADORES, usuarios nem perfis.
import { sdk, projectId, consulta } from '../lib/base.mjs';

const aprovadores = await consulta('SELECT ID, CODUSU, NOME, EMAIL, LIMITE_ALCADA, USUARIO_MITRA_ID, ATIVO FROM APROVADORES ORDER BY ID');
const logins = await consulta('SELECT ID, DESCR FROM INT_USER');
const r = await sdk.listProjectUsersMitra({ projectId });
const usuarios = r.result ?? [];
const achar = (lista, campo, email) => lista.find((u) => String(u[campo] ?? '').toLowerCase() === String(email ?? '').toLowerCase());
console.log(JSON.stringify({
  aprovadores: aprovadores.map((a) => ({
    codusu: a.CODUSU, nome: a.NOME, ativo: a.ATIVO, vinculo: a.USUARIO_MITRA_ID, teto: a.LIMITE_ALCADA,
    temLogin: Boolean(achar(logins, 'DESCR', a.EMAIL)), usuarioDoProjeto: achar(usuarios, 'email', a.EMAIL)?.userType ?? null,
  })),
  logins: logins.length,
  usuarios: usuarios.map((u) => ({ id: u.userId, email: u.email, tipo: u.userType, perfil: u.profile })),
}, null, 1));
