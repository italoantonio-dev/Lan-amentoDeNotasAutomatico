// Tradutor da recusa e conferencia de cadastro. So le o ERP: a correcao grava no ERP e nao roda aqui.
import { ex, conf, encerrar, cnpjFicticio, criarLancamentoTeste, limparLancamento } from './lib/smoke.mjs';
import { diagnosticar, limparMensagem } from '../frontend/src/lib/diagnosticoErp.ts';

const real = 'ORA-20101: O parceiro 71 deve ser um fornecedor na nota de Nro Unico:11346.\nORA-06512: em "SANKHYA.TRG_INC_TGFCAB", line 462\nORA-04088: erro durante a execucao do gatilho';
const d = diagnosticar(real);
conf('caso real vira causa em linguagem de negocio', d.codigo === 'NAO_FORNECEDOR' && d.corrigir === 'MARCAR_FORNECEDOR' && d.tentarDeNovo === true);
conf('linhas internas do gatilho saem da exibicao', !/ORA-06512|ORA-04088/.test(limparMensagem(real)) && /ORA-20101/.test(limparMensagem(real)));
conf('o que nao casa cai no generico', diagnosticar('mensagem nunca vista').codigo === 'GENERICO');
conf('registro duplicado avisa que tentar piora', diagnosticar('ORA-00001: unique constraint violated').tentarDeNovo === false);
conf('sem resposta avisa que tentar piora', diagnosticar('timeout ao chamar o ERP').tentarDeNovo === false);
conf('credencial nao vira erro de cadastro', diagnosticar('O ERP respondeu HTTP 401').codigo === 'CREDENCIAL');

const l = await criarLancamentoTeste({ cnpj: cnpjFicticio() });
try {
  const c = await ex('conferirCadastroErp', { lancamentoId: l.lancamentoId });
  conf('conferencia lista requisito a requisito', c.ok === true && c.requisitos.length === 3 && c.requisitos[0].pronto === false, c.requisitos?.[0]?.detalhe);
  const invalida = await ex('corrigirCadastroErp', { lancamentoId: l.lancamentoId, acao: 'MARCAR_FORNECEDOR', codparc: 1 });
  conf('correcao recusa parceiro que nao tem o CNPJ do documento', invalida.ok === false, invalida.erro);
} finally {
  await limparLancamento(l.lancamentoId);
}
encerrar('Diagnostico do ERP');
