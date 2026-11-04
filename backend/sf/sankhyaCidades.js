const busca = sqlTextoBusca(event.busca);
if (busca.length < 2) return { ok: true, itens: [] };
const itens = await erpConsulta(
  "SELECT * FROM (SELECT C.CODCID, C.NOMECID, C.UF FROM TSICID C WHERE UPPER(C.NOMECID) LIKE '" + busca + "%' ORDER BY C.NOMECID) WHERE ROWNUM <= 20",
);
return { ok: true, itens };
