// Rotina de pedido: lanca no Sankhya o pedido de compra da NF-e do lancamento, NAO confirmado.
// O ADM da loja confirma e pede liberacao; a liberacao e do Sankhya. Nao fatura e nao confirma.
// Para sem gravar quando: rotina desligada na empresa, ja existe pedido com saldo para estes produtos,
// produto ou unidade nao batem com o Sankhya, ou falta classificacao.
const pode = await uma(SF.podeLancarPedido, {});
if (!pode || Number(pode.PODE) !== 1) return { ok: false, motivo: 'SEM_PERMISSAO', mensagem: 'Só Administrador, Operador Financeiro ou Aprovador lança pedido no ERP.' };
const id = inteiro(event.lancamentoId);
if (!id) return { ok: false, motivo: 'SEM_ID', mensagem: 'Informe o lançamento.' };
const log = (status, mensagem) => chamar(SF.registrarLog, { lancamentoId: id, etapa: 'PEDIDO_ERP', statusLog: status, mensagem: texto(mensagem, 1000) });
async function recusar(motivo, mensagem, extra) {
  await log('RECUSADO', mensagem);
  return Object.assign({ ok: false, motivo, mensagem }, extra || {});
}

const rot = await uma(SF.rotinaPedidoDoLancamento, { id });
if (!rot) return { ok: false, motivo: 'NAO_ENCONTRADO', mensagem: 'Lançamento não encontrado, ou fora dos tipos que você enxerga.' };
if (Number(rot.PEDIDO_NUNOTA) > 0) return { ok: true, jaLancado: true, nunota: Number(rot.PEDIDO_NUNOTA), mensagem: 'O pedido ' + rot.PEDIDO_NUNOTA + ' já foi lançado para esta nota.' };
if (Number(rot.PEDIDO_NUNOTA) === -1) return { ok: false, motivo: 'EM_ANDAMENTO', mensagem: 'O lançamento do pedido já foi iniciado. Se não aparecer, confira no Sankhya antes de liberar de novo.' };
if (rot.TIPO !== 'NOTA_FISCAL') return { ok: false, motivo: 'NAO_E_NOTA', mensagem: 'Só nota fiscal vira pedido.' };
if (!Number(rot.ATIVO) || !Number(rot.TOP_PEDIDO) || !Number(rot.CODTIPVENDA) || !Number(rot.CODLOCAL)) {
  return { ok: false, motivo: 'ROTINA_DESLIGADA', mensagem: 'A rotina de pedido não está ligada para esta empresa. Configure em Configurações → Rotina de pedidos.' };
}
const d = await uma(SF.erpDadosEnvio, { id });
if (!d) return { ok: false, motivo: 'NAO_ENCONTRADO', mensagem: 'Lançamento não encontrado.' };
if (d.STATUS === 'REVISAO_LEITURA') return recusar('REVISAO_LEITURA', 'A leitura ainda precisa ser conferida por uma pessoa.');
if (d.STATUS === 'REJEITADO') return recusar('SITUACAO', 'Lançamento rejeitado não vira pedido.');
const faltando = [];
if (d.CODNAT == null) faltando.push('natureza');
if (d.CODCENCUS == null) faltando.push('centro de resultado');
if (faltando.length) return recusar('SEM_CLASSIFICACAO', 'Falta ' + faltando.join(' e ') + ' no lançamento.');

// Itens e produtos: a mesma conferencia da tela (XML da nota, de-para TGFPAP e referencia do fornecedor).
let c;
try { c = await chamar(SF.conferirNfePedidos, { lancamentoId: id }); } catch (e) { return recusar('CONFERENCIA_FALHOU', 'Não consegui conferir a nota: ' + msgErro(e)); }
if (!c || !c.ok) return recusar('CONFERENCIA_FALHOU', (c && c.erro) || 'Não consegui conferir a nota.');
const r = c.resultado;
if (!/XML/.test(String(c.origem))) return recusar('SEM_XML', 'Sem o XML da NF-e não há itens para o pedido: lance pela tela do Sankhya.');
const itens = r.itens || [];
if (!itens.length) return recusar('SEM_ITENS', 'A nota não tem itens.');
const comPedido = itens.filter((i) => (i.pedidos || []).length);
if (comPedido.length) return recusar('PEDIDO_EXISTENTE', 'Já há pedido com saldo para ' + comPedido.length + ' item(ns) (pedido ' + [...new Set(comPedido.flatMap((i) => i.pedidos))].slice(0, 5).join(', ') + '). Fature esse pedido em vez de lançar outro.');
const semProduto = itens.filter((i) => i.identificacao.situacao !== 'IDENTIFICADO' || i.identificacao.codprods.length !== 1);
if (semProduto.length) return recusar('PRODUTO_NAO_IDENTIFICADO', semProduto.length + ' item(ns) sem produto único no Sankhya: ' + semProduto.slice(0, 5).map((i) => i.cProd + ' ' + i.xProd).join('; ') + '. Cadastre o código do fornecedor no produto (TGFPAP) ou lance pela tela do Sankhya.');

