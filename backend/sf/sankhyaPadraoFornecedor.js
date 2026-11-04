const codemp = inteiro(event.codemp);
const codparc = inteiro(event.codparc);
if (!codparc) return { ok: false, erro: 'Informe o parceiro.' };
return { ok: true, itens: await historicoErp(codemp, codparc) };
