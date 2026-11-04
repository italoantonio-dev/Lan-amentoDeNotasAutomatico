// Gravacao de titulo. Por padrao NAO grava: exercita todas as guardas ate a montagem do pedido (simular).
// Gravar de verdade no ERP e irreversivel e so roda com --gravar-de-verdade, contra uma base de homologacao.
import { ex, rows, uma, conf, encerrar, consulta, primeiraEmpresa, tipo, cnpjFicticio, criarLancamentoTeste, limparLancamento } from './lib/smoke.mjs';

const GRAVAR = process.argv.includes('--gravar-de-verdade');
const e = await primeiraEmpresa();
const t = await tipo('BOLETO');
const antes = await uma('parametroComEmpresa', { empresaId: e.ID, tipoId: t.ID });
const criados = [];
const entrada = (o) => ({ empresaId: e.ID, tipoId: t.ID, topId: 0, naturezaId: 0, centroId: 0, contaId: 0, limite: 0, destino: 'FINANCEIRO', codTipTit: 0, codProdPadrao: 0, ...o });
try {
  // Guarda: aguardando aprovacao
  const p = await criarLancamentoTeste({ valor: 10 });
  criados.push(p.lancamentoId);
  const r1 = await ex('enviarLancamentoParaErp', { lancamentoId: p.lancamentoId, simular: 'S' });
  conf('aguardando aprovacao nao envia', r1.ok === false && r1.motivo === 'AGUARDANDO_APROVACAO');
  // Guarda: sem classificacao
  await ex('aplicarDecisaoAprovacao', { lancamentoId: p.lancamentoId, acao: 'APROVAR', motivo: '' });
  const r2 = await ex('enviarLancamentoParaErp', { lancamentoId: p.lancamentoId, simular: 'S' });
  conf('sem classificacao diz o que falta', r2.ok === false && r2.motivo === 'SEM_CLASSIFICACAO' && /TOP/.test(r2.mensagem), r2.mensagem);

  const top = (await consulta(`SELECT ID, CODTIPOPER FROM TOPS WHERE TIPMOV = 'I' AND ATIVO = TRUE ORDER BY CODTIPOPER DESC LIMIT 1`))[0];
  const nat = (await consulta(`SELECT ID FROM NATUREZAS WHERE ATIVO = TRUE AND CODNAT <> '0' LIMIT 1`))[0];
  const cen = (await consulta(`SELECT ID FROM CENTROS_RESULTADO WHERE ATIVO = TRUE AND CODCENCUS <> '0' LIMIT 1`))[0];
  const cta = (await consulta(`SELECT ID FROM CONTAS_BANCARIAS WHERE ATIVO = TRUE LIMIT 1`))[0];
  const tit = (await consulta(`SELECT CODTIPTIT FROM TIPOS_TITULO WHERE ATIVO = TRUE AND CODTIPTIT > 0 LIMIT 1`))[0];
  await ex('salvarParametro', entrada({ topId: top.ID, naturezaId: nat.ID, centroId: cen.ID, contaId: cta.ID, limite: 1000000, codTipTit: tit.CODTIPTIT }));

  // Guarda: parceiro inexistente (CNPJ sintetico)
  const l = await criarLancamentoTeste({ valor: 50, cnpj: cnpjFicticio() });
  criados.push(l.lancamentoId);
  const r3 = await ex('enviarLancamentoParaErp', { lancamentoId: l.lancamentoId, simular: 'S' });
  conf('parceiro inexistente para antes de gravar', r3.ok === false && r3.motivo === 'PARCEIRO_INEXISTENTE' && r3.semParceiro === true, r3.mensagem);

  // Caminho feliz ate o pedido: fornecedor real, numero que nao existe.
  const unico = (await ex('sankhyaParceiros', { busca: 'BANCO DO BRASIL' })).itens.find((x) => x.CGC_CPF);
  if (!unico) {
    console.log('AVISO sem parceiro de referencia: caminho feliz nao exercitado.');
  } else {
    const n = await criarLancamentoTeste({ valor: 50, cnpj: unico.CGC_CPF, nome: unico.NOMEPARC, numeroDoc: `9${String(Date.now()).slice(-8)}` });
    criados.push(n.lancamentoId);
    const r4 = await ex('enviarLancamentoParaErp', { lancamentoId: n.lancamentoId, simular: 'S' });
    if (r4.escolhaParceiro) {
      conf('CNPJ com mais de um parceiro para e pergunta', r4.candidatos.length > 1, `${r4.candidatos.length} candidatos`);
    } else {
      conf('guardas passam e o pedido e montado', r4.ok === true && r4.simulado === true && r4.entidade === 'Financeiro', r4.mensagem ?? '');
      if (r4.ok) {
        conf('pedido tem os campos do titulo', ['CODEMP', 'CODPARC', 'DTNEG', 'DTVENC', 'VLRDESDOB', 'CODTIPOPER', 'CODNAT', 'CODCENCUS', 'CODTIPTIT', 'CODCTABCOINT'].every((c) => r4.campos[c] !== undefined && r4.campos[c] !== null && r4.campos[c] !== ''), JSON.stringify(r4.campos).slice(0, 160));
        conf('simular nao registrou envio', (await rows('listarEnviosLancamento', { lancamentoId: n.lancamentoId })).length === 0);
        conf('simular nao mudou a situacao', (await uma('obterLancamento', { id: n.lancamentoId })).STATUS === 'APROVADO');
      }
    }
  }
  if (GRAVAR) console.log('--gravar-de-verdade nao e executado por este smoke sem um lancamento montado para isso: use a tela.');
  else console.log('INFO gravacao real nao exercitada: o ERP conectado e de producao e gravar e irreversivel.');
} finally {
  for (const id of criados) await limparLancamento(id);
  const atual = await uma('parametroComEmpresa', { empresaId: e.ID, tipoId: t.ID });
  if (!antes && atual) await ex('excluirParametro', { id: atual.ID });
}
encerrar('Envio de titulo (simulado)');
