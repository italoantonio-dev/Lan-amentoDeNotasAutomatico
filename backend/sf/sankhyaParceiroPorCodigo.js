const cod = inteiro(event.codparc);
if (cod <= 0) return { ok: true, itens: [] };
return { ok: true, itens: await erpConsulta('SELECT CODPARC, NOMEPARC, RAZAOSOCIAL, CGC_CPF, FORNECEDOR, CLIENTE, ATIVO, CODCID FROM TGFPAR WHERE CODPARC = ' + cod) };
