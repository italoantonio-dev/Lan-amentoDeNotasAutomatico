// Etapa 19 - Recusa do ERP: conferir e corrigir o cadastro do parceiro.
import { sfJS, fim } from './lib/base.mjs';
await sfJS('conferirCadastroErp', ['sf/_comum.js', 'sf/_erp.js', 'sf/conferirCadastroErp.js'], 'Confere no ERP, requisito a requisito, se o cadastro do parceiro permite o lancamento. Parametro: lancamentoId (numero).');
await sfJS('corrigirCadastroErp', ['sf/_comum.js', 'sf/_erp.js', 'sf/corrigirCadastroErp.js'], 'Corrige o cadastro do parceiro no ERP (marcar fornecedor, criar parceiro). Desligada na Fase 0: recusa sempre com GRAVACAO_BLOQUEADA, sem alterar o Sankhya.');
fim('Diagnostico do ERP pronto.');
