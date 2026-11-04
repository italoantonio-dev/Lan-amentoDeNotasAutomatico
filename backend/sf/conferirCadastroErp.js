const id = inteiro(event.lancamentoId);
const d = await uma(SF.erpDadosEnvio, { id });
if (!d) return { ok: false, erro: 'Lançamento não encontrado.' };
const cnpj = soDigitos(d.CNPJ_FORNECEDOR);
const req = [];
const add = (rotulo, pronto, detalhe) => req.push({ rotulo, pronto, detalhe });
let candidatos = [];
try {
  candidatos = cnpj ? await parceirosPorCnpj(cnpj) : [];
} catch (e) {
  return { ok: false, erro: 'Não consegui consultar o ERP: ' + msgErro(e) };
}
add('Parceiro existe no ERP', candidatos.length > 0, candidatos.length ? candidatos.length + ' parceiro(s) ativo(s) com este CNPJ.' : 'Nenhum parceiro ativo com o CNPJ ' + (cnpj || '(vazio)') + '.');
const alvo = candidatos.find((p) => Number(p.CODPARC) === Number(d.CODPARC)) || (candidatos.length === 1 ? candidatos[0] : null);
const fornecedor = alvo ? String(alvo.FORNECEDOR).toUpperCase() === 'S' : candidatos.some((p) => String(p.FORNECEDOR).toUpperCase() === 'S');
add('Marcado como fornecedor', fornecedor, alvo ? (fornecedor ? 'O parceiro ' + alvo.CODPARC + ' é fornecedor.' : 'O parceiro ' + alvo.CODPARC + ' não está marcado como fornecedor.') : 'Mais de um candidato: escolha o parceiro antes.');
add('TOP de compra ou financeira compatível', Boolean(d.CODTIPOPER) && (!d.TIPMOV_ESPERADO || d.TOP_TIPMOV === d.TIPMOV_ESPERADO), d.CODTIPOPER ? 'TOP ' + d.CODTIPOPER + ' (movimento ' + (d.TOP_MOVIMENTO || d.TOP_TIPMOV) + ').' : 'Sem TOP.');
return { ok: true, requisitos: req, codparc: alvo ? alvo.CODPARC : null, tudoPronto: req.every((r) => r.pronto) };
