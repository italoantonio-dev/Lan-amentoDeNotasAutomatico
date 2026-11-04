// Apoio comum das SFs JavaScript. Fica em arquivo e e concatenado por lib/base.mjs.
const sdk = require('mitra-sdk');
const PROJECT_ID = Number(process.env.MITRA_PROJECT_ID);
const SF = {"registrarLog":63,"erpDadosEnvio":133,"conferirNfePedidos":212,"parceiroJaEscolhidoParaCnpj":132,"corrigirDadosLancamentoParceiro":138,"listarItensLancamento":55,"erpReservarEnvio":136,"erpRegistrarEnvio":135,"erpConcluirEnvio":137};
let __contador = 0;

function msgErro(e) {
  if (e == null) return 'Erro desconhecido';
  if (typeof e === 'string') return e;
  if (typeof e.message === 'string' && e.message) return e.message;
  if (e.message && typeof e.message === 'object') return msgErro(e.message);
  if (e.error) return msgErro(e.error);
  try { return JSON.stringify(e); } catch (_) { return String(e); }
}

// Toda chamada interna leva o proprio nonce. Falha da SF chamada vira excecao,
// nunca resultado vazio.
async function chamar(id, input) {
  const r = await sdk.executeServerFunctionMitra({
    projectId: PROJECT_ID,
    serverFunctionId: id,
    input: Object.assign({}, input || {}, { _nonce: Date.now() + '-' + ++__contador }),
  });
  const res = r && r.result ? r.result : {};
  if (res.executionStatus === 'FAILED') throw new Error(msgErro(res.error) || 'Falha ao executar a funcao ' + id);
  let out = res.output;
  if (typeof out === 'string') { try { out = JSON.parse(out); } catch (_) { /* mantem texto */ } }
  return out;
}
const linhas = (out) => (out && Array.isArray(out.rows) ? out.rows : []);
async function listar(id, input) { return linhas(await chamar(id, input)); }
async function uma(id, input) { return (await listar(id, input))[0] || null; }
async function afetou(id, input) { const o = await chamar(id, input); return Number((o && o.affectedRows) || 0); }
const paraB64 = (texto) => Buffer.from(String(texto == null ? '' : texto), 'utf8').toString('base64');
const soDigitos = (v) => String(v == null ? '' : v).replace(/\D/g, '');
const inteiro = (v) => { const n = parseInt(String(v), 10); return Number.isFinite(n) ? n : 0; };
const texto = (v, max) => String(v == null ? '' : v).slice(0, max || 500);


// Adaptador do ERP. O slug e o unico contrato entre o codigo e o Sankhya do cliente:
// URL, usuario e schema ficam na conexao, nunca aqui.
const SLUG_ERP = 'sankhya';
const EP_CONSULTA = '/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json';
const EP_SALVAR = '/gateway/v1/mge/service.sbr?serviceName=CRUDServiceProvider.saveRecord&outputType=json';

// FASE 0 (modulo-documental/fase0-plano-execucao.md): gravacao no ERP desligada.
// Nenhum parametro de tela, de banco ou de input liga a gravacao: religar exige autorizacao
// escrita e uma mudanca revisada nesta linha, publicada de novo em todas as SFs que usam este arquivo.
const GRAVACAO_ERP_HABILITADA = false;
// Criacao de nota: proibicao TEMPORARIA, separada da trava geral. So religa com servico oficial
// homologado (V-01, V-03) e autorizacao explicita. O caminho previsto e faturar um pedido de compra
// existente e salvar a nota resultante NAO CONFIRMADA. Ligar esta linha nao libera confirmacao.
const CRIACAO_NOTA_HABILITADA = false;
const ENTIDADES_DE_NOTA = ['CabecalhoNota', 'ItemNota'];
// Unica porta de saida para o ERP. Servico fora desta lista nao sai, ligado ou desligado.
const SERVICOS_ERP = {
  'DbExplorerSP.executeQuery': { endpoint: EP_CONSULTA, leitura: true },
  'CRUDServiceProvider.saveRecord': { endpoint: EP_SALVAR, leitura: false },
};
// Regra PERMANENTE: o sistema nunca confirma nota. Vale com qualquer trava ligada.
const SERVICO_DE_CONFIRMACAO = /confirm/i;
// Defesa a mais na leitura: o texto entre aspas e ignorado (nome de parceiro pode conter "MERGE").
// Comentario e recusado porque esconderia uma aspa dessa conta e, com ela, um segundo comando.
const SQL_PROIBIDO_ERP = /\b(INSERT|UPDATE|DELETE|MERGE|CREATE|ALTER|DROP|TRUNCATE|RENAME|GRANT|REVOKE|EXEC|EXECUTE|BEGIN|DECLARE|CALL|COMMIT|ROLLBACK|SAVEPOINT|LOCK|DBMS_\w+|UTL_\w+)\b|\bFOR\s+UPDATE\b|;|--|\/\*/i;

