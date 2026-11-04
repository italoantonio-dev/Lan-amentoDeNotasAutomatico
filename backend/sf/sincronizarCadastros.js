const adm = await uma(SF.souAdministrador, {});
if (!adm || Number(adm.ADMIN) !== 1) return { ok: false, erro: 'Somente o administrador pode sincronizar com o ERP.' };

const MOV = { C: 'Compra', V: 'Venda', D: 'Devolução de venda', E: 'Devolução de compra', I: 'Interno / financeiro', P: 'Pedido de compra', O: 'Pedido de venda', J: 'Requisição', T: 'Transferência', L: 'Lançamento', Z: 'Outros', Q: 'Requisição', F: 'Produção' };
const sn = (v) => (String(v).toUpperCase() === 'S' ? 1 : 0);
const CARGAS = [
  { nome: 'EMPRESAS', ler: SF.sankhyaEmpresas, gravar: SF.upsertEmpresas, cod: 'CODEMP', map: (r) => ({ cod: r.CODEMP, desc: r.NOMEFANTASIA || r.RAZAOSOCIAL, cnpj: soDigitos(r.CGC) }) },
  { nome: 'TOPS', ler: SF.sankhyaTops, gravar: SF.upsertTops, cod: 'CODTIPOPER', map: (r) => ({ cod: r.CODTIPOPER, desc: r.DESCROPER, ativo: sn(r.ATIVO), tipmov: r.TIPMOV, movimento: MOV[r.TIPMOV] || r.TIPMOV, atualFin: r.ATUALFIN }) },
  { nome: 'NATUREZAS', ler: SF.sankhyaNaturezas, gravar: SF.upsertNaturezas, cod: 'CODNAT', map: (r) => ({ cod: r.CODNAT, desc: r.DESCRNAT, ativo: sn(r.ATIVA) }) },
  { nome: 'CENTROS', ler: SF.sankhyaCentros, gravar: SF.upsertCentros, cod: 'CODCENCUS', map: (r) => ({ cod: r.CODCENCUS, desc: r.DESCRCENCUS, ativo: sn(r.ATIVO) }) },
  { nome: 'CONTAS', ler: SF.sankhyaContas, gravar: SF.upsertContas, cod: 'CODCTABCOINT', map: (r) => ({ cod: r.CODCTABCOINT, desc: r.DESCRICAO, banco: r.CODBCO == null ? '' : 'Banco ' + r.CODBCO, ativo: sn(r.ATIVA) }) },
  { nome: 'TIPOS_TITULO', ler: SF.sankhyaTiposTitulo, gravar: SF.upsertTiposTitulo, cod: 'CODTIPTIT', map: (r) => ({ cod: r.CODTIPTIT, desc: r.DESCRTIPTIT, ativo: sn(r.ATIVO) }) },
];

const existentes = {};
for (const r of await listar(SF.codigosCadastroExistentes, {})) {
  (existentes[r.T] = existentes[r.T] || new Set()).add(String(r.C));
}

const resultado = [];
for (const c of CARGAS) {
  try {
    const lidos = linhasDaIntegracao(await chamar(c.ler, {}));
    if (!lidos.length) throw new Error('O ERP não devolveu nenhuma linha. Nada foi alterado.');
    // TGFTOP pode empatar em DHALTER: o codigo natural manda.
    const porCodigo = new Map();
    for (const r of lidos) porCodigo.set(String(r[c.cod]), c.map(r));
    const lista = [...porCodigo.values()];
    for (let i = 0; i < lista.length; i += 100) {
      await chamar(c.gravar, { linhas: paraB64(JSON.stringify(lista.slice(i, i + 100))) });
    }
    const jaTinha = existentes[c.nome] || new Set();
    const novos = lista.filter((x) => !jaTinha.has(String(x.cod))).length;
    const atualizados = lista.length - novos;
    await chamar(SF.registrarSincronizacao, { cadastro: c.nome, lidos: lidos.length, novos, atualizados, total: lista.length });
    resultado.push({ cadastro: c.nome, ok: true, lidos: lidos.length, novos, atualizados });
  } catch (e) {
    const m = msgErro(e);
    resultado.push({ cadastro: c.nome, ok: false, erro: m });
    if (ehErroCredencial(m)) return { ok: false, naoConfigurada: true, erro: 'Integração com o ERP não configurada: ' + m, resultado };
  }
}
return { ok: resultado.every((r) => r.ok), resultado };
