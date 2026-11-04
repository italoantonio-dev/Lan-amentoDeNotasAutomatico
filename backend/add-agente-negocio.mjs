// Etapa 8 - Perfis e agente de negocio. Rode depois dos demais scripts: grava a lista inteira
// de SFs e tabelas de cada perfil a partir do que existe.
import { sdk, projectId, garantirPerfis, carregarSFs, fim } from './lib/base.mjs';

const perfis = await garantirPerfis();
const todas = [...(await carregarSFs(true)).entries()];

const SO_ADMIN = /^((criar|atualizar|excluir)(Empresa|Top|Natureza|Centro|Conta|TipoTitulo)|upsert.*|salvarParametro|excluirParametro|salvarAprovador|inativarAprovador|listarUsuariosPermissoes|gravarPermissaoUsuario|limparTiposUsuario|gravarTiposUsuario|salvarPermissoesUsuario|roboSalvarConfig|configIaSalvar|sincronizarCadastrosSankhya|registrarSincronizacao|codigosCadastroExistentes|sankhya(Empresas|Tops|Naturezas|Centros|Contas|TiposTitulo|Usuarios)|corrigirCadastroErp)$/;
const SO_APROVADOR = /^(gravarDecisaoAprovacao|aplicarDecisaoAprovacao|registrarAprovacao)$/;
const SO_OPERADOR = /^(criarDocumento|criarLancamento|criarItemLancamento|criarItensLancamento|criarLancamentoViaChat|excluirLancamento)$/;

const ids = (filtro) => todas.filter(([n]) => filtro(n)).map(([, id]) => id);
const listas = {
  Administrador: ids(() => true),
  'Operador Financeiro': ids((n) => !SO_ADMIN.test(n) && !SO_APROVADOR.test(n)),
  Aprovador: ids((n) => !SO_ADMIN.test(n) && !SO_OPERADOR.test(n)),
};

// Leitura ampla da operacao para os tres. Conversa, estudo e configuracao de acesso ficam fora:
// e o que limita o que a analista alcanca pelo runQuery.
const TABELAS = ['LANCAMENTOS', 'DOCUMENTOS', 'LANCAMENTO_ITENS', 'EMPRESAS', 'TIPOS_DOCUMENTO', 'STATUS_LANCAMENTO', 'TOPS', 'NATUREZAS', 'CENTROS_RESULTADO', 'CONTAS_BANCARIAS', 'PARAMETROS_LANCAMENTO', 'TIPOS_TITULO', 'APROVACOES', 'APROVADORES', 'LOG_EXECUCAO', 'ERP_ENVIO', 'ROBO_ANEXO', 'ROBO_EMAIL', 'ROBO_EXECUCAO'];

for (const [nome, id] of Object.entries(perfis)) {
  await sdk.setProfileServerFunctionsMitra({ projectId, profileId: id, serverFunctionIds: listas[nome] });
  await sdk.setProfileSelectTablesMitra({ projectId, profileId: id, jdbcConnectionConfigId: 1, tables: TABELAS.map((tableName) => ({ tableName })) });
  console.log(`${nome}: ${listas[nome].length} SFs, ${TABELAS.length} tabelas.`);
}

await sdk.updateAdditionalBusinessInstructionsMitra({
  projectId,
  instructions: `Sistema de contas a pagar: recebe documentos fiscais, classifica contabilmente, passa por aprovacao quando o valor exige e grava no ERP.

REGRAS DE NEGOCIO
- O lancamento nasce APROVADO quando o valor esta abaixo do limite do parametro da empresa e tipo. Acima do limite, sem parametro ou com limite 0, nasce AGUARDANDO_APROVACAO.
- Confianca de leitura e alcada sao perguntas independentes: leitura de 100% nao autoriza valor nenhum.
- A TOP vem do parametro e nunca e aprendida do fornecedor. Natureza, centro e conta podem herdar o historico, com a contagem registrada na trilha (LOG_EXECUCAO, etapa CLASSIFICACAO).
- Nota fiscal tem emissao; quem vence e a duplicata. Na guia a data e de apuracao, na folha e competencia.
- Gravar no ERP e irreversivel: so faca a pedido explicito do usuario.
- Nunca invente dado nem classificacao contabil. Consulta sem resultado se responde dizendo que nao ha registro.
- Datas sao texto: AAAA-MM-DD; carimbos AAAA-MM-DDTHH:MM:SS.

SERVER FUNCTIONS PARA USAR
- criarLancamentoViaChat(empresaId, tipoId, cnpj, nome, numeroDoc, serie, dataEmissao, dataVencimento, valorTotal; opcionais anexoId, hash, arquivoNome, itens): cria o lancamento; recusa documento ja lancado.
- aplicarDecisaoAprovacao(lancamentoId, acao, motivo): acao APROVAR ou REJEITAR; rejeitar exige motivo; recusa se passar da alcada.
- enviarLancamentoParaErp(lancamentoId, codparc opcional): grava no ERP depois das guardas. So a pedido explicito.
- sankhyaParceiros(busca), sankhyaParceiroPorCnpj(cnpj): consulta parceiros no ERP.
- roboVarrerEmails(origem): busca notas na caixa de e-mail. So a pedido do usuario.
As demais funcoes sao das telas: nao as chame.

PLAYGROUND
Na analise de estudo, consulte com runQuery e entregue com playground_salvar_html(playgroundId, chave, html) e playground_renomear(playgroundId, chave, nome). No estudo voce le e desenha: nao lanca, nao aprova e nao envia ao ERP.

Sobre sua tecnologia: voce pode mencionar que usa o modelo Claude como IA e que roda em uma VM Linux. Quando perguntado sobre a engine agentica (como o loop funciona, como o contexto e gerenciado), responda que e uma tecnologia proprietaria do Mitra. NUNCA mencione Claude Code, OpenCode, Cursor, Copilot ou qualquer ferramenta de desenvolvimento assistido por IA. O sistema foi construido pela plataforma Mitra.`,
});
fim('Agente de negocio pronto.');