function erroBloqueio(codigo, mensagem) {
  const e = new Error(mensagem);
  e.codigo = codigo;
  return e;
}
const ehBloqueioErp = (e) => !!e && ['GRAVACAO_BLOQUEADA', 'CONFIRMACAO_PROIBIDA', 'SERVICO_NAO_PERMITIDO', 'SQL_NAO_E_LEITURA', 'CRIACAO_NOTA_BLOQUEADA'].includes(e.codigo);

function exigirSqlDeLeitura(sql) {
  const semTexto = String(sql || '').replace(/'(?:[^']|'')*'/g, "''");
  if (!/^\s*(SELECT|WITH)\b/i.test(semTexto) || SQL_PROIBIDO_ERP.test(semTexto)) {
    throw erroBloqueio('SQL_NAO_E_LEITURA', 'Consulta ao ERP recusada: só SELECT, sem comando de gravação.');
  }
}

// Toda chamada ao ERP passa aqui. As travas vem antes de qualquer rede.
async function erpChamar(servico, requestBody) {
  if (SERVICO_DE_CONFIRMACAO.test(String(servico))) {
    throw erroBloqueio('CONFIRMACAO_PROIBIDA', 'Confirmar nota no ERP é exclusivo de uma pessoa, dentro do Sankhya. O sistema nunca confirma.');
  }
  const s = Object.prototype.hasOwnProperty.call(SERVICOS_ERP, servico) ? SERVICOS_ERP[servico] : null;
  if (!s) throw erroBloqueio('SERVICO_NAO_PERMITIDO', 'Serviço do ERP fora da lista permitida: ' + String(servico).slice(0, 80) + '.');
  if (!s.leitura && !GRAVACAO_ERP_HABILITADA) {
    throw erroBloqueio('GRAVACAO_BLOQUEADA', 'Gravação no ERP desligada nesta fase: nada foi enviado ao Sankhya.');
  }
  const entidade = requestBody && requestBody.dataSet && requestBody.dataSet.rootEntity;
  if (!s.leitura && ENTIDADES_DE_NOTA.includes(entidade) && !CRIACAO_NOTA_HABILITADA) {
    throw erroBloqueio('CRIACAO_NOTA_BLOQUEADA', 'Criação de nota no ERP bloqueada até existir serviço oficial homologado e autorização explícita.');
  }
  if (s.leitura) exigirSqlDeLeitura(requestBody && requestBody.sql);
  return sdk.callIntegrationMitra({
    projectId: PROJECT_ID, connection: SLUG_ERP, method: 'POST', endpoint: s.endpoint,
    body: { serviceName: servico, requestBody },
  });
}

// O ERP devolve HTTP 200 mesmo recusando: o erro vem em statusMessage, sem responseBody.
function lerResposta(r) {
  const http = Number(r && r.statusCode);
  const b = r && r.body;
  if (http >= 400) {
    const detalhe = b && (b.message || b.error || b.statusMessage);
    throw new Error('O ERP respondeu HTTP ' + http + (detalhe ? ': ' + msgErro(detalhe) : ''));
  }
  if (!b || String(b.status) !== '1') {
    throw new Error((b && msgErro(b.statusMessage)) || 'O ERP nao confirmou a operacao.');
  }
  return b;
}

