// Apoio comum a todos os scripts de backend. Tudo aqui e idempotente: reexecutar
// um script nao apaga dado nem duplica SF.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sdk from 'mitra-sdk';

export { sdk };

sdk.configureSdkMitra({
  baseURL: process.env.MITRA_BASE_URL,
  token: process.env.MITRA_TOKEN,
  integrationURL: process.env.MITRA_BASE_URL_INTEGRATIONS,
});

export const projectId = parseInt(process.env.MITRA_PROJECT_ID);
const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const DIR_BACKEND = path.resolve(AQUI, '..');

// O SDK lanca objeto simples: serializar antes de casar o texto do erro.
export const textoErro = (e) => (e?.message && typeof e.message === 'string' ? e.message : JSON.stringify(e));

export async function ddl(sql) {
  try {
    await sdk.runDdlMitra({ projectId, sql });
    return true;
  } catch (e) {
    if (/already exists|Duplicate (key|column)/i.test(JSON.stringify(e))) return false;
    throw e;
  }
}

export async function consulta(sql) {
  const r = await sdk.runQueryMitra({ projectId, sql });
  return r.result?.rows ?? [];
}

export const dml = (sql) => sdk.runDmlMitra({ projectId, sql });

export async function colunaExiste(tabela, coluna) {
  const r = await consulta(
    `SELECT 1 AS X FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${tabela}' AND COLUMN_NAME = '${coluna}'`,
  );
  return r.length > 0;
}

export async function garantirColuna(tabela, coluna, definicao) {
  if (await colunaExiste(tabela, coluna)) return false;
  await ddl(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`);
  return true;
}

// Indice unico: confere duplicata antes, para reportar em vez de estourar com erro criptico.
export async function garantirIndiceUnico(tabela, nome, colunas) {
  const existe = await consulta(
    `SELECT 1 AS X FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${tabela}' AND INDEX_NAME = '${nome}'`,
  );
  if (existe.length) return false;
  const dup = await consulta(
    `SELECT ${colunas}, COUNT(*) AS N FROM ${tabela} GROUP BY ${colunas} HAVING COUNT(*) > 1 LIMIT 5`,
  );
  if (dup.length) {
    console.warn(`[AVISO] ${tabela}: duplicatas impedem o indice ${nome}: ${JSON.stringify(dup)}`);
    return false;
  }
  await ddl(`CREATE UNIQUE INDEX ${nome} ON ${tabela} (${colunas})`);
  return true;
}

let mapaSF = null;
export async function carregarSFs(forcar = false) {
  if (mapaSF && !forcar) return mapaSF;
  const r = await sdk.listServerFunctionsMitra({ projectId });
  mapaSF = new Map((r.result ?? []).map((s) => [s.name, s.id]));
  return mapaSF;
}

export async function idSF(nome) {
  const m = await carregarSFs();
  const id = m.get(nome);
  if (!id) throw new Error(`SF "${nome}" nao existe. Rode antes o script que a cria.`);
  return id;
}

// Cria ou atualiza pelo nome: preserva o id entre reexecucoes.
export async function sf(nome, type, code, description, extra = {}) {
  const m = await carregarSFs();
  const existente = m.get(nome);
  const codigo = typeof code === 'string' ? code : JSON.stringify(code);
  if (existente) {
    await sdk.updateServerFunctionMitra({ projectId, serverFunctionId: existente, code: codigo, description, ...extra });
    return existente;
  }
  const c = await sdk.createServerFunctionMitra({ projectId, name: nome, type, code: codigo, description, ...extra });
  const id = c.result?.serverFunctionId;
  m.set(nome, id);
  return id;
}

export const sfSQL = (nome, code, description) => sf(nome, 'SQL', code, description);

const NONCE = `'{{_nonce}}' = '{{_nonce}}'`;
export { NONCE };

// Papel de administrador = perfil da plataforma. Enquanto o perfil estiver vazio,
// todos entram (estado inicial que se fecha sozinho, secao 13.2 do documento).
export const PERFIS = [
  { nome: 'Administrador', cor: '#15803d' },
  { nome: 'Operador Financeiro', cor: '#1e40af' },
  { nome: 'Aprovador', cor: '#b45309' },
];

export async function garantirPerfis() {
  let lista = (await sdk.listProfilesMitra({ projectId })).result ?? [];
  for (const p of PERFIS) {
    if (!lista.some((x) => x.name === p.nome)) {
      await sdk.createProfileMitra({ projectId, name: p.nome, color: p.cor });
    }
  }
  // createProfileMitra nao e confiavel para devolver o id: relemos a lista.
  lista = (await sdk.listProfilesMitra({ projectId })).result ?? [];
  const ids = {};
  for (const p of PERFIS) ids[p.nome] = lista.find((x) => x.name === p.nome)?.id;
  return ids;
}

export async function sqlAdmin() {
  const { Administrador: id } = await garantirPerfis();
  if (!id) throw new Error('Perfil Administrador nao encontrado.');
  return `(NOT EXISTS (SELECT 1 FROM INT_PROFILEUSER WHERE PROFILEID = ${id}) OR EXISTS (SELECT 1 FROM INT_PROFILEUSER WHERE USERID = :VAR_USER AND PROFILEID = ${id}))`;
}

// Quem nao pode ver todos os tipos so enxerga os tipos liberados (secao 13.1).
export const VISIVEL = (alias = 'D') => `(
  NOT EXISTS (SELECT 1 FROM PERMISSOES_USUARIO PU WHERE PU.USUARIO_ID = :VAR_USER AND PU.TODOS_OS_TIPOS = FALSE)
  OR ${alias}.TIPO_DOCUMENTO_ID IN (SELECT PT.TIPO_DOCUMENTO_ID FROM PERMISSAO_TIPO_DOCUMENTO PT WHERE PT.USUARIO_ID = :VAR_USER)
)`;

// Lote em uma SF SQL so: JSON em base64 + CTE recursiva. JSON_TABLE com parametro
// e bloqueado pela protecao de parametros; esta forma passa e nao repete o JSON.
export const LOTE_CTE = `WITH RECURSIVE j(d) AS (SELECT CONVERT(FROM_BASE64('{{linhas}}') USING utf8mb4)), n(i) AS (SELECT 0 UNION ALL SELECT n.i + 1 FROM n, j WHERE n.i + 1 < JSON_LENGTH(j.d))`;
export const jx = (campo) => `NULLIF(JSON_UNQUOTE(JSON_EXTRACT(j.d, CONCAT('$[', n.i, '].${campo}'))), '')`;

// SF JavaScript fica em arquivo e e lida do disco: num template literal, cada \s de
// regex viraria "s" e as validacoes passariam a aceitar qualquer coisa.
export function lerSF(...arquivos) {
  return arquivos.map((a) => fs.readFileSync(path.join(DIR_BACKEND, a), 'utf8')).join('\n\n');
}

// Monta o codigo final: troca __SF_MAP__ pelos ids das SFs citadas como SF.nome.
export async function montarJS(...arquivos) {
  const fonte = lerSF(...arquivos);
  const nomes = [...new Set([...fonte.matchAll(/\bSF\.([A-Za-z_][A-Za-z0-9_]*)/g)].map((x) => x[1]))];
  const mapa = {};
  for (const n of nomes) mapa[n] = await idSF(n);
  return fonte.replace('__SF_MAP__', JSON.stringify(mapa));
}

export const sfJS = async (nome, arquivos, description) => sf(nome, 'JAVASCRIPT', await montarJS(...arquivos), description);

export function fim(msg) {
  console.log(msg);
}
