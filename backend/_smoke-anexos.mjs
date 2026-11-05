// Anexos: fechamento do ciclo do documento na conversa.
import { ex, rows, uma, conf, encerrar, chave, b64, hash, abrirIsolamento, tipo, cnpjFicticio, limparLancamento, sdk, projectId, consulta } from './lib/smoke.mjs';

const k = chave();
await ex('chatCriarConversa', { chave: k, titulo: 'Anexos Smoke', modelo: '' });
const c = await uma('chatObterConversa', { chave: k, id: 0 });
const iso = await abrirIsolamento();
const e = iso.empresa;
const t = await tipo('BOLETO');
const criados = [];
try {
  const ka = chave();
  const h = hash();
  await ex('chatSalvarAnexo', { chave: ka, conversaId: c.ID, nome: 'nota.pdf', tipoArquivo: 'application/pdf', tamanho: 10, arquivoKey: '', hash: h, texto: b64('texto bruto da nota'), campos: b64('{"valorTotal":{"valor":"10","confianca":"ALTA"}}'), status: 'LIDO', lancamentoId: 0 });
  const a = await uma('chatObterAnexoPorChave', { chave: ka });
  conf('grava e relê pela chave', Boolean(a?.ID));
  const lista = await rows('chatListarAnexos', { conversaId: c.ID });
  conf('lista nao devolve o texto bruto', lista.length === 1 && lista[0].TEXTO_EXTRAIDO === undefined);
  conf('detalhe guarda a prova do que foi lido', (await uma('chatObterAnexo', { id: a.ID })).TEXTO_EXTRAIDO === 'texto bruto da nota');

  const dados = { origem: 'CHAT', anexoId: a.ID, empresaId: e.ID, tipoId: t.ID, cnpj: cnpjFicticio(), nome: 'Fornecedor Anexo', numeroDoc: '123', valorTotal: 10, dataEmissao: '2026-01-10', dataVencimento: '2026-02-10' };
  const r = await ex('criarLancamentoViaChat', dados);
  criados.push(r.lancamentoId);
  conf('lanca com o anexo', r.ok === true, r.erro ?? '');
  const depois = await uma('chatObterAnexo', { id: a.ID });
  conf('anexo vira LANCADO e aponta o lancamento', depois.STATUS === 'LANCADO' && Number(depois.LANCAMENTO_ID) === r.lancamentoId);
  const de2 = await ex('criarLancamentoViaChat', dados);
  conf('segunda tentativa e recusada citando o numero, sem registro novo', de2.ok === false && de2.duplicado === true && Number(de2.lancamentoId) === r.lancamentoId, de2.erro);
  conf('hash do anexo vale na duplicidade', (await rows('verificarDuplicidadeDocumento', { hash: h })).length === 1);

  // Arquivo privado: a tela pede o link pelo registro, e a prova tem de sair da Server Function.
  const up = await sdk.uploadFilePrivateMitra({ projectId, file: new File([Buffer.from('%PDF-1.4 smoke')], 'smoke-link.pdf', { type: 'application/pdf' }) });
  const key = up.result.key;
  const comArquivo = await ex('criarLancamentoViaChat', { origem: 'TELA', empresaId: e.ID, tipoId: t.ID, hash: hash(), arquivoNome: 'smoke-link.pdf', arquivoKey: key, cnpj: cnpjFicticio(), nome: 'Link', numeroDoc: '1', valorTotal: 1 });
  criados.push(comArquivo.lancamentoId);
  const link = await ex('obterLinkArquivo', { origem: 'DOCUMENTO', id: comArquivo.documentoId });
  conf('link do arquivo sai pelo registro', link.ok === true && /^https?:/.test(link.url));
  const prova = (await consulta(`SELECT ACCESS_CONTEXT, SF_EXECUTION_ID FROM INT_FILEACCESSLOG WHERE FILE_KEY = '${key}' AND ACTION = 'LINK' ORDER BY ID DESC LIMIT 1`))[0];
  conf('prova: o link saiu de uma Server Function', prova?.ACCESS_CONTEXT === 'SERVER_FUNCTION' && Boolean(prova?.SF_EXECUTION_ID), JSON.stringify(prova));
  const chaveSolta = await ex('criarLancamentoViaChat', { origem: 'TELA', empresaId: e.ID, tipoId: t.ID, hash: hash(), arquivoNome: 'x.pdf', arquivoKey: 'https://exemplo.com/x.pdf', cnpj: cnpjFicticio(), nome: 'x', numeroDoc: '2', valorTotal: 1 });
  criados.push(chaveSolta.lancamentoId);
  conf('so aceita key de arquivo privado', (await ex('obterLinkArquivo', { origem: 'DOCUMENTO', id: chaveSolta.documentoId })).ok === false);
  conf('outro tipo de origem e recusado', (await ex('obterLinkArquivo', { origem: 'QUALQUER', id: 1 })).ok === false);
  await sdk.deleteFileMitra({ projectId, key }).catch(() => {});
} finally {
  for (const id of criados) await limparLancamento(id);
  await ex('chatExcluirAnexos', { id: c.ID });
  await ex('chatExcluirMensagensConversa', { id: c.ID });
  await ex('chatExcluirConversa', { id: c.ID });
  await iso.fechar();
}
encerrar('Anexos');