function linhasDoErp(body) {
  const rb = body.responseBody;
  if (!rb || !Array.isArray(rb.fieldsMetadata)) throw new Error(msgErro(body.statusMessage) || 'O ERP respondeu sem corpo.');
  const cols = rb.fieldsMetadata.map((f) => f.name);
  return (rb.rows || []).map((l) => { const o = {}; cols.forEach((c, i) => { o[c] = l[i]; }); return o; });
}

async function erpConsulta(sql) {
  const r = await erpChamar('DbExplorerSP.executeQuery', { sql });
  return linhasDoErp(lerResposta(r));
}

// Le o resultado de uma SF INTEGRATION de cadastro.
function linhasDaIntegracao(out) {
  return linhasDoErp(lerResposta(out));
}

// CRUDServiceProvider: o servico aplica numeracao, validacao fiscal e defaults.
// Exige status 1 E a chave devolvida; confiar so no HTTP diria "enviado" para o que nao entrou.
async function erpSalvar(entidade, campos, campoChave, chave) {
  const localFields = {};
  for (const k of Object.keys(campos)) {
    if (campos[k] !== null && campos[k] !== undefined && campos[k] !== '') localFields[k] = { $: String(campos[k]) };
  }
  const dataRow = { localFields };
  if (chave) { dataRow.key = {}; dataRow.key[campoChave.split(',')[0]] = { $: String(chave) }; }
  // Passa pela porta unica: com a gravacao desligada, para aqui sem sair para a rede.
  const r = await erpChamar('CRUDServiceProvider.saveRecord', {
    dataSet: { rootEntity: entidade, includePresentationFields: 'N', dataRow, entity: { fieldset: { list: campoChave } } },
  });
  const b = lerResposta(r);
  const ent = b.responseBody && b.responseBody.entities && b.responseBody.entities.entity;
  const principal = campoChave.split(',')[0];
  const valor = ent && ent[principal] && ent[principal].$;
  if (!valor && !chave) throw new Error('O ERP aceitou o pedido, mas nao devolveu a chave de ' + entidade + '.');
  return String(valor || chave);
}

// Valores que entram no SQL do ERP: so formato fechado, validado aqui.
function sqlTextoBusca(v) {
  const limpo = String(v == null ? '' : v).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 &.\-/]/g, ' ').replace(/-{2,}/g, '-').replace(/\s+/g, ' ').trim();
  return limpo.slice(0, 60);
}
function dataErp(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? m[3] + '/' + m[2] + '/' + m[1] : '';
}
const ehErroCredencial = (m) => /PREENCHER|401|403|n[aã]o autorizado|unauthor|invalid_client|Authentication failed/i.test(String(m || ''));

// Parceiro: CNPJ exato, nunca LIKE. Fornecedor tem preferencia; sobrando mais de um, o sistema para.
async function parceirosPorCnpj(cnpj) {
  const d = soDigitos(cnpj);
  if (d.length !== 11 && d.length !== 14) return [];
  return erpConsulta(
    "SELECT CODPARC, NOMEPARC, RAZAOSOCIAL, CGC_CPF, FORNECEDOR, CLIENTE, ATIVO FROM TGFPAR WHERE CGC_CPF = '" + d + "' AND ATIVO = 'S' ORDER BY CODPARC",
  );
}


const id = inteiro(event.lancamentoId);
const simular = event.simular === true || event.simular === 'S';
const codparcEscolhido = inteiro(event.codparc);
if (!id) return { ok: false, motivo: 'SEM_ID', mensagem: 'Informe o lançamento.' };

