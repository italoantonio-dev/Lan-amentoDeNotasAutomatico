// Etapa 12 - Parceiros: busca no ERP com valor validado antes de entrar no SQL.
import { sfSQL, sfJS, NONCE, fim } from './lib/base.mjs';

await sfJS('sankhyaParceiros', ['sf/_comum.js', 'sf/_erp.js', 'sf/sankhyaParceiros.js'], 'Busca parceiros no ERP por nome, razao social ou CNPJ. Parametro: busca (texto). Devolve no maximo 20.');
await sfJS('sankhyaParceiroPorCnpj', ['sf/_comum.js', 'sf/_erp.js', 'sf/sankhyaParceiroPorCnpj.js'], 'Parceiros ativos com o CNPJ exato. Parametro: cnpj (so digitos).');
await sfJS('sankhyaParceiroPorCodigo', ['sf/_comum.js', 'sf/_erp.js', 'sf/sankhyaParceiroPorCodigo.js'], 'Le um parceiro pelo codigo. Parametro: codparc (numero).');
// So conta escolha feita por uma pessoa: LANCAMENTOS.CODPARC so e gravado a partir da tela.
await sfSQL(
  'parceiroJaEscolhidoParaCnpj',
  `SELECT CODPARC FROM LANCAMENTOS WHERE CNPJ_FORNECEDOR = '{{cnpj}}' AND CODPARC IS NOT NULL AND '{{cnpj}}' <> '' AND ${NONCE} ORDER BY ID DESC LIMIT 1`,
  'Parceiro que uma pessoa ja escolheu para este CNPJ',
);
fim('Parceiros prontos.');
