const id = inteiro(event.lancamentoId);
const acao = String(event.acao || '').toUpperCase();
const motivo = texto(event.motivo, 500).trim();
if (!id) return { ok: false, erro: 'Informe o lançamento.' };
if (acao !== 'APROVAR' && acao !== 'REJEITAR') return { ok: false, erro: 'Ação inválida: use APROVAR ou REJEITAR.' };
if (acao === 'REJEITAR' && !motivo) return { ok: false, erro: 'A rejeição exige um motivo.' };

const v = await uma(SF.verificarPermissaoAprovacao, { id });
if (!v) return { ok: false, erro: 'Lançamento não encontrado.' };
if (v.STATUS !== 'AGUARDANDO_APROVACAO') return { ok: false, erro: 'Este lançamento não está aguardando aprovação (situação atual: ' + v.STATUS + ').' };
// Fail-closed: so decide com OK explicito do servidor; qualquer outro motivo recusa.
const MOTIVOS = {
  SEM_APROVADOR_ATIVO: 'Não há aprovador ativo: nenhuma decisão pode ser tomada.',
  SEM_VINCULO: 'Você não está vinculado a um aprovador ativo (o e-mail do seu login não corresponde a nenhum).',
  SEM_PERFIL: 'Você não tem o perfil Aprovador.',
  FORA_DA_POLITICA: 'Esta empresa ou tipo de documento não está na política de aprovação liberada para você.',
  SEM_TETO: 'Seu teto de alçada não está definido.',
  ACIMA_DA_ALCADA: 'O valor passa da sua alçada.',
};
if (Number(v.PODE_APROVAR) !== 1 || v.MOTIVO !== 'OK') return { ok: false, motivo: v.MOTIVO || 'RECUSADO', erro: MOTIVOS[v.MOTIVO] || 'Decisão recusada.' };

const n = await afetou(SF.gravarDecisaoAprovacao, { id, acao });
if (n !== 1) return { ok: false, erro: 'A decisão não foi aplicada: o lançamento mudou de situação ou passou da sua alçada.' };
await chamar(SF.registrarAprovacao, { lancamentoId: id, acao, motivo });
await chamar(SF.registrarLog, { lancamentoId: id, etapa: 'APROVACAO', statusLog: acao === 'APROVAR' ? 'OK' : 'REJEITADO', mensagem: acao === 'APROVAR' ? 'Lançamento aprovado.' : 'Lançamento rejeitado: ' + motivo });
return { ok: true, status: acao === 'APROVAR' ? 'APROVADO' : 'REJEITADO' };