const log = (etapa, statusLog, mensagem) => chamar(SF.registrarLog, { lancamentoId: id, etapa, statusLog, mensagem: texto(mensagem, 1000) });
async function recusar(motivo, mensagem, extra) {
  if (!simular) await log('ENVIO_ERP', 'RECUSADO', mensagem);
  return Object.assign({ ok: false, motivo, mensagem }, extra || {});
}

const d = await uma(SF.erpDadosEnvio, { id });
if (!d) return { ok: false, motivo: 'NAO_ENCONTRADO', mensagem: 'Lançamento não encontrado, ou fora dos tipos que você enxerga.' };
const destino = d.DESTINO_ERP || d.DESTINO_PADRAO || 'FINANCEIRO';

// FASE 0. Com a gravacao desligada, o envio real para antes de qualquer reserva ou consulta.
// A conferencia (simular) segue igual: le o ERP e mostra o que seria enviado.
if (!simular && !GRAVACAO_ERP_HABILITADA) {
  return recusar('GRAVACAO_BLOQUEADA', 'Gravação no ERP desligada nesta fase: nada foi enviado ao Sankhya. Use "Conferir sem gravar" para ver o que seria enviado.');
}
// Nota de entrada. Conferir e somente leitura: compara a NF-e com os pedidos de compra. Criar a
// nota esta bloqueado (temporario, CRIACAO_NOTA_HABILITADA); o caminho previsto e faturar o pedido
// existente e salvar a nota NAO confirmada, com servico oficial homologado. Confirmar e sempre manual.
if (destino === 'NOTA') {
  if (simular) {
    try {
      const c = await chamar(SF.conferirNfePedidos, { lancamentoId: id });
      if (!c || !c.ok) return { ok: false, motivo: 'CONFERENCIA_FALHOU', destino, mensagem: (c && c.erro) || 'Não consegui conferir a nota com os pedidos.' };
      return { ok: true, simulado: true, destino, entidade: 'CorrespondenciaPedido', correspondencia: c.resultado, origemDocumento: c.origem, mensagem: c.resultado.resumo };
    } catch (e) {
      return { ok: false, motivo: 'CONFERENCIA_FALHOU', destino, mensagem: 'Não consegui conferir a nota com os pedidos: ' + msgErro(e) };
    }
  }
  if (!CRIACAO_NOTA_HABILITADA) {
    return recusar('CRIACAO_NOTA_BLOQUEADA', 'Criar nota no ERP está bloqueado até existir serviço oficial de faturamento de pedido homologado e autorização explícita. A conferência com os pedidos continua disponível, sem gravar.');
  }
  // Mesmo com as duas travas ligadas, nao ha caminho de gravacao de nota: o faturamento do pedido
  // ainda nao foi implementado, e a criacao avulsa (abaixo) nao e o caminho previsto.
  return recusar('FATURAMENTO_NAO_IMPLEMENTADO', 'O faturamento de pedido ainda não foi implementado nem homologado. Nada foi enviado ao Sankhya.');
}

// 1. Ja enviado: devolve a chave existente em vez de criar um segundo titulo.
const envios = d.ENVIOS_JSON ? (typeof d.ENVIOS_JSON === 'string' ? JSON.parse(d.ENVIOS_JSON) : d.ENVIOS_JSON) : [];
const jaOk = envios.find((e) => e.STATUS === 'OK');
if (jaOk) return { ok: true, jaEnviado: true, chave: jaOk.CHAVE_ERP, destino: jaOk.DESTINO, mensagem: 'Este lançamento já foi enviado (chave ' + jaOk.CHAVE_ERP + ').' };
const parcial = envios.find((e) => e.STATUS === 'PARCIAL');
if (parcial) return recusar('PARCIAL', 'A nota ' + parcial.CHAVE_ERP + ' entrou no ERP com itens faltando. Reenviar criaria uma segunda nota: a correção é dentro do Sankhya.');

