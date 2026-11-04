const busca = sqlTextoBusca(event.busca);
if (busca.length < 2) return { ok: true, itens: [] };
const dig = soDigitos(busca);
const porCnpj = dig.length >= 8 && dig.length === busca.replace(/[ .\-/]/g, '').length;
const filtro = porCnpj
  ? "CGC_CPF LIKE '" + dig + "%'"
  : "(UPPER(NOMEPARC) LIKE '%" + busca + "%' OR UPPER(RAZAOSOCIAL) LIKE '%" + busca + "%')";
// Oracle aplica ROWNUM antes do ORDER BY: ordena na subconsulta.
const itens = await erpConsulta(
  "SELECT * FROM (SELECT CODPARC, NOMEPARC, RAZAOSOCIAL, CGC_CPF, FORNECEDOR FROM TGFPAR WHERE ATIVO = 'S' AND " + filtro + " ORDER BY NOMEPARC) WHERE ROWNUM <= 20",
);
return { ok: true, itens };
