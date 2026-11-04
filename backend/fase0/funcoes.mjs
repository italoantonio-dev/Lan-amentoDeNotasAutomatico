// Fase 0: o codigo esperado de cada SF que alcanca o ERP, montado dos mesmos arquivos-fonte
// que os scripts add-*.mjs usam. aplicar.mjs publica isto; o smoke compara o publicado com isto.
import { montarJS, lerSF, NONCE } from '../lib/base.mjs';

const BASE = ['sf/_comum.js', 'sf/_erp.js'];
const MOTOR = `const leitura = (function () { ${lerSF('robo/leitura.cjs').replace('module.exports =', 'return')}\n })();`;
const COM_MOTOR = async (...arquivos) => (await montarJS('sf/_comum.js', 'sf/_erp.js', 'sf/_lancamento.js', 'sf/_robo.js', ...arquivos)).replace('/*__MOTOR__*/', () => MOTOR);

// nome -> arquivos (na ordem dos scripts de origem). description so onde a Fase 0 mudou o texto;
// nas demais, aplicar.mjs mantem a descricao publicada.
export const JS_COM_ERP = {
  enviarLancamentoParaErp: {
    arquivos: [...BASE, 'sf/enviarLancamentoParaErp.js'],
    description: 'Confere o lancamento contra o ERP pelas mesmas guardas do envio. Com simular=S devolve o que seria enviado, sem gravar. Gravacao no ERP desligada (Fase 0): sem simular a funcao recusa com GRAVACAO_BLOQUEADA. Nota de entrada nunca e criada aqui. Parametros: lancamentoId (numero); simular (S); opcional codparc.',
  },
  corrigirCadastroErp: {
    arquivos: [...BASE, 'sf/corrigirCadastroErp.js'],
    description: 'Corrige o cadastro do parceiro no ERP (marcar fornecedor, criar parceiro). Desligada na Fase 0: recusa sempre com GRAVACAO_BLOQUEADA, sem alterar o Sankhya.',
  },
  roboProcessarAnexo: { motor: 'sf/roboProcessarAnexo.js' },
  roboVarrerEmails: {
    motor: 'sf/roboVarrerEmails.js',
    description: 'Busca as notas na caixa de e-mail e processa os anexos: le, classifica e confere sem gravar. Nunca grava no ERP nem confirma nota. So rode a pedido do usuario.',
  },
  conferirCadastroErp: { arquivos: [...BASE, 'sf/conferirCadastroErp.js'] },
  sankhyaParceiros: { arquivos: [...BASE, 'sf/sankhyaParceiros.js'] },
  sankhyaParceiroPorCnpj: { arquivos: [...BASE, 'sf/sankhyaParceiroPorCnpj.js'] },
  sankhyaParceiroPorCodigo: { arquivos: [...BASE, 'sf/sankhyaParceiroPorCodigo.js'] },
  sankhyaPadroesLancamento: { arquivos: [...BASE, 'sf/sankhyaPadroesLancamento.js'] },
  sankhyaPadraoFornecedor: { arquivos: [...BASE, 'sf/_lancamento.js', 'sf/sankhyaPadraoFornecedor.js'] },
  resolverClassificacaoLancamento: { arquivos: [...BASE, 'sf/_lancamento.js', 'sf/resolverClassificacaoLancamento.js'] },
  criarLancamentoViaChat: { arquivos: [...BASE, 'sf/_lancamento.js', 'sf/criarLancamentoViaChat.js'] },
  sincronizarCadastrosSankhya: { arquivos: [...BASE, 'sf/sincronizarCadastros.js'] },
  erpVerificarConexao: { arquivos: [...BASE, 'sf/erpVerificarConexao.js'] },
  sankhyaProdutos: { arquivos: [...BASE, 'sf/sankhyaProdutos.js'] },
  sankhyaCidades: { arquivos: [...BASE, 'sf/sankhyaCidades.js'] },
};

// Indicadores da Caixa de entrada: o robo deixou de lancar; conta o que ficou pronto para conferencia.
export const SQL_ALTERADAS = {
  roboKpis: `SELECT COUNT(*) AS LIDOS,
     COALESCE(SUM(A.DECISAO = 'LANCADO'), 0) AS LANCADOS,
     COALESCE(SUM(A.DECISAO = 'PRONTO'), 0) AS PRONTOS,
     COALESCE(SUM(A.DECISAO = 'APROVACAO'), 0) AS APROVACAO,
     COALESCE(SUM(A.DECISAO = 'REVISAO'), 0) AS REVISAO,
     COALESCE(ROUND(AVG(A.CONFIANCA)), 0) AS CONFIANCA_MEDIA,
     (SELECT MAX(X.FIM) FROM ROBO_EXECUCAO X) AS ULTIMA_BUSCA
   FROM ROBO_ANEXO A WHERE ${NONCE}`,
};

export async function codigoEsperado(nome) {
  const f = JS_COM_ERP[nome];
  if (!f) throw new Error(`SF fora da Fase 0: ${nome}`);
  return f.motor ? COM_MOTOR(f.motor) : montarJS(...f.arquivos);
}
