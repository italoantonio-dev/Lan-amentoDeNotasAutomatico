const id = inteiro(event.lancamentoId);
const acao = String(event.acao || '').toUpperCase();
const motivo = texto(event.motivo, 500).trim();
if (!id) return { ok: false, erro: 'Informe o lançamento.' };
if (acao !== 'APROVAR' && acao !== 'REJEITAR') return { ok: false, erro: 'Ação inválida: use APROVAR ou REJEITAR.' };
if (acao === 'REJEITAR' && !motivo) return { ok: false, erro: 'A rejeição exige um motivo.' };

const v = await uma(SF.verificarPermissaoAprovacao, { id });
if (!v) return { ok: false, erro: 'Lançamento não encontrado.' };
if (v.STATUS !== 'AGUARDANDO_APROVACAO') return { ok: false, erro: 'Este lançamento não está aguardando aprovação (situação atual: ' + v.STATUS + ').' };
if (Number(v.PODE_APROVAR) !== 1) return { ok: false, erro: 'O valor passa da sua alçada, ou você não está cadastrado como aprovador.' };

const n = await afetou(SF.gravarDecisaoAprovacao, { id, acao });
if (n !== 1) return { ok: false, erro: 'A decisão não foi aplicada: o lançamento mudou de situação ou passou da sua alçada.' };
await chamar(SF.registrarAprovacao, { lancamentoId: id, acao, motivo });
await chamar(SF.registrarLog, { lancamentoId: id, etapa: 'APROVACAO', statusLog: acao === 'APROVAR' ? 'OK' : 'REJEITADO', mensagem: acao === 'APROVAR' ? 'Lançamento aprovado.' : 'Lançamento rejeitado: ' + motivo });
return { ok: true, status: acao === 'APROVAR' ? 'APROVADO' : 'REJEITADO' };
