// Passar no teste da conexao prova o login; quem prova o caminho inteiro e uma consulta real.
try {
  const r = await erpConsulta('SELECT COUNT(*) AS N FROM TSIEMP');
  return { configurada: true, empresas: Number((r[0] || {}).N || 0) };
} catch (e) {
  return { configurada: false, erro: msgErro(e) };
}
