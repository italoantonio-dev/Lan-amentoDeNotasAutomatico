// Etapa 8 - Perfis e agente de negocio. Rode depois dos demais scripts: grava a lista inteira
// de SFs e tabelas de cada perfil a partir do que existe.
import { sdk, projectId, garantirPerfis, carregarSFs, fim } from './lib/base.mjs';
import { INSTRUCOES_AGENTE } from './lib/instrucoes-agente.mjs';

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
  instructions: INSTRUCOES_AGENTE,
});
fim('Agente de negocio pronto.');
