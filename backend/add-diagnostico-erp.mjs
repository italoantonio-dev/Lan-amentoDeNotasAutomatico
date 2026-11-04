// Etapa 19 - Recusa do ERP: conferir e corrigir o cadastro do parceiro.
import { sfJS, fim } from './lib/base.mjs';
await sfJS('conferirCadastroErp', ['sf/_comum.js', 'sf/_erp.js', 'sf/conferirCadastroErp.js'], 'Confere no ERP, requisito a requisito, se o cadastro do parceiro permite o lancamento. Parametro: lancamentoId (numero).');
await sfJS('corrigirCadastroErp', ['sf/_comum.js', 'sf/_erp.js', 'sf/corrigirCadastroErp.js'], 'Corrige o cadastro do parceiro no ERP: marca como fornecedor ou cria o parceiro. Somente administrador; grava no ERP.');
fim('Diagnostico do ERP pronto.');