// 2. Aguardando aprovacao: enviar antes contornaria a alcada.
if (d.STATUS === 'AGUARDANDO_APROVACAO') return recusar('AGUARDANDO_APROVACAO', 'O lançamento ainda aguarda aprovação.');
if (d.STATUS === 'REVISAO_LEITURA') return recusar('REVISAO_LEITURA', 'A leitura ainda precisa ser conferida por uma pessoa.');
if (d.STATUS !== 'APROVADO' && d.STATUS !== 'ERRO') return recusar('SITUACAO', 'Lançamento na situação ' + d.STATUS + ' não pode ser enviado.');

// 3. Classificacao completa: o que falta vira mensagem, nao erro de coluna nula do Oracle.
const faltando = [];
if (d.CODTIPOPER == null) faltando.push('TOP');
if (d.CODNAT == null) faltando.push('natureza');
if (d.CODCENCUS == null) faltando.push('centro de resultado');
if (destino === 'FINANCEIRO' && d.CODCTABCO == null) faltando.push('conta bancária');
if (destino === 'FINANCEIRO' && d.CODTIPTIT == null) faltando.push('tipo de título');
if (faltando.length) return recusar('SEM_CLASSIFICACAO', 'Falta ' + faltando.join(', ') + '. Cadastre em Configuração → Parâmetros ou corrija a classificação neste lançamento.');

// 4. TOP compativel com o tipo de documento.
if (d.TIPMOV_ESPERADO && d.TOP_TIPMOV && d.TOP_TIPMOV !== d.TIPMOV_ESPERADO) {
  return recusar('TOP_INCOMPATIVEL', 'A TOP ' + d.CODTIPOPER + ' é de movimento "' + (d.TOP_MOVIMENTO || d.TOP_TIPMOV) + '", mas ' + d.TIPO_DESC + ' espera o movimento "' + d.TIPMOV_ESPERADO + '".');
}
if (destino === 'NOTA' && d.TOP_TIPMOV !== 'C') {
  return recusar('TOP_INCOMPATIVEL', 'Nota de entrada exige TOP de compra; a TOP ' + d.CODTIPOPER + ' é de movimento "' + (d.TOP_MOVIMENTO || d.TOP_TIPMOV) + '".');
}

// 5. Parceiro: CNPJ exato; fornecedor primeiro; sobrando mais de um, o sistema para e pergunta.
const cnpj = soDigitos(d.CNPJ_FORNECEDOR);
let candidatos = [];
try {
  candidatos = await parceirosPorCnpj(cnpj);
} catch (e) {
  return recusar('ERP_INDISPONIVEL', 'Não consegui consultar o parceiro no ERP: ' + msgErro(e));
}
const fornecedores = candidatos.filter((p) => String(p.FORNECEDOR).toUpperCase() === 'S');
const elegiveis = fornecedores.length ? fornecedores : candidatos;
let codparc = 0;
let origemParceiro = '';
if (codparcEscolhido) {
  // Escolha vinda da tela e revalidada contra o CNPJ do documento antes de valer.
  if (!candidatos.some((p) => Number(p.CODPARC) === codparcEscolhido)) {
    return recusar('PARCEIRO_INVALIDO', 'O parceiro ' + codparcEscolhido + ' não tem o CNPJ deste documento.');
  }
  codparc = codparcEscolhido;
  origemParceiro = 'ESCOLHA';
} else if (Number(d.CODPARC) && candidatos.some((p) => Number(p.CODPARC) === Number(d.CODPARC))) {
  codparc = Number(d.CODPARC);
  origemParceiro = 'LANCAMENTO';
} else {
  const anterior = await uma(SF.parceiroJaEscolhidoParaCnpj, { cnpj });
  if (anterior && candidatos.some((p) => Number(p.CODPARC) === Number(anterior.CODPARC))) {
    codparc = Number(anterior.CODPARC);
    origemParceiro = 'ESCOLHA_ANTERIOR';
  } else if (elegiveis.length === 1) {
    codparc = Number(elegiveis[0].CODPARC);
    origemParceiro = 'UNICO';
  }
}
if (!codparc && !elegiveis.length) {
  return recusar('PARCEIRO_INEXISTENTE', cnpj ? 'Nenhum parceiro ativo no ERP com o CNPJ ' + cnpj + '.' : 'O lançamento não tem CNPJ de fornecedor; informe para localizar o parceiro.', { semParceiro: true });
}
if (!codparc) {
  return recusar('PARCEIRO_AMBIGUO', 'Há ' + elegiveis.length + ' parceiros ativos com este CNPJ. Escolha qual deles recebe o lançamento.', {
    escolhaParceiro: true,
    candidatos: elegiveis.map((p) => ({ codparc: p.CODPARC, nome: p.RAZAOSOCIAL || p.NOMEPARC, fornecedor: String(p.FORNECEDOR).toUpperCase() === 'S' })),
  });
}
const parceiro = candidatos.find((p) => Number(p.CODPARC) === codparc) || {};
if (codparcEscolhido) {
  await chamar(SF.corrigirDadosLancamentoParceiro, { id, codparc });
  await log('PARCEIRO', 'OK', 'Parceiro ' + codparc + ' escolhido por uma pessoa.');
}

