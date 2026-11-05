# Registro das consultas da matriz (somente leitura)

| ID | Objetivo | Origem | Período | Filtros | Linhas | Erro |
|---|---|---|---|---|---:|---|
| A001 | NF-e de compra por empresa e TOP, com origem em pedido | TGFCAB + TGFVAR | 01/11/2025 a 31/10/2026 | TIPMOV = 'C', CHAVENFE preenchida, CODEMP em 200,300,100,201,301,302,400,500,202,203,501,700,600 | 186 |  |
| A002 | Versao vigente de cada TOP | TGFTOP (maior DHALTER por codigo) | 01/11/2025 a 31/10/2026 | todas | 330 |  |
| A003 | Boleto e guia por empresa e TOP, na categoria real da auditoria | TGFFIN + TGFTOP + TGFNAT + TGFTIT + TGFCAB | 01/11/2025 a 31/10/2026 | RECDESP = -1, PROVISAO = 'N', CODEMP em 200,300,100,201,301,302,400,500,202,203,501,700,600 | 138 |  |
