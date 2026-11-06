// Exporta o banco do projeto em SQL (MySQL): estrutura de todas as tabelas e dados
// das tabelas do módulo. Tabelas internas da plataforma (INT_*, DATABASECHANGELOG)
// saem só com a estrutura. Uso: node exportar-banco.mjs <pasta-destino>
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { configureSdkMitra, runQueryMitra } from 'mitra-sdk';

configureSdkMitra({ baseURL: process.env.MITRA_BASE_URL, token: process.env.MITRA_TOKEN, integrationURL: process.env.MITRA_BASE_URL_INTEGRATIONS });
const projectId = parseInt(process.env.MITRA_PROJECT_ID);
const destino = process.argv[2];
if (!destino) { console.error('informe a pasta de destino'); process.exit(1); }

const q = async (sql) => {
  const r = await runQueryMitra({ projectId, sql });
  return r.result?.rows ?? r.rows ?? [];
};
// a consulta devolve no máximo um lote de linhas: pagina as listas grandes
const qTudo = async (sql) => {
  const todas = [];
  for (let off = 0; ; off += 1000) {
    const rows = await q(`${sql} LIMIT 1000 OFFSET ${off}`);
    todas.push(...rows);
    if (rows.length < 1000) return todas;
  }
};
const g = (o, k) => o[k] ?? o[k.toLowerCase()] ?? o[k.toUpperCase()];
// valores secretos saem em branco: tokens, chaves de IA e referências às senhas do e-mail
const COLUNA_SECRETA = /TOKEN|SENHA|SEGREDO|SECRET|CHAVE_IA|PASSWORD/i;
const limpa = (tabela, r, c) => {
  if (COLUNA_SECRETA.test(c)) return null;
  if (tabela === 'ROBO_CONFIG' && c === 'VALOR' && COLUNA_SECRETA.test(String(r.CHAVE ?? ''))) return null;
  return r[c];
};
const soEstrutura = (t) => t.startsWith('INT_') || t === 'DATABASECHANGELOG';
const id = (s) => '`' + String(s).replace(/`/g, '``') + '`';
const val = (v) => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (typeof v === 'object') v = JSON.stringify(v);
  return "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "''").replace(/\n/g, '\\n').replace(/\r/g, '\\r') + "'";
};

const tabelas = (await q(`SELECT TABLE_NAME, TABLE_COMMENT FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`)).map((r) => ({ nome: g(r, 'TABLE_NAME'), coment: g(r, 'TABLE_COMMENT') }));
const colunas = await qTudo(`SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA, COLUMN_COMMENT
  FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME, ORDINAL_POSITION`);
const chaves = await qTudo(`SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, COLUMN_NAME FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`);
const fks = await qTudo(`SELECT TABLE_NAME, CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
  FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL
  ORDER BY TABLE_NAME, CONSTRAINT_NAME, ORDINAL_POSITION`);

const porTabela = (lista) => lista.reduce((m, r) => ((m[g(r, 'TABLE_NAME')] ??= []).push(r), m), {});
const colsT = porTabela(colunas), idxT = porTabela(chaves), fkT = porTabela(fks);

fs.mkdirSync(destino, { recursive: true });
let ddl = '-- Estrutura do banco\nSET FOREIGN_KEY_CHECKS = 0;\n\n';
let fkSql = '\n-- Chaves estrangeiras\n';
let dados = '-- Dados das tabelas do módulo\nSET FOREIGN_KEY_CHECKS = 0;\n\n';
const resumo = [];

