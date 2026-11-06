// Grupos de usuarios do Sankhya com quantos usuarios ativos tem e-mail. Somente leitura.
const adm = await uma(SF.souAdministrador, {});
if (!adm || Number(adm.ADMIN) !== 1) return { ok: false, erro: 'Só o administrador vê os grupos do Sankhya.' };
try {
  const grupos = await erpConsulta("SELECT G.CODGRUPO, G.NOMEGRUPO, COUNT(U.CODUSU) AS ATIVOS, SUM(CASE WHEN U.EMAIL IS NOT NULL THEN 1 ELSE 0 END) AS COM_EMAIL FROM TSIGRU G JOIN TSIUSU U ON U.CODGRUPO = G.CODGRUPO WHERE NVL(U.DTLIMACESSO, SYSDATE + 1) > SYSDATE AND G.CODGRUPO > 0 GROUP BY G.CODGRUPO, G.NOMEGRUPO ORDER BY G.NOMEGRUPO");
  return { ok: true, grupos };
} catch (e) {
  return { ok: false, erro: 'Não consegui ler os grupos do Sankhya: ' + msgErro(e) };
}
