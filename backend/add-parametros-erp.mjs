// Etapa 14 - Parametros orientados pelo ERP: o padrao vem do uso real, com a evidencia.
import { sfJS, fim } from './lib/base.mjs';
await sfJS('sankhyaPadroesLancamento', ['sf/_comum.js', 'sf/_erp.js', 'sf/sankhyaPadroesLancamento.js'], 'Ranking do que a empresa praticou no ERP nos ultimos 24 meses: TOPs, naturezas, centros, contas e tipos de titulo. Parametro: codemp (numero).');
fim('Parametros orientados pelo ERP prontos.');