for (const { nome, coment } of tabelas) {
  const cols = colsT[nome] || [];
  const linhas = cols.map((c) => {
    let s = `  ${id(g(c, 'COLUMN_NAME'))} ${g(c, 'COLUMN_TYPE')}`;
    if (g(c, 'IS_NULLABLE') === 'NO') s += ' NOT NULL';
    const d = g(c, 'COLUMN_DEFAULT');
    if (d !== null && d !== undefined) s += /^(CURRENT_TIMESTAMP|NULL)/i.test(d) || /^\(.*\)$/.test(d) ? ` DEFAULT ${d}` : ` DEFAULT ${val(d.replace(/^'(.*)'$/, '$1'))}`;
    const ex = (g(c, 'EXTRA') || '').replace(/DEFAULT_GENERATED/i, '').trim();
    if (ex) s += ' ' + ex;
    if (g(c, 'COLUMN_COMMENT')) s += ` COMMENT ${val(g(c, 'COLUMN_COMMENT'))}`;
    return s;
  });
  const idx = {};
  for (const k of idxT[nome] || []) (idx[g(k, 'INDEX_NAME')] ??= { unico: String(g(k, 'NON_UNIQUE')) === '0', cols: [] }).cols.push(id(g(k, 'COLUMN_NAME')));
  for (const [n, k] of Object.entries(idx)) linhas.push(n === 'PRIMARY' ? `  PRIMARY KEY (${k.cols.join(', ')})` : `  ${k.unico ? 'UNIQUE ' : ''}KEY ${id(n)} (${k.cols.join(', ')})`);
  ddl += `CREATE TABLE IF NOT EXISTS ${id(nome)} (\n${linhas.join(',\n')}\n)${coment ? ` COMMENT=${val(coment)}` : ''};\n\n`;
  const fk = {};
  for (const f of fkT[nome] || []) { const k = (fk[g(f, 'CONSTRAINT_NAME')] ??= { c: [], rt: g(f, 'REFERENCED_TABLE_NAME'), rc: [] }); k.c.push(id(g(f, 'COLUMN_NAME'))); k.rc.push(id(g(f, 'REFERENCED_COLUMN_NAME'))); }
  for (const [n, k] of Object.entries(fk)) fkSql += `ALTER TABLE ${id(nome)} ADD CONSTRAINT ${id(n)} FOREIGN KEY (${k.c.join(', ')}) REFERENCES ${id(k.rt)} (${k.rc.join(', ')});\n`;

  if (soEstrutura(nome)) continue;
  const nomes = cols.map((c) => g(c, 'COLUMN_NAME'));
  const pk = idx.PRIMARY ? idx.PRIMARY.cols.join(', ') : nomes.map(id).join(', ');
  let total = 0;
  for (let off = 0; ; off += 1000) {
    const rows = await q(`SELECT * FROM ${id(nome)} ORDER BY ${pk} LIMIT 1000 OFFSET ${off}`);
    if (!rows.length) break;
    for (let i = 0; i < rows.length; i += 200) {
      const bloco = rows.slice(i, i + 200).map((r) => '(' + nomes.map((c) => val(limpa(nome, r, c))).join(', ') + ')');
      dados += `INSERT INTO ${id(nome)} (${nomes.map(id).join(', ')}) VALUES\n${bloco.join(',\n')};\n`;
    }
    total += rows.length;
    if (rows.length < 1000) break;
  }
  if (total) { dados += '\n'; resumo.push(`| ${nome} | ${total} |`); }
}

ddl += fkSql + '\nSET FOREIGN_KEY_CHECKS = 1;\n';
dados += 'SET FOREIGN_KEY_CHECKS = 1;\n';
fs.writeFileSync(path.join(destino, '01-estrutura.sql'), ddl);
fs.writeFileSync(path.join(destino, '02-dados.sql'), dados);
fs.writeFileSync(path.join(destino, 'README.md'), `# Banco de dados

Exportado em ${new Date().toISOString().slice(0, 10)}. Fotografia do momento: não se atualiza sozinha.

- \`01-estrutura.sql\`: estrutura das ${tabelas.length} tabelas (MySQL).
- \`02-dados.sql\`: dados das tabelas do módulo. Tabelas internas da plataforma (\`INT_*\`, \`DATABASECHANGELOG\`) vão só com a estrutura: logins, logs de acesso e de execução ficam de fora.
- Tokens, chaves de IA e referências às senhas do e-mail saem em branco.\n- Credenciais das integrações (Sankhya, e-mail) e os arquivos PDF/XML não estão aqui.

Restaurar: \`mysql <banco> < 01-estrutura.sql && mysql <banco> < 02-dados.sql\`

| Tabela | Linhas |
|---|---|
${resumo.join('\n')}
`);
console.log(`tabelas ${tabelas.length}, com dados ${resumo.length}`);
console.log(resumo.join('\n'));
