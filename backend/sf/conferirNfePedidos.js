// Conferencia de NF-e com pedidos de compra (Fases 1 e 2). SOMENTE LEITURA: consulta o ERP pela
// porta unica; nao cria nota, nao altera pedido, nao gera provisao e nao grava neste sistema.
const pode = await uma(SF.podeConferirNfe, {});
if (!pode || Number(pode.PODE) !== 1) return { ok: false, erro: 'Você não tem acesso à conferência de notas fiscais.' };

const lancamentoId = inteiro(event.lancamentoId);
let lido = null;
let origem = '';
let empresaDoLancamento = null; // sem XML, a empresa vem do lancamento
if (lancamentoId) {
  const d = await uma(SF.erpDadosEnvio, { id: lancamentoId });
  if (!d) return { ok: false, erro: 'Lançamento não encontrado, ou fora dos tipos que você enxerga.' };
  empresaDoLancamento = { CODEMP: d.CODEMP, NOME: d.EMPRESA };
  const arq = d.DOCUMENTO_ID ? await uma(SF.keyArquivoDocumento, { id: d.DOCUMENTO_ID }) : null;
  if (arq && arq.CHAVE_ARQUIVO) {
    try {
      const blob = await sdk.downloadFilePrivateMitra({ projectId: PROJECT_ID, key: arq.CHAVE_ARQUIVO });
      const l = leitura.lerDocumento(String(arq.NOME || ''), Buffer.from(await blob.arrayBuffer()));
      if (l.formato === 'XML') { lido = l; origem = 'XML do lançamento'; }
    } catch (_) { /* arquivo ilegivel: segue com os dados do lancamento */ }
  }
  if (!lido) {
    const itens = await listar(SF.listarItensLancamento, { lancamentoId });
    lido = {
      chave: '', cnpjEmitente: soDigitos(d.CNPJ_FORNECEDOR), cnpjsCandidatos: [], numero: d.NUMERO_DOC || '', serie: d.SERIE || '', dataEmissao: d.DATA_EMISSAO || '', valorTotal: d.VALOR_TOTAL,
      itens: itens.map((i, k) => ({ nItem: k + 1, descricao: i.DESCRICAO, quantidade: i.QUANTIDADE, valorUnitario: i.VALOR_UNITARIO, valorTotal: Number(i.QUANTIDADE) * Number(i.VALOR_UNITARIO), codprod: i.CODPROD })),
    };
    origem = 'dados do lançamento, sem XML: só os itens com produto do ERP informado são comparados';
  }
} else if (event.conteudoB64) {
  const b64 = String(event.conteudoB64);
  if (b64.length > 4 * 1024 * 1024) return { ok: false, erro: 'Arquivo grande demais para a conferência (limite de 3 MB).' };
  lido = leitura.lerDocumento(texto(event.nome || 'nota.xml', 200), Buffer.from(b64, 'base64'));
  if (lido.formato !== 'XML') return { ok: false, erro: 'A conferência com pedidos precisa do XML da NF-e.' };
  origem = 'XML enviado para conferência';
} else {
  return { ok: false, erro: 'Informe o lançamento ou o XML da nota.' };
}

const destinatarios = (lido.cnpjsCandidatos || []).filter((c) => c && c !== lido.cnpjEmitente);
// Um CNPJ pode pertencer a mais de um codigo de empresa: vale o conjunto.
const cadastradas = await listar(SF.roboEmpresas, {});
const pelaNota = cadastradas.filter((e) => destinatarios.includes(soDigitos(e.CNPJ))).map((e) => ({ CODEMP: e.CODEMP, NOME: e.NOME }));
const empresas = pelaNota.length ? pelaNota : (!destinatarios.length && empresaDoLancamento ? [empresaDoLancamento] : []);
const documento = {
  chave: lido.chave || '', numero: lido.numero || '', serie: lido.serie || '', dataEmissao: lido.dataEmissao || '', cnpjEmitente: soDigitos(lido.cnpjEmitente), cnpjDestinatario: destinatarios[0] || '', valorTotal: Number(lido.valorTotal) || 0,
  itens: (lido.itens || []).slice(0, 990).map((i) => ({ nItem: i.nItem, cProd: i.cProd || '', cEAN: i.cEAN || '', xProd: i.descricao || '', quantidade: i.quantidade, unidade: i.unidade || '', valorUnitario: i.valorUnitario, valorTotal: i.valorTotal, codprod: inteiro(i.codprod) })),
};
let dados = { parceiros: [], dePara: [], referencias: [], pedidos: [], existentes: [], alertasLeitura: [] };
try {
  if (empresas.length) dados = await dadosDaCorrespondencia(documento);
} catch (e) {
  return { ok: false, erro: 'Não consegui consultar o ERP: ' + msgErro(e) };
}
const resultado = correspondencia.conferir({ documento, empresas, parceiros: dados.parceiros, dePara: dados.dePara, referencias: dados.referencias, pedidos: dados.pedidos, existentes: dados.existentes });
resultado.alertas.push(...dados.alertasLeitura);
if (empresaDoLancamento && pelaNota.length && !pelaNota.some((e) => Number(e.CODEMP) === Number(empresaDoLancamento.CODEMP))) {
  resultado.alertas.push({ tipo: 'EMPRESA_DIFERENTE_DO_LANCAMENTO', mensagem: 'O destinatário da NF-e é a empresa ' + pelaNota.map((e) => e.CODEMP).join(' ou ') + ', mas o lançamento está na empresa ' + empresaDoLancamento.CODEMP + '.' });
}
return { ok: true, origem, piloto: PILOTO_CORRESPONDENCIA, resultado };