const codprods = [...new Set(itens.map((i) => Number(i.identificacao.codprods[0])))];
let produtos;
try { produtos = await erpConsulta('SELECT CODPROD, CODVOL, USOPROD, ATIVO FROM TGFPRO WHERE CODPROD IN (' + codprods.join(',') + ')'); } catch (e) { return recusar('ERP_INDISPONIVEL', 'Não consegui ler os produtos no ERP: ' + msgErro(e)); }
const prod = new Map(produtos.map((p) => [Number(p.CODPROD), p]));
const unidadeDiferente = itens.filter((i) => { const p = prod.get(Number(i.identificacao.codprods[0])); return !p || String(p.CODVOL).trim().toUpperCase() !== String(i.unidade || '').trim().toUpperCase(); });
if (unidadeDiferente.length) return recusar('UNIDADE_DIFERENTE', unidadeDiferente.length + ' item(ns) com unidade da nota diferente da unidade do produto no Sankhya: ' + unidadeDiferente.slice(0, 5).map((i) => i.xProd + ' (' + i.unidade + ' x ' + ((prod.get(Number(i.identificacao.codprods[0])) || {}).CODVOL || '?') + ')').join('; ') + '. A conversão precisa de uma pessoa.');
const inativos = produtos.filter((p) => String(p.ATIVO) !== 'S');
if (inativos.length) return recusar('PRODUTO_INATIVO', 'Produto inativo no Sankhya: ' + inativos.map((p) => p.CODPROD).join(', ') + '.');

// Parceiro: o do lancamento, se tiver o CNPJ da nota; senao o unico fornecedor ativo com esse CNPJ.
let candidatos;
try { candidatos = await parceirosPorCnpj(d.CNPJ_FORNECEDOR); } catch (e) { return recusar('ERP_INDISPONIVEL', 'Não consegui consultar o parceiro: ' + msgErro(e)); }
const fornecedores = candidatos.filter((p) => String(p.FORNECEDOR).toUpperCase() === 'S');
const elegiveis = fornecedores.length ? fornecedores : candidatos;
let codparc = 0;
if (Number(d.CODPARC) && candidatos.some((p) => Number(p.CODPARC) === Number(d.CODPARC))) codparc = Number(d.CODPARC);
else if (elegiveis.length === 1) codparc = Number(elegiveis[0].CODPARC);
if (!codparc) return recusar(elegiveis.length ? 'PARCEIRO_AMBIGUO' : 'PARCEIRO_INEXISTENTE', elegiveis.length ? 'Há mais de um parceiro com o CNPJ da nota: escolha o fornecedor no lançamento.' : 'Nenhum parceiro ativo no Sankhya com o CNPJ da nota.');

if ((await afetou(SF.reservarPedidoLancamento, { id })) !== 1) return { ok: false, motivo: 'EM_ANDAMENTO', mensagem: 'O pedido desta nota já foi lançado ou está sendo lançado.' };
const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
const cabecalho = {
  CODEMP: d.CODEMP, CODPARC: codparc, CODTIPOPER: Number(rot.TOP_PEDIDO), CODTIPVENDA: Number(rot.CODTIPVENDA), CODNAT: d.CODNAT, CODCENCUS: d.CODCENCUS,
  NUMNOTA: 0, DTNEG: hoje, OBSERVACAO: texto('Pedido da NF ' + (d.NUMERO_DOC || '') + ' lida pelo módulo (lançamento ' + id + '). Confirmar e pedir liberação no Sankhya.', 255),
};
const itensPedido = itens.map((i) => {
  const p = prod.get(Number(i.identificacao.codprods[0]));
  return { CODPROD: p.CODPROD, QTDNEG: i.quantidade, VLRUNIT: i.valorUnitario, CODVOL: p.CODVOL, CODLOCALORIG: Number(rot.CODLOCAL), USOPROD: p.USOPROD, PERCDESC: 0 };
});
try {
  const nunota = await erpIncluirPedido(cabecalho, itensPedido);
  await chamar(SF.concluirPedidoLancamento, { id, nunota: inteiro(nunota) });
  await log('OK', 'Pedido ' + nunota + ' lançado no Sankhya, sem confirmar (' + itensPedido.length + ' item(ns), parceiro ' + codparc + ', TOP ' + rot.TOP_PEDIDO + ').');
  return { ok: true, nunota: inteiro(nunota), itens: itensPedido.length, codparc, mensagem: 'Pedido ' + nunota + ' lançado no Sankhya, sem confirmar. O ADM da loja confirma e pede a liberação.' };
} catch (e) {
  const m = msgErro(e);
  if (ehBloqueioErp(e)) { await chamar(SF.concluirPedidoLancamento, { id, nunota: 0 }); return recusar(e.codigo, m); }
  // Resposta perdida nao prova que nada entrou: a reserva fica, e uma pessoa confere no Sankhya.
  await log('ERRO', 'Falha ao lançar o pedido: ' + m + ' Confira no Sankhya se o pedido entrou antes de tentar de novo.');
  return { ok: false, motivo: 'RECUSA_ERP', mensagem: 'O Sankhya não lançou o pedido: ' + m };
}