// 6. Duplicidade dentro do proprio ERP: o mesmo papel escaneado de novo tem outro hash.
const numero = soDigitos(d.NUMERO_DOC).slice(0, 18);
if (numero) {
  const tabela = destino === 'NOTA' ? 'TGFCAB' : 'TGFFIN';
  const chaveCol = destino === 'NOTA' ? 'NUNOTA' : 'NUFIN';
  let achados;
  try {
    achados = await erpConsulta('SELECT ' + chaveCol + ' AS CHAVE FROM ' + tabela + ' WHERE CODEMP = ' + Number(d.CODEMP) + ' AND CODPARC = ' + codparc + ' AND NUMNOTA = ' + Number(numero));
  } catch (e) {
    // Sem resposta do ERP nao da para afirmar que esta livre.
    return recusar('ERP_INDISPONIVEL', 'Não consegui conferir duplicidade no ERP, então não enviei: ' + msgErro(e));
  }
  if (achados.length) {
    return recusar('DUPLICADO_ERP', 'O documento ' + numero + ' deste parceiro já existe no ERP (' + chaveCol + ' ' + achados.slice(0, 5).map((a) => a.CHAVE).join(', ') + ').');
  }
} else if (!simular) {
  await log('ENVIO_ERP', 'ATENCAO', 'Documento sem número: não há como conferir duplicidade no ERP.');
}

// 7. Nota sem produto entraria vazia e invalida.
let itens = [];
if (destino === 'NOTA') {
  itens = await listar(SF.listarItensLancamento, { lancamentoId: id });
  const padrao = inteiro(d.CODPROD_PADRAO);
  if (!itens.length && padrao) itens = [{ DESCRICAO: 'Conforme documento', QUANTIDADE: 1, VALOR_UNITARIO: d.VALOR_TOTAL, CODPROD: padrao }];
  if (!itens.length) return recusar('SEM_PRODUTO', 'A nota não tem itens e o parâmetro não define produto padrão.');
  itens = itens.map((i) => Object.assign({}, i, { CODPROD: inteiro(i.CODPROD) || padrao }));
  const semProduto = itens.filter((i) => !i.CODPROD);
  if (semProduto.length) return recusar('SEM_PRODUTO', semProduto.length + ' item(ns) sem produto do ERP, e o parâmetro não define produto padrão.');
}

const emissao = dataErp(d.DATA_EMISSAO) || dataErp(new Date().toISOString());
const vencimento = dataErp(d.DATA_VENCIMENTO) || emissao;
const historico = texto(d.TIPO_DESC + ' ' + (d.NUMERO_DOC || '') + ' - ' + (d.NOME_FORNECEDOR || ''), 255);
let versaoTop = '';
try {
  const vt = await erpConsulta("SELECT TO_CHAR(MAX(DHALTER), 'DD/MM/YYYY HH24:MI:SS') AS DH FROM TGFTOP WHERE CODTIPOPER = " + Number(d.CODTIPOPER));
  versaoTop = (vt[0] && vt[0].DH) || '';
} catch (_) { /* o servico preenche o padrao */ }

