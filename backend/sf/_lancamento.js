// Classificacao e criacao do lancamento: unico caminho para tela, chat e robo.
const MIN_LOCAL = 2;
const MIN_ERP = 3;
const DOMINANCIA = 0.7;

function dominante(valores) {
  const presentes = valores.filter((v) => v !== null && v !== undefined && v !== '');
  if (!presentes.length) return null;
  const cont = new Map();
  presentes.forEach((v) => cont.set(String(v), (cont.get(String(v)) || 0) + 1));
  let topo = null; let n = 0;
  cont.forEach((qtd, chave) => { if (qtd > n) { n = qtd; topo = chave; } });
  return { valor: topo, n, total: presentes.length, parcela: n / presentes.length };
}

async function historicoErp(codemp, codparc) {
  const sql = "SELECT 'NATUREZA' AS DIM, TO_CHAR(CODNAT) AS COD, COUNT(*) AS N FROM TGFFIN WHERE CODEMP = " + codemp + ' AND CODPARC = ' + codparc + ' AND RECDESP = -1 AND DTNEG >= ADD_MONTHS(SYSDATE, -24) AND CODNAT IS NOT NULL GROUP BY CODNAT'
    + " UNION ALL SELECT 'CENTRO', TO_CHAR(CODCENCUS), COUNT(*) FROM TGFFIN WHERE CODEMP = " + codemp + ' AND CODPARC = ' + codparc + ' AND RECDESP = -1 AND DTNEG >= ADD_MONTHS(SYSDATE, -24) AND CODCENCUS IS NOT NULL GROUP BY CODCENCUS'
    + " UNION ALL SELECT 'CONTA', TO_CHAR(CODCTABCOINT), COUNT(*) FROM TGFFIN WHERE CODEMP = " + codemp + ' AND CODPARC = ' + codparc + ' AND RECDESP = -1 AND DTNEG >= ADD_MONTHS(SYSDATE, -24) AND CODCTABCOINT IS NOT NULL GROUP BY CODCTABCOINT';
  return erpConsulta(sql);
}

