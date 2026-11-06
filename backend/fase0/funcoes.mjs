// Fase 0: o codigo esperado de cada SF que alcanca o ERP, montado dos mesmos arquivos-fonte
// que os scripts add-*.mjs usam. aplicar.mjs publica isto; o smoke compara o publicado com isto.
import { montarJS, lerSF, NONCE, garantirPerfis } from '../lib/base.mjs';

const BASE = ['sf/_comum.js', 'sf/_erp.js'];
const MOTOR = `const leitura = (function () { ${lerSF('robo/leitura.cjs').replace('module.exports =', 'return')}\n })();`;
const COM_MOTOR = async (...arquivos) => (await montarJS('sf/_comum.js', 'sf/_erp.js', 'sf/_lancamento.js', 'sf/_robo.js', 'sf/_imap.js', ...arquivos)).replace('/*__MOTOR__*/', () => MOTOR);
// Conferencia com pedidos: leitor de NF-e e motor de correspondencia entram inteiros, como no robo.
const MOTOR_CORRESPONDENCIA = `const correspondencia = (function () { ${lerSF('correspondencia/motor.cjs').replace('module.exports =', 'return')}\n })();`;
const COM_CORRESPONDENCIA = async (...arquivos) => (await montarJS('sf/_comum.js', 'sf/_erp.js', 'sf/_correspondencia.js', ...arquivos))
  .replace('/*__MOTOR__*/', () => MOTOR).replace('/*__MOTOR_CORRESPONDENCIA__*/', () => MOTOR_CORRESPONDENCIA);

// nome -> arquivos (na ordem dos scripts de origem). description so onde a Fase 0 mudou o texto;
// nas demais, aplicar.mjs mantem a descricao publicada.
export const JS_COM_ERP = {
  // Nova nas Fases 1 e 2 (nao existe na copia de reversao). Vem primeiro: o envio a chama.
  conferirNfePedidos: {
    correspondencia: 'sf/conferirNfePedidos.js',
    nova: true,
    description: 'Confere uma NF-e com os pedidos de compra do piloto (TOP 1314 para 1419/1420). SOMENTE LEITURA: nao cria nota, nao altera pedido, nao gera provisao. Parametros: lancamentoId (numero) OU nome e conteudoB64 (XML da NF-e). Devolve candidatos, itens, quantidades negociada/entregue/pendente, precos, divergencias, vinculos, ambiguidade e duplicidade.',
  },
  enviarLancamentoParaErp: {
    arquivos: [...BASE, 'sf/enviarLancamentoParaErp.js'],
    description: 'Confere o lancamento contra o ERP pelas mesmas guardas do envio. Com simular=S devolve o que seria enviado, sem gravar; nota de entrada e conferida com os pedidos de compra. Gravacao no ERP desligada (Fase 0): sem simular recusa com GRAVACAO_BLOQUEADA. Criacao de nota bloqueada ate homologacao. Parametros: lancamentoId (numero); simular (S); opcional codparc.',
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
  lancarPedidoErp: { arquivos: [...BASE, 'sf/lancarPedidoErp.js'], nova: true, description: 'Lanca no Sankhya o pedido de compra da NF-e do lancamento, NAO confirmado, quando a rotina de pedido esta ligada na empresa. Recusa se ja houver pedido com saldo, produto ou unidade sem correspondencia, ou falta classificacao. Nao fatura e nao confirma. Parametro: lancamentoId (numero).' },
  gruposSankhya: { arquivos: [...BASE, 'sf/gruposSankhya.js'], nova: true, description: 'Grupos de usuarios do Sankhya com o numero de usuarios ativos e com e-mail. Somente leitura, somente administrador.' },
  sincronizarUsuariosSankhya: { arquivos: [...BASE, 'sf/sincronizarUsuariosSankhya.js'], nova: true, description: 'Liga os logins do modulo aos usuarios do Sankhya pelo e-mail e acrescenta o perfil do grupo, pelo mapa do administrador. Le o Sankhya sem gravar. Somente administrador; atribuir perfil exige desenvolvedor.' },
};

// Indicadores da Caixa de entrada: o robo deixou de lancar; conta o que ficou pronto para conferencia.
// podeConferirNfe: mesmo alcance por tipo das telas (secao 13.1), para o tipo NOTA_FISCAL.
const { Administrador: PERFIL_ADMIN_ENVIO, Aprovador: PERFIL_APROVADOR_ENVIO } = await garantirPerfis();
const PERFIS_ENVIO = `${Number(PERFIL_ADMIN_ENVIO)},${Number(PERFIL_APROVADOR_ENVIO)}`;
export const SQL_ALTERADAS = {
  podeEnviarErp: `SELECT CASE WHEN EXISTS (SELECT 1 FROM INT_PROFILEUSER PU WHERE PU.USERID = :VAR_USER AND FIND_IN_SET(PU.PROFILEID, '${PERFIS_ENVIO}')) THEN 1 ELSE 0 END AS PODE FROM DUAL WHERE ${NONCE}`,
  podeConferirNfe: `SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM PERMISSOES_USUARIO PU WHERE PU.USUARIO_ID = :VAR_USER AND PU.TODOS_OS_TIPOS = FALSE)
     OR EXISTS (SELECT 1 FROM PERMISSAO_TIPO_DOCUMENTO PT JOIN TIPOS_DOCUMENTO T ON T.ID = PT.TIPO_DOCUMENTO_ID WHERE PT.USUARIO_ID = :VAR_USER AND T.CODIGO = 'NOTA_FISCAL')
     THEN 1 ELSE 0 END AS PODE FROM DUAL WHERE ${NONCE}`,
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
  if (f.correspondencia) return COM_CORRESPONDENCIA(f.correspondencia);
  return f.motor ? COM_MOTOR(f.motor) : montarJS(...f.arquivos);
}
