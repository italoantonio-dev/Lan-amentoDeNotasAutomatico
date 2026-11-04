// Apoio dos smokes: cada um monta o proprio cenario e limpa o que criou, mesmo se algo falhar.
import { sdk, projectId, carregarSFs, consulta, dml, garantirPerfis } from './base.mjs';
import crypto from 'node:crypto';

export { sdk, projectId, consulta, dml, garantirPerfis };
let n = 0;
let falhas = 0;
export const hash = () => crypto.randomBytes(32).toString('hex');
export const chave = () => crypto.randomUUID();
export const b64 = (t) => Buffer.from(String(t), 'utf8').toString('base64');

// So nos smokes: esperar a janela do limite por minuto, para o teste nao falhar por volume.
// O sistema nunca faz isso: retentativa automatica mantem o limite degradado.
async function esperarJanela(e) {
  if (!/RATE_LIMIT/.test(JSON.stringify(e))) throw e;
  console.log('INFO limite por minuto atingido pelos testes: aguardando a janela.');
  await new Promise((ok) => setTimeout(ok, 65000));
}

export async function ex(nome, input = {}) {
  const mapa = await carregarSFs();
  const id = mapa.get(nome);
  if (!id) throw new Error(`SF ${nome} nao existe`);
  let r;
  try {
    r = await sdk.executeServerFunctionMitra({ projectId, serverFunctionId: id, input: { ...input, _nonce: `${Date.now()}-${++n}` } });
  } catch (e) {
    await esperarJanela(e);
    r = await sdk.executeServerFunctionMitra({ projectId, serverFunctionId: id, input: { ...input, _nonce: `${Date.now()}-${++n}` } });
  }
  if (r.result.executionStatus === 'FAILED' && /RATE_LIMIT/.test(JSON.stringify(r.result.error))) {
    await esperarJanela({ message: { name: 'RATE_LIMIT_EXCEEDED' } });
    r = await sdk.executeServerFunctionMitra({ projectId, serverFunctionId: id, input: { ...input, _nonce: `${Date.now()}-${++n}` } });
  }
  if (r.result.executionStatus === 'FAILED') throw new Error(`${nome}: ${typeof r.result.error === 'string' ? r.result.error : JSON.stringify(r.result.error)}`);
  let out = r.result.output;
  if (typeof out === 'string') { try { out = JSON.parse(out); } catch { /* texto */ } }
  return out;
}
export const rows = async (nome, input) => (await ex(nome, input))?.rows ?? [];
export const uma = async (nome, input) => (await rows(nome, input))[0] ?? null;

export function conf(nome, ok, extra = '') {
  console.log(`${ok ? 'OK   ' : 'FALHA'} ${nome}${extra ? ` (${extra})` : ''}`);
  if (!ok) falhas++;
}
export const totalFalhas = () => falhas;
export function encerrar(titulo) {
  console.log(falhas ? `\n${titulo}: ${falhas} falha(s).` : `\n${titulo}: tudo certo.`);
  process.exit(falhas ? 1 : 0);
}

// CNPJ sintetico que nao existe em base nenhuma: nunca casa com parceiro real.
export function cnpjFicticio() {
  const base = [...crypto.randomBytes(8)].map((x) => x % 10);
  base[0] = 0; base.push(9, 9, 9, 9);
  const dv = (arr, pesos) => { const s = arr.reduce((acc, v, i) => acc + v * pesos[i], 0) % 11; return s < 2 ? 0 : 11 - s; };
  const d1 = dv(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = dv([...base, d1], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return [...base, d1, d2].join('');
}

export async function primeiraEmpresa() {
  const e = await consulta('SELECT ID, CODEMP, NOME, CNPJ FROM EMPRESAS WHERE ATIVO = TRUE ORDER BY ID LIMIT 1');
  if (!e.length) throw new Error('Sem empresa cadastrada: rode a sincronizacao antes.');
  return e[0];
}
export async function tipo(codigo) {
  return (await consulta(`SELECT ID, CODIGO, TIPMOV_ESPERADO, DESTINO_PADRAO FROM TIPOS_DOCUMENTO WHERE CODIGO = '${codigo}'`))[0];
}

// Copia de uma SF com outro perfil de administrador: prova a recusa a quem nao e administrador
// sem mexer no perfil real, porque a plataforma nao oferece retirar usuario de perfil.
export async function comPerfilTemporario(fn) {
  const nomePerfil = `ZZ Smoke ${Date.now()}`;
  await sdk.createProfileMitra({ projectId, name: nomePerfil });
  const lista = (await sdk.listProfilesMitra({ projectId })).result;
  const temp = lista.find((p) => p.name === nomePerfil);
  const usuarios = await consulta('SELECT ID FROM INT_USER WHERE ID > 0');
  const eu = (await consulta('SELECT 1 AS X FROM DUAL')) && (await ex('chatUsuarioAtual')).rows[0].ID;
  const outro = usuarios.find((u) => Number(u.ID) !== Number(eu));
  const criadas = [];
  const { Administrador: adminReal } = await garantirPerfis();
  try {
    if (!outro) throw new Error('Precisa de um segundo usuario no projeto para este teste.');
    await sdk.setProfileUsersMitra({ projectId, profileId: temp.id, userIds: [outro.ID] });
    const copiar = async (nome) => {
      const mapa = await carregarSFs();
      const orig = await sdk.readServerFunctionMitra({ projectId, serverFunctionId: mapa.get(nome) });
      const code = String(orig.result.code).replaceAll(`PROFILEID = ${adminReal}`, `PROFILEID = ${temp.id}`);
      const c = await sdk.createServerFunctionMitra({ projectId, name: `zz_${nome}_${Date.now()}`, type: 'SQL', code, description: 'copia temporaria de smoke' });
      criadas.push(c.result.serverFunctionId);
      return async (input) => {
        const r = await sdk.executeServerFunctionMitra({ projectId, serverFunctionId: c.result.serverFunctionId, input: { ...input, _nonce: `${Date.now()}-${++n}` } });
        return r.result.output;
      };
    };
    await fn(copiar);
  } finally {
    for (const id of criadas) await sdk.deleteServerFunctionMitra({ projectId, serverFunctionId: id }).catch(() => {});
    await sdk.deleteProfileMitra({ projectId, profileId: temp.id }).catch(() => {});
  }
}

export async function criarLancamentoTeste(extra = {}) {
  const e = await primeiraEmpresa();
  const t = await tipo(extra.tipoCodigo ?? 'BOLETO');
  const h = hash();
  const r = await ex('criarLancamentoViaChat', {
    empresaId: e.ID, tipoId: t.ID, hash: h, arquivoNome: 'smoke.pdf', cnpj: extra.cnpj ?? cnpjFicticio(), nome: extra.nome ?? 'Fornecedor Smoke', numeroDoc: extra.numeroDoc ?? String(Date.now()).slice(-8), serie: '1',
    dataEmissao: '2026-01-10', dataVencimento: '2026-02-10', valorTotal: extra.valor ?? 123.45, itens: extra.itens ?? [], origem: 'TELA',
  });
  if (!r.ok) throw new Error(`criarLancamentoViaChat: ${r.erro}`);
  return { ...r, empresa: e, tipo: t, hash: h };
}
export const limparLancamento = (id) => ex('excluirLancamento', { id }).catch(() => null);
