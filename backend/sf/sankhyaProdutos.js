const busca = sqlTextoBusca(event.busca);
if (busca.length < 2) return { ok: true, itens: [] };
const cod = /^\d+$/.test(busca) ? ' OR CODPROD = ' + Number(busca) : '';
const itens = await erpConsulta(
  "SELECT * FROM (SELECT CODPROD, DESCRPROD, CODVOL FROM TGFPRO WHERE ATIVO = 'S' AND (UPPER(DESCRPROD) LIKE '%" + busca + "%'" + cod + ') ORDER BY DESCRPROD) WHERE ROWNUM <= 20',
);
return { ok: true, itens };