// A TOP nunca e aprendida: ela responde ao tipo de documento, nao a quem emitiu.
// O limiar e por dimensao: um fornecedor pode ser 97% consistente em natureza e 52% em conta.
async function resolverClassificacao(empresaId, tipoId, cnpj) {
  const param = await uma(SF.parametroComEmpresa, { empresaId, tipoId });
  const res = {
    topId: param ? inteiro(param.TOP_ID) : 0,
    naturezaId: param ? inteiro(param.NATUREZA_ID) : 0,
    centroId: param ? inteiro(param.CENTRO_ID) : 0,
    contaId: param ? inteiro(param.CONTA_ID) : 0,
    origem: param ? 'PARAMETRO' : '',
    justificativas: [],
    temParametro: Boolean(param),
    avisos: [],
  };
  const DIMS = [
    { chave: 'naturezaId', dim: 'NATUREZA', campo: 'NATUREZA_ID', cod: 'CODNAT', desc: 'NATUREZA_DESC', rotulo: 'Natureza' },
    { chave: 'centroId', dim: 'CENTRO', campo: 'CENTRO_ID', cod: 'CODCENCUS', desc: 'CENTRO_DESC', rotulo: 'Centro' },
    { chave: 'contaId', dim: 'CONTA', campo: 'CONTA_ID', cod: 'CODCTABCO', desc: 'CONTA_DESC', rotulo: 'Conta' },
  ];
  const c = soDigitos(cnpj);
  if (!c) return res;

  const local = await listar(SF.padraoLocalFornecedor, { empresaId, cnpj: c });
  const resolvidas = new Set();
  for (const d of DIMS) {
    const dom = dominante(local.map((l) => l[d.campo]));
    if (dom && dom.total >= MIN_LOCAL && dom.parcela >= DOMINANCIA) {
      const ref = local.find((l) => String(l[d.campo]) === dom.valor) || {};
      res[d.chave] = Number(dom.valor);
      res.origem = 'PADRAO_HISTORICO';
      resolvidas.add(d.dim);
      res.justificativas.push(d.rotulo + ' ' + (ref[d.cod] || '') + ' ' + (ref[d.desc] || '') + ' herdada do histórico deste sistema (' + dom.n + ' de ' + dom.total + ' lançamentos)');
    }
  }
  if (resolvidas.size === DIMS.length || !param) return res;

  // Historico do ERP: so para o que o historico local nao resolveu. Falha aqui nao trava a criacao.
  try {
    const parceiros = await parceirosPorCnpj(c);
    const forn = parceiros.filter((p) => String(p.FORNECEDOR).toUpperCase() === 'S');
    const unicos = forn.length ? forn : parceiros;
    if (unicos.length !== 1) return res;
    const hist = await historicoErp(Number(param.CODEMP), Number(unicos[0].CODPARC));
    const porDim = { NATUREZA: [], CENTRO: [], CONTA: [] };
    hist.forEach((h) => porDim[h.DIM] && porDim[h.DIM].push({ cod: String(h.COD), n: Number(h.N) }));
    const escolhidos = {};
    for (const d of DIMS) {
      if (resolvidas.has(d.dim)) continue;
      const lista = porDim[d.dim];
      const total = lista.reduce((s, x) => s + x.n, 0);
      const topo = lista.slice().sort((a, b) => b.n - a.n)[0];
      if (topo && total >= MIN_ERP && topo.n / total >= DOMINANCIA) escolhidos[d.dim] = { cod: topo.cod, n: topo.n, total, d };
    }
    if (!Object.keys(escolhidos).length) return res;
    const mapa = await listar(SF.mapearCodigosErp, {
      naturezas: (escolhidos.NATUREZA || {}).cod || '', centros: (escolhidos.CENTRO || {}).cod || '', contas: (escolhidos.CONTA || {}).cod || '',
    });
    for (const dim of Object.keys(escolhidos)) {
      const e = escolhidos[dim];
      const m = mapa.find((x) => x.DIM === dim && String(x.COD) === e.cod);
      if (!m) continue;
      res[e.d.chave] = Number(m.ID);
      res.origem = 'PADRAO_HISTORICO';
      res.justificativas.push(e.d.rotulo + ' ' + e.cod + ' ' + (m.DESCRICAO || '') + ' herdada do histórico do fornecedor no ERP (' + e.n + ' de ' + e.total + ' títulos)');
    }
  } catch (e) {
    res.avisos.push('Histórico do fornecedor no ERP indisponível: ' + msgErro(e));
  }
  return res;
}

function hashDeCampos(d) {
  const base = [d.empresaId, d.tipoId, soDigitos(d.cnpj), d.numeroDoc, d.valorTotal, d.dataEmissao].join('|');
  return require('crypto').createHash('sha256').update(base).digest('hex');
}

