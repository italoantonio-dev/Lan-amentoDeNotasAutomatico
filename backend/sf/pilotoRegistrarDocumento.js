// Piloto assistido (somente leitura no ERP). Recebe o XML, roda a conferencia e GUARDA A PREVISAO do
// motor antes de qualquer intervencao humana. Nao cria lancamento, nao grava no ERP.
const LIMITE_DOCUMENTOS = 20;
const LIMITE_DIAS_UTEIS = 5;
const nome = texto(event.nome || 'nota.xml', 200);
const b64 = String(event.conteudoB64 || '');
if (!b64) return { ok: false, erro: 'Envie o XML da NF-e.' };
if (b64.length > 4 * 1024 * 1024) return { ok: false, erro: 'Arquivo grande demais (limite de 3 MB).' };

const sit = await uma(SF.pilotoSituacao, {});
if (!sit || Number(sit.PODE) !== 1) return { ok: false, erro: 'O piloto é restrito ao perfil Administrador.' };
// Dias uteis desde o primeiro documento (segunda a sexta; feriados nao descontados).
const uteis = (de) => { let n = 0; const d = new Date(de + 'T00:00:00Z'); const hoje = new Date(); while (d <= hoje) { const w = d.getUTCDay(); if (w > 0 && w < 6) n++; d.setUTCDate(d.getUTCDate() + 1); } return n; };
if (Number(sit.TOTAL) >= LIMITE_DOCUMENTOS) return { ok: false, erro: 'O piloto já tem ' + LIMITE_DOCUMENTOS + ' documentos: encerrado.' };
if (sit.INICIO && uteis(String(sit.INICIO).slice(0, 10)) > LIMITE_DIAS_UTEIS) return { ok: false, erro: 'O piloto passou de ' + LIMITE_DIAS_UTEIS + ' dias úteis: encerrado.' };

const lido = leitura.lerDocumento(nome, Buffer.from(b64, 'base64'));
if (lido.formato !== 'XML') return { ok: false, erro: 'O piloto precisa do XML da NF-e.' };
const chave = /^\d{44}$/.test(String(lido.chave || '')) ? lido.chave : '';
const hash = leitura.hashConteudo(Buffer.from(b64, 'base64'));
const ja = await uma(SF.pilotoPorHash, { hash, chave });
if (ja) return { ok: true, id: ja.ID, repetido: true, mensagem: 'Este documento já está no piloto (registro ' + ja.ID + ').' };

let conf;
try {
  conf = await chamar(SF.conferirNfePedidos, { nome, conteudoB64: b64 });
} catch (e) {
  conf = { ok: false, erro: msgErro(e) };
}
const base = { hash, chave, numero: texto(lido.numero, 20), serie: texto(lido.serie, 5), emissao: texto(lido.dataEmissao, 10), cnpjEmitente: soDigitos(lido.cnpjEmitente).slice(0, 14), nomeEmitente: texto(lido.nomeEmitente, 200), arquivo: nome, valor: Number(lido.valorTotal) || 0 };
if (!conf || !conf.ok) {
  // Falha de consulta (ex.: autenticacao do Sankhya): registra o erro e nao gera conclusao.
  await chamar(SF.pilotoInserir, Object.assign({}, base, { status: 'ERRO_CONSULTA', erro: texto(conf && conf.erro, 1000), classificacao: '', codemp: '', codparc: '', candidatos: '', sugerido: '', divergencias: '', justificativa: '', previsao: '' }));
  const r = await uma(SF.pilotoPorHash, { hash, chave: '' });
  return { ok: false, id: r ? r.ID : 0, erroConsulta: true, erro: 'Consulta ao ERP falhou; registrado sem conclusão: ' + (conf && conf.erro) };
}
const res = conf.resultado;
const candidatos = (res.pedidos || []).map((p) => p.NUNOTA);
const sugerido = res.classificacao === 'SEGURA' ? [...new Set(res.itens.flatMap((i) => i.pedidos))] : [];
const div = {};
for (const i of res.itens) for (const l of i.linhas) for (const d of l.divergencias) div[d] = (div[d] || 0) + 1;
if (res.itens.some((i) => i.situacao === 'PRODUTO_NAO_IDENTIFICADO')) div.PRODUTO_NAO_IDENTIFICADO = res.itens.filter((i) => i.situacao === 'PRODUTO_NAO_IDENTIFICADO').length;
await chamar(SF.pilotoInserir, Object.assign({}, base, {
  status: 'AGUARDANDO_CONFERENCIA', erro: '', classificacao: res.classificacao,
  codemp: (res.empresas || []).map((e) => e.CODEMP).join(','), codparc: (res.parceiros || []).map((p) => p.CODPARC).join(','),
  candidatos: candidatos.join(','), sugerido: sugerido.join(','), divergencias: Object.entries(div).map(([k, v]) => k + ':' + v).join(','),
  justificativa: texto(res.justificativa, 1000), previsao: paraB64(JSON.stringify({ origem: conf.origem, piloto: conf.piloto, resultado: res })),
}));
const r = await uma(SF.pilotoPorHash, { hash, chave: '' });
return { ok: true, id: r ? r.ID : 0, classificacao: res.classificacao };
