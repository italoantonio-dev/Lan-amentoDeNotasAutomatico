/*__MOTOR__*/

async function configRobo() {
  const out = {};
  (await listar(SF.roboLerConfig, {})).forEach((r) => { out[r.CHAVE] = r.VALOR; });
  return out;
}

async function subirPrivado(nome, buffer) {
  const arquivo = new File([buffer], nome, { type: /\.xml$/i.test(nome) ? 'application/xml' : 'application/pdf' });
  const up = await sdk.uploadFilePrivateMitra({ projectId: PROJECT_ID, file: arquivo });
  return (up && up.result && up.result.key) || '';
}

// O robo repete a sequencia da tela e do chat e termina no mesmo envio ao ERP: nenhuma
// regra e reescrita nem afrouxada aqui.
async function processarAnexo(ctx) {
  const { nome, buffer, emailId, simulacao, config, empresas, tipos } = ctx;
  const corte = Number(config.CORTE_CONFIANCA ?? 90);
  const hash = leitura.hashConteudo(buffer);
  const lido = leitura.lerDocumento(nome, buffer);
  const emitente = lido.cnpjEmitente;
  const candidatos = lido.cnpjsCandidatos.filter((c) => c !== emitente);
  // Numa nota de entrada, quem emite e o fornecedor; quem recebe e a empresa cadastrada aqui.
  const empresa = empresas.find((e) => candidatos.includes(soDigitos(e.CNPJ))) || null;
  const nota = leitura.pontuar(lido, empresa);
  const cnpjFornecedor = emitente || candidatos.find((c) => !empresa || c !== soDigitos(empresa.CNPJ)) || '';
  const campos = {
    fornecedor: lido.nomeEmitente, cnpjFornecedor, numero: lido.numero, serie: lido.serie, dataEmissao: lido.dataEmissao, dataVencimento: lido.dataVencimento,
    valorTotal: lido.valorTotal, chave: lido.chave, tipo: lido.tipoProvavel, empresa: empresa ? empresa.NOME : '', itens: lido.itens.length, cnpjsLidos: lido.cnpjsCandidatos,
  };
  const registro = {
    emailId: emailId || 0, nome: texto(nome, 300), tipo: lido.formato, tamanho: buffer.length, hash, origemLeitura: simulacao ? 'SIMULACAO' : 'EMAIL', confianca: nota.confianca,
    criterios: paraB64(JSON.stringify(nota.criterios)), campos: paraB64(JSON.stringify(campos)), lancamentoId: 0, documentoId: 0, chaveErp: '', arquivoKey: '',
  };
  const fechar = async (decisao, motivo, extra) => {
    await chamar(SF.roboRegistrarAnexo, Object.assign(registro, { decisao, motivo: texto(motivo, 500) }, extra || {}));
    return { decisao, motivo, confianca: nota.confianca, criterios: nota.criterios, campos, lancamentoId: (extra && extra.lancamentoId) || 0, chaveErp: (extra && extra.chaveErp) || '' };
  };

  const dup = await uma(SF.verificarDuplicidadeDocumento, { hash });
  if (dup && dup.LANCAMENTO_ID) return fechar('DUPLICADO', 'Este arquivo já entrou' + (dup.LANCAMENTO_ID ? ' no lançamento ' + dup.LANCAMENTO_ID : '') + '.', { lancamentoId: dup.LANCAMENTO_ID || 0, documentoId: dup.DOCUMENTO_ID || 0 });

  const arquivoKey = await subirPrivado(nome, buffer);
  registro.arquivoKey = arquivoKey;

  if (!empresa) {
    const lidos = lido.cnpjsCandidatos.length ? lido.cnpjsCandidatos.join(', ') : 'nenhum';
    return fechar('SEM_EMPRESA', 'Nenhum CNPJ de destinatário bate com empresa cadastrada (lidos: ' + lidos + '). Quem recebe a nota precisa ser uma empresa cadastrada aqui; quem emite é o fornecedor.');
  }

  const tipo = tipos.find((t) => t.CODIGO === lido.tipoProvavel) || tipos.find((t) => t.CODIGO === 'BOLETO');
  const abaixo = nota.confianca < corte;
  const criado = await criarLancamentoNucleo({
    logsExtras: [{ etapa: 'LEITURA', status: abaixo ? 'ATENCAO' : 'OK', mensagem: 'Leitura ' + lido.formato + ' com confiança ' + nota.confianca + ' (corte ' + corte + ').' }],
    empresaId: empresa.ID, tipoId: tipo.ID, hash, arquivoNome: nome, arquivoKey, cnpj: cnpjFornecedor, nome: lido.nomeEmitente || 'Fornecedor não identificado', numeroDoc: lido.numero, serie: lido.serie,
    dataEmissao: lido.dataEmissao, dataVencimento: lido.dataVencimento, valorTotal: lido.valorTotal, itens: lido.itens, origem: simulacao ? 'ROBO (simulação)' : 'ROBO', revisao: abaixo,
  });
  if (!criado.ok) return fechar('ERRO', criado.erro || 'Não consegui criar o lançamento.');
  const base = { lancamentoId: criado.lancamentoId, documentoId: criado.documentoId };

  if (abaixo) return fechar('REVISAO', 'Confiança ' + nota.confianca + ' < corte ' + corte + ': precisa de conferência humana.', base);
  if (criado.status !== 'APROVADO') return fechar('APROVACAO', 'Confiança ' + nota.confianca + ' ≥ corte ' + corte + ', mas o valor está acima da alçada: foi para a fila de aprovação.', base);

  const envio = await chamar(SF.enviarLancamentoParaErp, { lancamentoId: criado.lancamentoId, simular: simulacao ? 'S' : '' });
  if (simulacao) {
    if (envio && envio.ok) return fechar('SIMULADO', 'Confiança ' + nota.confianca + ' ≥ corte ' + corte + ' e valor dentro da alçada: o robô lançaria no ERP. Na simulação nada é gravado; abra o lançamento para enviar.', base);
    return fechar('ERRO', 'Confiança ' + nota.confianca + ' ≥ corte ' + corte + ', mas o envio pararia: ' + ((envio && envio.mensagem) || 'motivo desconhecido'), base);
  }
  if (envio && envio.ok) return fechar('LANCADO', 'Confiança ' + nota.confianca + ' ≥ corte ' + corte + ' e valor dentro da alçada: lançado pelo robô (chave ' + envio.chave + ').', Object.assign(base, { chaveErp: String(envio.chave || '') }));
  return fechar('ERRO', 'Confiança ' + nota.confianca + ' ≥ corte ' + corte + ', mas o envio parou: ' + ((envio && envio.mensagem) || 'motivo desconhecido'), base);
}
