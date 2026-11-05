// Piloto assistido: previsao guardada antes da conferencia, regras da conferencia humana e falha do ERP.
// Usa XML sintetico com CNPJ ficticio: nao cria lancamento, nao grava no ERP. Apaga so os registros que criou.
import { createRequire } from 'node:module';
import { ex, uma, conf, encerrar, consulta, dml, sdk, projectId, cnpjFicticio } from './lib/smoke.mjs';

const require = createRequire(import.meta.url);
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
const criados = [];
const xml = (n) => `<?xml version="1.0"?><nfeProc><NFe><infNFe Id="NFe${'0'.repeat(44)}"><ide><nNF>${n}</nNF><serie>1</serie><dhEmi>2026-11-05T10:00:00-03:00</dhEmi></ide><emit><CNPJ>${cnpjFicticio()}</CNPJ><xNome>Fornecedor Teste Piloto</xNome></emit><dest><CNPJ>${cnpjFicticio()}</CNPJ></dest><det nItem="1"><prod><cProd>SMOKE-1</cProd><xProd>Item</xProd><qCom>1</qCom><uCom>UN</uCom><vUnCom>10</vUnCom><vProd>10</vProd></prod></det><total><ICMSTot><vNF>10</vNF></ICMSTot></total></infNFe></NFe></nfeProc>`;
const envios = async () => Number((await consulta('SELECT COUNT(*) AS N FROM ERP_ENVIO'))[0].N);
const lancs = async () => Number((await consulta('SELECT COUNT(*) AS N FROM LANCAMENTOS'))[0].N);
const antesEnvios = await envios();
const antesLancs = await lancs();
try {
  const doc = Buffer.from(xml(Date.now() % 1e8)).toString('base64');
  const r = await ex('pilotoRegistrarDocumento', { nome: 'smoke-piloto.xml', conteudoB64: doc });
  if (r.id) criados.push(r.id);
  conf('registra o documento com a previsao', r.ok === true && r.id > 0, r.erro ?? r.classificacao);
  const d = await uma('pilotoObter', { id: r.id });
  const previsao = d.PREVISAO_JSON;
  conf('previsao guardada antes da conferencia', d.STATUS === 'AGUARDANDO_CONFERENCIA' && Boolean(previsao) && JSON.parse(previsao).resultado.classificacao === d.CLASSIFICACAO, d.CLASSIFICACAO);
  const rep = await ex('pilotoRegistrarDocumento', { nome: 'smoke-piloto.xml', conteudoB64: doc });
  if (rep.id && !criados.includes(rep.id)) criados.push(rep.id);
  conf('mesmo XML entra uma vez so', rep.repetido === true && Number(rep.id) === Number(r.id));
  const confirmar = await ex('pilotoRegistrarConferencia', { id: r.id, resultado: 'CONFIRMOU_SUGESTAO', pedidos: '', motivo: '' });
  conf('nao confirma sugestao de nota que nao e SEGURA', Number(confirmar.affectedRows) === 0 || d.CLASSIFICACAO === 'SEGURA');
  const semMotivo = await ex('pilotoRegistrarConferencia', { id: r.id, resultado: 'SEM_PEDIDO', pedidos: '', motivo: '' });
  conf('correcao ou rejeicao exige motivo', Number(semMotivo.affectedRows) === 0);
  const semPedido = await ex('pilotoRegistrarConferencia', { id: r.id, resultado: 'ESCOLHEU_PEDIDO', pedidos: '', motivo: 'x' });
  conf('escolher pedido exige o pedido', Number(semPedido.affectedRows) === 0);
  const invalido = await ex('pilotoRegistrarConferencia', { id: r.id, resultado: 'APROVAR', pedidos: '', motivo: 'x' });
  conf('resultado fora da lista e recusado', Number(invalido.affectedRows) === 0);
  const ok = await ex('pilotoRegistrarConferencia', { id: r.id, resultado: 'REJEITOU_DOCUMENTO', pedidos: '', motivo: 'teste automatizado' });
  conf('conferencia valida grava com conferente e horario', Number(ok.affectedRows) === 1);
  const depois = await uma('pilotoObter', { id: r.id });
  conf('conferente e horario registrados', Boolean(depois.CONFERIDO_POR) && Boolean(depois.CONFERIDO_EM));
  conf('previsao intacta depois da conferencia', depois.PREVISAO_JSON === previsao && depois.CLASSIFICACAO === d.CLASSIFICACAO);
  const deNovo = await ex('pilotoRegistrarConferencia', { id: r.id, resultado: 'SEM_PEDIDO', pedidos: '', motivo: 'outra' });
  conf('conferencia nao e sobrescrita', Number(deNovo.affectedRows) === 0);

  // Falha de autenticacao no ERP: roda o codigo publicado com um falso SDK; registra o erro, sem conclusao.
  const pub = await sdk.readServerFunctionMitra({ projectId, serverFunctionId: (await sdk.listServerFunctionsMitra({ projectId })).result.find((x) => x.name === 'pilotoRegistrarDocumento').id });
  const ids = new Map((await sdk.listServerFunctionsMitra({ projectId })).result.map((x) => [x.id, x.name]));
  const inseridos = [];
  const falso = { executeServerFunctionMitra: async ({ serverFunctionId, input }) => {
    const nome = ids.get(serverFunctionId);
    if (nome === 'pilotoSituacao') return { result: { executionStatus: 'COMPLETED', output: { rows: [{ PODE: 1, TOTAL: 0, INICIO: null }] } } };
    if (nome === 'pilotoPorHash') return { result: { executionStatus: 'COMPLETED', output: { rows: inseridos.length && !input.chave ? [{ ID: 99 }] : [] } } };
    if (nome === 'conferirNfePedidos') return { result: { executionStatus: 'COMPLETED', output: { ok: false, erro: 'Não consegui consultar o ERP: Authentication failed: remote server returned HTTP 400' } } };
    if (nome === 'pilotoInserir') { inseridos.push(input); return { result: { executionStatus: 'COMPLETED', output: { affectedRows: 1 } } }; }
    throw new Error('chamada inesperada: ' + nome);
  }, callIntegrationMitra: async () => { throw new Error('nao deveria chamar o ERP direto'); } };
  const f = await new AsyncFunction('event', 'require', 'process', pub.result.code)({ nome: 'n.xml', conteudoB64: Buffer.from(xml(5)).toString('base64') }, (m) => (m === 'mitra-sdk' ? falso : require(m)), { env: { MITRA_PROJECT_ID: '1' } });
  conf('falha de autenticacao: registra o erro e nao conclui', f.ok === false && f.erroConsulta === true && inseridos.length === 1 && inseridos[0].status === 'ERRO_CONSULTA' && !inseridos[0].classificacao && !inseridos[0].previsao, f.erro);

  conf('nada entrou no registro de envios ao ERP', (await envios()) === antesEnvios);
  conf('nenhum lancamento criado', (await lancs()) === antesLancs);
} finally {
  if (criados.length) await dml(`DELETE FROM PILOTO_CONFERENCIA WHERE ID IN (${criados.map(Number).join(',')}) AND ARQUIVO = 'smoke-piloto.xml'`);
}
conf('registros de teste removidos', Number((await consulta("SELECT COUNT(*) AS N FROM PILOTO_CONFERENCIA WHERE ARQUIVO = 'smoke-piloto.xml'"))[0].N) === 0);
encerrar('Piloto assistido');