if (destino === 'FINANCEIRO') {
  const campos = {
    CODEMP: d.CODEMP, CODPARC: codparc, NUMNOTA: numero || 0, DTNEG: emissao, DTVENC: vencimento, VLRDESDOB: d.VALOR_TOTAL, RECDESP: -1,
    CODTIPOPER: d.CODTIPOPER, DHTIPOPER: versaoTop, CODNAT: d.CODNAT, CODCENCUS: d.CODCENCUS, CODTIPTIT: d.CODTIPTIT, CODCTABCOINT: d.CODCTABCO,
    PROVISAO: 'N', ORIGEM: 'F', DESDOBRAMENTO: '1', HISTORICO: historico,
  };
  if (simular) return { ok: true, simulado: true, destino, entidade: 'Financeiro', campos, parceiro: { codparc, origem: origemParceiro, nome: parceiro.RAZAOSOCIAL || parceiro.NOMEPARC } };
  if ((await afetou(SF.erpReservarEnvio, { id })) !== 1) return { ok: false, motivo: 'EM_ANDAMENTO', mensagem: 'Já existe um envio deste lançamento em andamento.' };
  try {
    const nufin = await erpSalvar('Financeiro', campos, 'NUFIN');
    await chamar(SF.erpRegistrarEnvio, { lancamentoId: id, destino, chave: nufin, numeroItens: 0, statusEnvio: 'OK', mensagem: 'Título gravado no ERP.' });
    await chamar(SF.erpConcluirEnvio, { id, status: 'LANCADO', nufin: inteiro(nufin), nunota: 0 });
    await log('ENVIO_ERP', 'OK', 'Título gravado no ERP: NUFIN ' + nufin + ' (parceiro ' + codparc + ').');
    return { ok: true, chave: nufin, destino, codparc };
  } catch (e) {
    const m = msgErro(e);
    if (ehBloqueioErp(e)) {
      // A trava parou antes da rede: o lancamento nao vira ERRO; a reserva expira em 5 minutos.
      await log('ENVIO_ERP', 'RECUSADO', m);
      return { ok: false, motivo: e.codigo, mensagem: m };
    }
    await chamar(SF.erpRegistrarEnvio, { lancamentoId: id, destino, chave: '', numeroItens: 0, statusEnvio: 'ERRO', mensagem: texto(m, 1000) });
    await chamar(SF.erpConcluirEnvio, { id, status: 'ERRO', nufin: 0, nunota: 0 });
    await log('ENVIO_ERP', 'ERRO', m);
    return { ok: false, motivo: 'RECUSA_ERP', mensagem: m };
  }
}

