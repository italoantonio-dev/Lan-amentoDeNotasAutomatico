// Acesso ao Oracle do Sankhya EXCLUSIVAMENTE em leitura, com registro de cada analise.
// Nenhuma funcao deste modulo grava no ERP nem no sistema.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { sdk, projectId } from '../lib/base.mjs';

// Cache local da leitura: recompor os relatorios nao consulta o ERP de novo. Contem dado real do ERP,
// por isso fica fora do git (.gitignore). Apague a pasta para ler tudo de novo.
const CACHE = new URL('./.cache/', import.meta.url).pathname;
fs.mkdirSync(CACHE, { recursive: true });

const EP = '/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json';
const PROIBIDO = /\b(INSERT|UPDATE|DELETE|MERGE|CREATE|ALTER|DROP|TRUNCATE|RENAME|GRANT|REVOKE|EXEC|EXECUTE|BEGIN|DECLARE|CALL|COMMIT|ROLLBACK|SAVEPOINT|LOCK|DBMS_\w+|UTL_\w+)\b|\bFOR\s+UPDATE\b|;/i;

export function exigirLeitura(sql) {
  const limpo = sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/'(?:[^']|'')*'/g, "''").trim();
  if (!/^(SELECT|WITH)\b/i.test(limpo)) throw new Error('Bloqueado: so SELECT ou WITH.');
  const m = PROIBIDO.exec(limpo);
  if (m) throw new Error(`Bloqueado: termo de escrita ou comando multiplo (${m[0]}).`);
}

export const registro = [];
let seq = 0;

// meta: { objetivo, origem, periodo, filtros }
export async function ler(sql, meta) {
  exigirLeitura(sql);
  const id = `A${String(++seq).padStart(3, '0')}`;
  const arquivo = `${CACHE}${crypto.createHash('sha256').update(sql).digest('hex').slice(0, 24)}.json`;
  if (fs.existsSync(arquivo)) {
    const c = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
    registro.push({ id, ...meta, linhas: c.linhas.length, cortado: false, erro: '', tentativas: 0, lidoEm: c.lidoEm });
    const l = c.linhas;
    l.id = id;
    return l;
  }
  // O gateway do ERP devolve 403 em rajadas: espacar as leituras e repetir com espera crescente.
  // Repetir aqui e seguro porque toda consulta e somente leitura.
  let r;
  let tentativas = 0;
  for (;;) {
    await new Promise((ok) => setTimeout(ok, 2500));
    try {
      r = await sdk.callIntegrationMitra({ projectId, connection: 'sankhya', method: 'POST', endpoint: EP, body: { serviceName: 'DbExplorerSP.executeQuery', requestBody: { sql } } });
      break;
    } catch (e) {
      tentativas++;
      const e403 = /403/.test(JSON.stringify(e));
      if (e403 && tentativas <= 2) { await new Promise((ok) => setTimeout(ok, 5000 * tentativas)); continue; }
      const erro = e403 ? 'HTTP 403 no gateway depois de 2 tentativas' : JSON.stringify(e).slice(0, 200);
      registro.push({ id, ...meta, linhas: 0, cortado: false, erro, tentativas });
      throw new Error(`${id}: ${erro}`);
    }
  }
  const b = r.body;
  if (String(b?.status) !== '1' || !b.responseBody) {
    const erro = typeof b?.statusMessage === 'string' ? b.statusMessage : JSON.stringify(b?.statusMessage ?? b).slice(0, 300);
    registro.push({ id, ...meta, linhas: 0, cortado: false, erro });
    throw new Error(`${id}: o ERP recusou a consulta: ${erro}`);
  }
  const cols = b.responseBody.fieldsMetadata.map((f) => f.name);
  const linhas = b.responseBody.rows.map((l) => Object.fromEntries(cols.map((c, i) => [c, l[i]])));
  const cortado = Boolean(b.responseBody.burstLimit);
  const lidoEm = new Date().toISOString().slice(0, 19).replace('T', ' ');
  registro.push({ id, ...meta, linhas: linhas.length, cortado, erro: '', tentativas, lidoEm });
  if (cortado) throw new Error(`${id}: resultado cortado em 5.000 linhas; a analise precisa ser dividida.`);
  fs.writeFileSync(arquivo, JSON.stringify({ lidoEm, linhas }));
  linhas.id = id;
  return linhas;
}

// Valida tabelas e colunas no dicionario do Oracle antes de qualquer consulta de negocio.
// O gateway do ERP recusa resposta grande (HTTP 403): o dicionario e lido tabela a tabela.
export async function dicionario(tabelas) {
  const mapa = {};
  for (const t of tabelas) {
    const linhas = await ler(`SELECT COLUMN_NAME, DATA_TYPE FROM USER_TAB_COLUMNS WHERE TABLE_NAME = '${t}'`, {
      objetivo: `Validar tabela e colunas antes das consultas: ${t}`, origem: 'USER_TAB_COLUMNS (dicionario do Oracle)', periodo: '—', filtros: `TABLE_NAME = ${t}`,
    });
    if (linhas.length) mapa[t] = new Set(linhas.map((l) => l.COLUMN_NAME));
  }
  return mapa;
}

export function exigirColunas(dic, tabela, colunas) {
  const tem = dic[tabela];
  if (!tem) throw new Error(`Tabela ${tabela} nao existe ou nao esta visivel.`);
  const faltam = colunas.filter((c) => !tem.has(c));
  if (faltam.length) throw new Error(`${tabela} sem as colunas ${faltam.join(', ')}.`);
}
export const temColuna = (dic, tabela, coluna) => Boolean(dic[tabela]?.has(coluna));