async function criarLancamentoNucleo(d) {
  const empresaId = inteiro(d.empresaId);
  const tipoId = inteiro(d.tipoId);
  const valorTotal = Number(d.valorTotal);
  if (!empresaId) return { ok: false, erro: 'Informe a empresa.' };
  if (!tipoId) return { ok: false, erro: 'Informe o tipo de documento.' };
  if (!Number.isFinite(valorTotal) || valorTotal < 0) return { ok: false, erro: 'Informe um valor válido.' };
  const emData = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : '');
  const arquivoKey = /^ai-files\/private\//.test(String(d.arquivoKey || '')) ? String(d.arquivoKey) : '';
  const hash = /^[0-9a-f]{64}$/i.test(String(d.hash || '')) ? String(d.hash).toLowerCase() : hashDeCampos(d);

  const dup = await uma(SF.verificarDuplicidadeDocumento, { hash });
  if (dup && dup.LANCAMENTO_ID) return { ok: false, duplicado: true, lancamentoId: dup.LANCAMENTO_ID, documentoId: dup.DOCUMENTO_ID, erro: 'Este documento já entrou no lançamento ' + dup.LANCAMENTO_ID + '.' };

  // Documento sem lancamento e sobra de uma tentativa interrompida: retoma em vez de travar o arquivo.
  if (!dup) await chamar(SF.criarDocumento, { empresaId, tipoId, nome: texto(d.arquivoNome || 'Sem arquivo', 300), arquivoKey, hash });
  const doc = await uma(SF.obterDocumentoPorHash, { hash });
  if (!doc) return { ok: false, erro: 'Não consegui registrar o documento.' };

  const c = await resolverClassificacao(empresaId, tipoId, d.cnpj);
  await chamar(SF.criarLancamento, {
    documentoId: doc.ID, cnpj: soDigitos(d.cnpj), nome: texto(d.nome, 200), codparc: inteiro(d.codparc), numeroDoc: texto(d.numeroDoc, 30), serie: texto(d.serie, 10),
    dataEmissao: emData(d.dataEmissao), dataVencimento: emData(d.dataVencimento), valorTotal,
    topId: c.topId, naturezaId: c.naturezaId, centroId: c.centroId, contaId: c.contaId, origem: c.origem, revisao: d.revisao ? 'S' : '',
  });
  const l = await uma(SF.obterLancamentoPorDocumento, { documentoId: doc.ID });
  if (!l) return { ok: false, erro: 'Não consegui criar o lançamento.' };

  const itens = Array.isArray(d.itens) ? d.itens : [];
  if (itens.length) {
    const lista = itens.slice(0, 500).map((i) => ({ descricao: texto(i.descricao, 300), quantidade: Number(i.quantidade) || 1, valorUnitario: Number(i.valorUnitario) || 0, codprod: inteiro(i.codprod) }));
    await chamar(SF.criarItensLancamento, { lancamentoId: l.ID, linhas: paraB64(JSON.stringify(lista)) });
  }
  // Trilha em uma chamada so: chamada entre SFs tambem conta no limite por minuto do projeto.
  const PORTAS = { TELA: 'pela tela de Lançamentos', CHAT: 'pelo Assistente', ROBO: 'pelo robô de e-mail', 'ROBO (simulação)': 'pelo robô, em simulação' };
  const trilha = [{ etapa: 'ENTRADA', status: 'OK', mensagem: 'Documento recebido ' + (PORTAS[d.origem] || 'pela tela de Lançamentos') + (d.arquivoNome ? ': ' + texto(d.arquivoNome, 200) : '') + '.' }];
  (d.logsExtras || []).forEach((x) => trilha.push(x));
  if (c.justificativas.length) c.justificativas.forEach((j) => trilha.push({ etapa: 'CLASSIFICACAO', status: 'OK', mensagem: j }));
  else if (c.temParametro) trilha.push({ etapa: 'CLASSIFICACAO', status: 'OK', mensagem: 'Classificação vinda do parâmetro da empresa e tipo.' });
  else trilha.push({ etapa: 'CLASSIFICACAO', status: 'ATENCAO', mensagem: 'Sem parâmetro cadastrado para esta empresa e tipo: o lançamento aguarda aprovação e a classificação precisa ser informada.' });
  c.avisos.forEach((a) => trilha.push({ etapa: 'CLASSIFICACAO', status: 'ATENCAO', mensagem: a }));
  trilha.push({ etapa: 'ALCADA', status: 'OK', mensagem: l.STATUS === 'APROVADO' ? 'Valor dentro do limite de aprovação: aprovado automaticamente.' : l.STATUS === 'REVISAO_LEITURA' ? 'Leitura abaixo do corte: aguarda conferência humana.' : 'Valor acima do limite, ou sem limite cadastrado: aguarda aprovação.' });
  await chamar(SF.registrarLogsLote, { lancamentoId: l.ID, linhas: paraB64(JSON.stringify(trilha)) });
  return { ok: true, lancamentoId: l.ID, documentoId: doc.ID, status: l.STATUS, origemClassificacao: c.origem, justificativas: c.justificativas, avisos: c.avisos };
}
