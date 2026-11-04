// Modo simulacao: o arquivo entregue pela tela passa pelo mesmo motor. Nada e gravado no ERP.
const nome = texto(event.nome, 300).trim();
const b64 = String(event.conteudoB64 || '');
if (!nome || !b64) return { ok: false, erro: 'Entregue um arquivo.' };
if (!/\.(xml|pdf)$/i.test(nome)) return { ok: false, erro: 'O robô lê arquivos XML e PDF.' };
const buffer = Buffer.from(b64, 'base64');
if (!buffer.length) return { ok: false, erro: 'Arquivo vazio.' };
if (buffer.length > 12 * 1024 * 1024) return { ok: false, erro: 'Arquivo acima de 12 MB.' };
const config = await configRobo();
const empresas = await listar(SF.roboEmpresas, {});
const tipos = await listar(SF.listarTiposDocumento, {});
const mensagemId = 'simulacao-' + Date.now() + '-' + Math.random().toString(16).slice(2, 10);
await chamar(SF.roboRegistrarEmail, { mensagemId, remetente: 'Entrega pela tela', assunto: nome, recebidoEm: new Date().toISOString().slice(0, 19), execucaoId: 0, anexos: 1, mensagem: 'Modo simulação' });
const email = await uma(SF.roboEmailPorMensagem, { mensagemId });
const r = await processarAnexo({ nome, buffer, emailId: email ? email.ID : 0, simulacao: true, config, empresas, tipos });
if (email) await chamar(SF.roboConcluirEmail, { id: email.ID });
return Object.assign({ ok: true }, r);
