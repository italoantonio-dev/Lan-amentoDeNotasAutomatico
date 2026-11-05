// Parceiro ambiguo e duplicidade no ERP. Regra dura: este smoke nao grava nada no Sankhya.
// Todos os caminhos terminam na pergunta do parceiro, no bloqueio de duplicidade ou no pedido montado.
import { ex, uma, conf, encerrar, consulta, abrirIsolamento, tipo, sdk, projectId, criarLancamentoTeste, limparLancamento } from './lib/smoke.mjs';

const EP = '/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json';
async function erp(sql) {
  const r = await sdk.callIntegrationMitra({ projectId, connection: 'sankhya', method: 'POST', endpoint: EP, body: { serviceName: 'DbExplorerSP.executeQuery', requestBody: { sql } } });
  const c = r.body.responseBody.fieldsMetadata.map((f) => f.name);
  return r.body.responseBody.rows.map((l) => Object.fromEntries(c.map((x, i) => [x, l[i]])));
}

const iso = await abrirIsolamento();
const e = iso.empresa;
const t = await tipo('BOLETO');
const criados = [];
try {
  const top = (await consulta(`SELECT ID FROM TOPS WHERE TIPMOV = 'I' AND ATIVO = TRUE ORDER BY CODTIPOPER DESC LIMIT 1`))[0];
  const nat = (await consulta(`SELECT ID FROM NATUREZAS WHERE ATIVO = TRUE AND CODNAT <> '0' LIMIT 1`))[0];
  const cen = (await consulta(`SELECT ID FROM CENTROS_RESULTADO WHERE ATIVO = TRUE AND CODCENCUS <> '0' LIMIT 1`))[0];
  const cta = (await consulta(`SELECT ID FROM CONTAS_BANCARIAS WHERE ATIVO = TRUE LIMIT 1`))[0];
  const tit = (await consulta(`SELECT CODTIPTIT FROM TIPOS_TITULO WHERE ATIVO = TRUE AND CODTIPTIT > 0 LIMIT 1`))[0];
  await ex('salvarParametro', { empresaId: e.ID, tipoId: t.ID, topId: top.ID, naturezaId: nat.ID, centroId: cen.ID, contaId: cta.ID, limite: 100000000, destino: 'FINANCEIRO', codTipTit: tit.CODTIPTIT, codProdPadrao: 0 });

  // CNPJ exato: um CNPJ pela metade nao casa com ninguem.
  const repetidos = await erp(`SELECT CGC_CPF, COUNT(*) AS N FROM TGFPAR WHERE ATIVO = 'S' AND FORNECEDOR = 'S' AND LENGTH(CGC_CPF) = 14 AND CGC_CPF NOT LIKE '0000%' GROUP BY CGC_CPF HAVING COUNT(*) > 1 FETCH FIRST 1 ROWS ONLY`);
  const pelaMetade = await ex('sankhyaParceiroPorCnpj', { cnpj: '1234567' });
  conf('CNPJ incompleto nao devolve parceiro', pelaMetade.itens.length === 0);

  if (repetidos.length) {
    const l = await criarLancamentoTeste({ empresa: e, tipo: t, valor: 10, cnpj: repetidos[0].CGC_CPF, nome: 'Ambiguo' });
    criados.push(l.lancamentoId);
    const r = await ex('enviarLancamentoParaErp', { lancamentoId: l.lancamentoId, simular: 'S' });
    conf('mais de um fornecedor com o CNPJ: para e pergunta', r.ok === false && r.escolhaParceiro === true && r.candidatos.length > 1, `${r.candidatos?.length} candidatos`);
    const invalido = await ex('enviarLancamentoParaErp', { lancamentoId: l.lancamentoId, simular: 'S', codparc: 999999999 });
    conf('escolha e revalidada contra o CNPJ', invalido.ok === false && invalido.motivo === 'PARCEIRO_INVALIDO');
  } else {
    console.log('AVISO base sem CNPJ repetido entre fornecedores: ambiguidade nao exercitada.');
  }

  // Duplicidade contra o ERP: exige lancamento em empresa real (a checagem e por CODEMP), o que os
  // testes nao fazem mais. Coberta sem rede em _smoke-bloqueio-erp.mjs (B9), com o codigo publicado
  // identico ao testado (parte C).
  console.log('INFO duplicidade no ERP coberta em _smoke-bloqueio-erp.mjs (B9), sem lancamento em empresa real.');
} finally {
  for (const id of criados) await limparLancamento(id);
  await iso.fechar();
}
encerrar('Parceiro e duplicidade');