// Destino NOTA por criacao avulsa: cabecalho e itens. Inalcancavel desde a Fase 0 (o destino NOTA
// retorna no topo). Fica para referencia; o caminho previsto e o faturamento do pedido.
let codTipVenda = 0;
try {
  const tv = await erpConsulta('SELECT CODTIPVENDA FROM (SELECT CODTIPVENDA FROM TGFCAB WHERE CODTIPOPER = ' + Number(d.CODTIPOPER) + ' AND CODEMP = ' + Number(d.CODEMP) + ' ORDER BY DTNEG DESC) WHERE ROWNUM = 1');
  codTipVenda = inteiro(tv[0] && tv[0].CODTIPVENDA);
} catch (_) { /* fica o padrao do servico */ }
const cabecalho = {
  CODEMP: d.CODEMP, CODPARC: codparc, NUMNOTA: numero || 0, SERIENOTA: d.SERIE || '', DTNEG: emissao, DTVENC: vencimento, TIPMOV: 'C',
  CODTIPOPER: d.CODTIPOPER, DHTIPOPER: versaoTop, CODTIPVENDA: codTipVenda, CODNAT: d.CODNAT, CODCENCUS: d.CODCENCUS, VLRNOTA: d.VALOR_TOTAL, OBSERVACAO: historico,
};
const codigosProduto = [...new Set(itens.map((i) => inteiro(i.CODPROD)))];
let volumes = {};
try {
  const vol = await erpConsulta('SELECT CODPROD, CODVOL FROM TGFPRO WHERE CODPROD IN (' + codigosProduto.join(',') + ')');
  vol.forEach((v) => { volumes[v.CODPROD] = v.CODVOL; });
} catch (_) { /* o servico preenche o padrao */ }
const camposItem = (nunota, i) => ({
  NUNOTA: nunota, CODPROD: i.CODPROD, QTDNEG: i.QUANTIDADE, VLRUNIT: i.VALOR_UNITARIO, VLRTOT: Number(i.QUANTIDADE) * Number(i.VALOR_UNITARIO),
  CODVOL: volumes[i.CODPROD] || '', OBSERVACAO: texto(i.DESCRICAO, 200),
});
if (simular) return { ok: true, simulado: true, destino, entidade: 'CabecalhoNota', campos: cabecalho, itens: itens.map((i) => camposItem('(gerado)', i)), parceiro: { codparc, origem: origemParceiro, nome: parceiro.RAZAOSOCIAL || parceiro.NOMEPARC } };

if ((await afetou(SF.erpReservarEnvio, { id })) !== 1) return { ok: false, motivo: 'EM_ANDAMENTO', mensagem: 'Já existe um envio deste lançamento em andamento.' };
let nunota = '';
try {
  nunota = await erpSalvar('CabecalhoNota', cabecalho, 'NUNOTA');
} catch (e) {
  const m = msgErro(e);
  await chamar(SF.erpRegistrarEnvio, { lancamentoId: id, destino, chave: '', numeroItens: 0, statusEnvio: 'ERRO', mensagem: texto(m, 1000) });
  await chamar(SF.erpConcluirEnvio, { id, status: 'ERRO', nufin: 0, nunota: 0 });
  await log('ENVIO_ERP', 'ERRO', m);
  return { ok: false, motivo: 'RECUSA_ERP', mensagem: m };
}
let gravados = 0;
let erroItem = '';
for (const i of itens) {
  try {
    await erpSalvar('ItemNota', camposItem(nunota, i), 'NUNOTA,SEQUENCIA');
    gravados++;
  } catch (e) {
    erroItem = msgErro(e);
    break;
  }
}
if (erroItem) {
  // Sucesso parcial nao e sucesso: o lancamento nao vira LANCADO e nao pode ser reenviado.
  const m = 'Cabeçalho gravado (NUNOTA ' + nunota + '), mas ' + (itens.length - gravados) + ' item(ns) falharam: ' + erroItem;
  await chamar(SF.erpRegistrarEnvio, { lancamentoId: id, destino, chave: nunota, numeroItens: gravados, statusEnvio: 'PARCIAL', mensagem: texto(m, 1000) });
  await chamar(SF.erpConcluirEnvio, { id, status: 'ERRO', nufin: 0, nunota: inteiro(nunota) });
  await log('ENVIO_ERP', 'PARCIAL', m);
  return { ok: false, motivo: 'PARCIAL', mensagem: m, chave: nunota };
}
await chamar(SF.erpRegistrarEnvio, { lancamentoId: id, destino, chave: nunota, numeroItens: gravados, statusEnvio: 'OK', mensagem: 'Nota gravada no ERP com ' + gravados + ' item(ns).' });
await chamar(SF.erpConcluirEnvio, { id, status: 'LANCADO', nufin: 0, nunota: inteiro(nunota) });
await log('ENVIO_ERP', 'OK', 'Nota gravada no ERP: NUNOTA ' + nunota + ' com ' + gravados + ' item(ns), parceiro ' + codparc + '.');
return { ok: true, chave: nunota, destino, codparc, itens: gravados };
