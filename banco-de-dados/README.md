# Banco de dados

Exportado em 2026-11-06. Fotografia do momento: não se atualiza sozinha.

- `01-estrutura.sql`: estrutura das 277 tabelas (MySQL).
- `02-dados.sql`: dados das tabelas do módulo. Tabelas internas da plataforma (`INT_*`, `DATABASECHANGELOG`) vão só com a estrutura: logins, logs de acesso e de execução ficam de fora.
- Tokens, chaves de IA e referências às senhas do e-mail saem em branco.
- Credenciais das integrações (Sankhya, e-mail) e os arquivos PDF/XML não estão aqui.

Restaurar: `mysql <banco> < 01-estrutura.sql && mysql <banco> < 02-dados.sql`

| Tabela | Linhas |
|---|---|
| APROVACOES | 1 |
| APROVADORES | 2 |
| APROVADOR_ESCOPO | 78 |
| CENTROS_RESULTADO | 130 |
| CHAT_CONVERSA | 1 |
| CHAT_MENSAGEM | 1 |
| CONTAS_BANCARIAS | 83 |
| DIM_1 | 22280 |
| DIM_2 | 732 |
| DIM_3 | 244 |
| DIM_4 | 61 |
| DIM_5 | 3194 |
| DIM_51 | 3 |
| DIM_52 | 2 |
| DIM_6 | 7 |
| DOCUMENTOS | 1 |
| EMPRESAS | 27 |
| JAVA_DATE_FORMAT | 21 |
| LANCAMENTOS | 1 |
| LOG_EXECUCAO | 7 |
| NATUREZAS | 264 |
| PLAYGROUND | 1 |
| ROBO_ANEXO | 1 |
| ROBO_CONFIG | 11 |
| ROBO_EMAIL | 1 |
| ROBO_EXECUCAO | 3 |
| SINCRONIZACAO_ERP | 24 |
| STATUS_LANCAMENTO | 6 |
| TIPOS_DOCUMENTO | 4 |
| TIPOS_TITULO | 46 |
| TOPS | 330 |
| USUARIO_SANKHYA | 1 |
| ZZ_PROBE | 7 |
