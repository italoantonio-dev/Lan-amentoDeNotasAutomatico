# Registro das consultas (somente leitura)

| ID | Objetivo | Origem | Período | Filtros | Linhas | Lido em |
|---|---|---|---|---|---:|---|
| A001 | Validar tabela e colunas antes das consultas: TGFVAR | USER_TAB_COLUMNS (dicionario do Oracle) | — | TABLE_NAME = TGFVAR | 12 | 2026-11-04 19:54:23 |
| A002 | Validar tabela e colunas antes das consultas: TGFITE | USER_TAB_COLUMNS (dicionario do Oracle) | — | TABLE_NAME = TGFITE | 227 | 2026-11-04 19:54:26 |
| A003 | Validar tabela e colunas antes das consultas: TGFCAB | USER_TAB_COLUMNS (dicionario do Oracle) | — | TABLE_NAME = TGFCAB | 438 | 2026-11-04 19:25:41 |
| A004 | Validar tabela e colunas antes das consultas: TGFTOP | USER_TAB_COLUMNS (dicionario do Oracle) | — | TABLE_NAME = TGFTOP | 416 | 2026-11-04 19:25:38 |
| A005 | Validar tabela e colunas antes das consultas: TGFFIN | USER_TAB_COLUMNS (dicionario do Oracle) | — | TABLE_NAME = TGFFIN | 253 | 2026-11-04 19:25:35 |
| A006 | Pedidos de compra por empresa, situacao e pendencia | TGFCAB | DTNEG de 2025-11-01 a 2026-10-31 | TIPMOV = 'O', CODEMP em 200,300,100,201,301,302,400,500,202,203,501,700,600 | 39 | 2026-11-04 19:55:36 |
| A007 | Notas de compra por TOP: quantas vieram de pedido (TGFVAR) | TGFCAB + TGFVAR | DTNEG de 2025-11-01 a 2026-10-31 | TIPMOV = 'C', CODEMP em 200,300,100,201,301,302,400,500,202,203,501,700,600; pedido = TGFVAR.NUNOTAORIG com TIPMOV 'O' | 20 | 2026-11-04 19:55:40 |
| A008 | TOP do pedido para TOP da nota (faturamento observado) | TGFVAR + TGFCAB | DTNEG de 2025-11-01 a 2026-10-31 | nota TIPMOV 'C', origem TIPMOV 'O', CODEMP em 200,300,100,201,301,302,400,500,202,203,501,700,600 | 25 | 2026-11-04 19:55:43 |
| A009 | Divergencia entre item do pedido e item da nota faturada | TGFVAR + TGFCAB + TGFITE | DTNEG de 2025-11-01 a 2026-10-31 | nota TIPMOV 'C', origem TIPMOV 'O', CODEMP em 200,300,100,201,301,302,400,500,202,203,501,700,600 | 1 | 2026-11-04 19:55:46 |
| A010 | Situacao da nota x titulos de provisao e reais (compras e pedidos) | TGFCAB + TGFFIN | DTNEG de 2025-11-01 a 2026-10-31 | TIPMOV em ('C','O'), CODEMP em 200,300,100,201,301,302,400,500,202,203,501,700,600 | 3 | 2026-11-04 19:55:49 |
| A011 | Situacao por tipo de movimento | TGFCAB | DTNEG de 2025-11-01 a 2026-10-31 | TIPMOV em ('C','O'), CODEMP em 200,300,100,201,301,302,400,500,202,203,501,700,600 | 5 | 2026-11-04 19:55:52 |
| A012 | Campos de configuracao das TOPs de pedido e de compra (valores brutos, sem interpretacao) | TGFTOP | — (cadastro) | CODTIPOPER em 1414,1404,1403,1452,1419,1426,1420,1405,1401,1454,1160,1412,1425,11,1409,1410,1424,1191,1458,1451,1314,1304,1301,1302,1309,1300,2001 | 27 | 2026-11-04 19:55:55 |
| A013 | Pedidos de compra marcados como pendentes hoje (qualquer data) | TGFCAB | — (situacao atual) | TIPMOV = 'O', PENDENTE = 'S', CODEMP em 200,300,100,201,301,302,400,500,202,203,501,700,600 | 13 | 2026-11-04 19:55:58 |