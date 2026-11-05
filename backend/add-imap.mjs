// Caixa IMAP (frota@grupolidon.com.br). So adiciona: nao mexe em lancamento nem na conexao gmail.
import { consulta, dml, sfSQL, sfJS, sf, lerSF, montarJS, NONCE, sqlAdmin, fim } from './lib/base.mjs';

const ADMIN = await sqlAdmin();
const seeds = [
  ['IMAP_HOST', 'mail-ag-br1-15.proemail.cloud', 'Servidor da caixa. Fixo: a senha nao pode ser enviada a outro servidor pela tela'],
  ['IMAP_USUARIO', 'frota@grupolidon.com.br', 'Caixa lida pelo robo'],
  ['IMAP_PALAVRAS', 'boleto,fatura,duplicata,cobranca,titulo,pagamento,vencimento', 'Palavras no assunto ou no nome do anexo'],
  ['IMAP_SEGREDO_KEY', '', 'Key do arquivo privado com a senha'],
  ['IMAP_NOTAS_USUARIO', 'italo.antonio@grupolidon.com.br', 'Caixa de notas: XML de NF-e ou PDF com chave de NF-e'],
  ['IMAP_NOTAS_SEGREDO_KEY', '', 'Key do arquivo privado com a senha da caixa de notas'],
];
for (const [c, v, d] of seeds) {
  if (!(await consulta(`SELECT 1 AS X FROM ROBO_CONFIG WHERE CHAVE = '${c}'`)).length) {
    await dml(`INSERT INTO ROBO_CONFIG (CHAVE, VALOR, DESCRICAO) VALUES ('${c}', '${v}', '${d}')`);
  }
}
await dml(`UPDATE ROBO_CONFIG SET VALOR = 'imap' WHERE CHAVE = 'INTEGRACAO'`);

await sfSQL('roboLerConfig', `SELECT CHAVE, VALOR, DESCRICAO FROM ROBO_CONFIG WHERE CHAVE NOT IN ('IMAP_SEGREDO_KEY', 'IMAP_NOTAS_SEGREDO_KEY') AND ${NONCE}`, 'Ajustes do robo em vigor');
await sfSQL(
  'roboSalvarConfig',
  `UPDATE ROBO_CONFIG SET VALOR = '{{valor}}'
   WHERE CHAVE = '{{chave}}' AND CHAVE IN ('CORTE_CONFIANCA', 'GMAIL_QUERY', 'MAX_MENSAGENS', 'IMAP_PALAVRAS')
     AND (CHAVE <> 'CORTE_CONFIANCA' OR '{{valor}}' REGEXP '^(100|[0-9]{1,2})$')
     AND (CHAVE <> 'MAX_MENSAGENS' OR '{{valor}}' REGEXP '^([1-9]|[1-4][0-9]|50)$')
     AND (CHAVE NOT IN ('GMAIL_QUERY', 'IMAP_PALAVRAS') OR TRIM('{{valor}}') <> '')
     AND ${ADMIN} AND ${NONCE}`,
  'Grava um ajuste do robo (somente administrador, valor validado no proprio SQL)',
);
await sfSQL('roboImapSegredo', `SELECT VALOR FROM ROBO_CONFIG WHERE CHAVE = CASE '{{caixa}}' WHEN 'notas' THEN 'IMAP_NOTAS_SEGREDO_KEY' ELSE 'IMAP_SEGREDO_KEY' END AND VALOR <> '' AND ${ADMIN} AND ${NONCE}`, 'Key do arquivo com a senha da caixa (somente administrador). Interna: nao usar em agente.');
await sfSQL('roboImapGravarKey', `UPDATE ROBO_CONFIG SET VALOR = '{{key}}' WHERE CHAVE = CASE '{{caixa}}' WHEN 'notas' THEN 'IMAP_NOTAS_SEGREDO_KEY' ELSE 'IMAP_SEGREDO_KEY' END AND ${ADMIN} AND ${NONCE}`, 'Grava a key do arquivo da senha (somente administrador)');
await sfJS('roboImapGuardarSenha', ['sf/_comum.js', 'sf/roboImapGuardarSenha.js'], 'Registra o arquivo privado com a senha da caixa e apaga o anterior (somente administrador). Parametros: key, caixa (boletos ou notas).');

const MOTOR = `const leitura = (function () { ${lerSF('robo/leitura.cjs').replace('module.exports =', 'return')}\n })();`;
const COM_MOTOR = async (...a) => (await montarJS('sf/_comum.js', 'sf/_erp.js', 'sf/_lancamento.js', 'sf/_robo.js', 'sf/_imap.js', ...a)).replace('/*__MOTOR__*/', () => MOTOR);
await sf('roboTestarCaixa', 'JAVASCRIPT', await montarJS('sf/_comum.js', 'sf/_imap.js', 'sf/roboTestarCaixa.js'), 'Testa o acesso a caixa de e-mail e devolve o endereco e o total de mensagens.');
await sf('roboProcessarAnexo', 'JAVASCRIPT', await COM_MOTOR('sf/roboProcessarAnexo.js'), 'Entrega um documento ao robo pela tela (modo simulacao): mesmo motor, mesma decisao e mesma trilha, sem gravar no ERP. Parametros: nome, conteudoB64.');
await sf('roboVarrerEmails', 'JAVASCRIPT', await COM_MOTOR('sf/roboVarrerEmails.js'), 'Busca os documentos na caixa de e-mail e processa os anexos: le, classifica e confere sem gravar. Nunca grava no ERP nem confirma nota. So rode a pedido do usuario.');
fim('Caixa IMAP pronta.');
