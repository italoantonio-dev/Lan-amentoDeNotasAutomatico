// FASE 0: corrigir cadastro grava no ERP. Com a gravacao desligada, recusa antes de tudo,
// para qualquer usuario e qualquer acao. Ajuste de cadastro e feito dentro do Sankhya.
if (!GRAVACAO_ERP_HABILITADA) {
  return { ok: false, motivo: 'GRAVACAO_BLOQUEADA', erro: 'Correção de cadastro no ERP desligada nesta fase: nada foi alterado no Sankhya. Ajuste o cadastro diretamente no Sankhya e confira de novo.' };
}
const adm = await uma(SF.souAdministrador, {});
if (!adm || Number(adm.ADMIN) !== 1) return { ok: false, erro: 'Só o administrador corrige cadastro no ERP.' };
const id = inteiro(event.lancamentoId);
const acao = String(event.acao || '');
const d = await uma(SF.erpDadosEnvio, { id });
if (!d) return { ok: false, erro: 'Lançamento não encontrado.' };
const cnpj = soDigitos(d.CNPJ_FORNECEDOR);
const log = (m, st) => chamar(SF.registrarLog, { lancamentoId: id, etapa: 'CORRECAO_ERP', statusLog: st || 'OK', mensagem: texto(m, 1000) });

if (acao === 'MARCAR_FORNECEDOR' || acao === 'MARCAR_CLIENTE') {
  const codparc = inteiro(event.codparc);
  const candidatos = await parceirosPorCnpj(cnpj);
  // So altera parceiro que tem o CNPJ do documento: nunca um codigo vindo solto da tela.
  if (!candidatos.some((p) => Number(p.CODPARC) === codparc)) return { ok: false, erro: 'O parceiro informado não tem o CNPJ deste documento.' };
  const campo = acao === 'MARCAR_FORNECEDOR' ? 'FORNECEDOR' : 'CLIENTE';
  await erpSalvar('Parceiro', { [campo]: 'S' }, 'CODPARC', codparc);
  await log('Parceiro ' + codparc + ' marcado como ' + campo.toLowerCase() + ' no ERP.');
  return { ok: true };
}
if (acao === 'CRIAR_PARCEIRO') {
  const nome = texto(event.nome || d.NOME_FORNECEDOR, 60).trim();
  const codcid = inteiro(event.codcid);
  if (!nome) return { ok: false, erro: 'Informe o nome do parceiro.' };
  if (cnpj.length !== 14 && cnpj.length !== 11) return { ok: false, erro: 'O documento não tem CNPJ ou CPF válido.' };
  if (!codcid) return { ok: false, erro: 'Escolha a cidade do parceiro.' };
  const existentes = await parceirosPorCnpj(cnpj);
  if (existentes.length) return { ok: false, erro: 'Já existe parceiro ativo com este CNPJ (' + existentes[0].CODPARC + ').' };
  const novo = await erpSalvar('Parceiro', {
    NOMEPARC: nome, RAZAOSOCIAL: texto(event.razao || nome, 100), TIPPESSOA: cnpj.length === 14 ? 'J' : 'F', CGC_CPF: cnpj, CODCID: codcid, ATIVO: 'S', FORNECEDOR: 'S', CLIENTE: 'N',
  }, 'CODPARC');
  await log('Parceiro ' + novo + ' criado no ERP para o CNPJ ' + cnpj + '.');
  return { ok: true, codparc: novo };
}
return { ok: false, erro: 'Ação inválida.' };
