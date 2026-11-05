const inicio = Date.now();
// O agendamento chama sem input: sem origem, e cron, e so roda com ATIVO = 'S'. A tela e o assistente sempre informam a origem.
const origem = texto(event.origem || 'CRON', 20);
const config = await configRobo();
if (origem === 'CRON' && config.ATIVO !== 'S') return { ok: true, ignorado: true, mensagem: 'Varredura automática desligada.' };

const slug = config.INTEGRACAO || 'gmail';
const ehImap = slug === 'imap';
const sessoes = {};
const token = 'r' + Date.now() + Math.random().toString(16).slice(2, 10);
await chamar(SF.roboCriarExecucao, { token, origem });
const exec = await uma(SF.roboObterExecucao, { token });
const cont = { mensagens: 0, anexos: 0, lancados: 0, aprovacao: 0, revisao: 0, erros: 0 };

// Levanta erro em qualquer resposta >= 400 e propaga a mensagem real. Nunca condicione a busca
// ao selo da conexao: em conector proprio ele fica vermelho mesmo com a API respondendo.
async function caixa(endpoint, params) {
  const pedido = { projectId: PROJECT_ID, connection: slug, method: 'GET', endpoint };
  if (params) pedido.params = params;
  const r = await sdk.callIntegrationMitra(pedido);
  const http = Number(r && r.statusCode);
  if (http >= 400) throw new Error('A caixa respondeu HTTP ' + http + ': ' + msgErro(r.body));
  return r.body;
}

function acharAnexos(parte, saida) {
  if (!parte) return saida;
  if (parte.filename && parte.body && parte.body.attachmentId && /\.(xml|pdf)$/i.test(parte.filename)) {
    saida.push({ nome: parte.filename, id: parte.body.attachmentId });
  }
  (parte.parts || []).forEach((p) => acharAnexos(p, saida));
  return saida;
}

const concluir = (statusExec, mensagem) => chamar(SF.roboConcluirExecucao, Object.assign({ token, duracaoMs: Date.now() - inicio, statusExec, mensagem: texto(mensagem, 500) }, cont));

try {
  const consulta = config.GMAIL_QUERY || 'has:attachment newer_than:7d';
  // UM parametro de consulta por chamada: com dois, o primeiro e descartado no caminho e a API
  // responde 200 com a caixa inteira, sem filtro. O limite sai no slice abaixo. Nao "otimize".
  if (ehImap) {
    if (origem === 'CRON') throw new Error('A caixa IMAP só é lida a pedido.');
    // Caixa sem senha fica de fora da rodada; sem nenhuma, a busca falha como "nao conectada".
    const semSenha = [];
    for (const caixa of ['boletos', 'notas']) {
      try {
        sessoes[caixa] = await imapAbrir(await imapDados(config, caixa));
      } catch (e) {
        if (!/IMAP_SEM_SENHA/.test(msgErro(e))) throw new Error('Caixa de ' + caixa + ': ' + msgErro(e));
        semSenha.push(msgErro(e));
      }
    }
    if (!sessoes.boletos && !sessoes.notas) throw new Error(semSenha.join(' '));
  }
  const lista = ehImap ? null : await caixa('/gmail/v1/users/me/messages', { q: consulta });
  const max = Number(config.MAX_MENSAGENS ?? 10) || 10;
  const ids = ehImap
    ? (sessoes.notas ? await imapCandidatos(sessoes.notas, [], 7, null, true) : []).concat(sessoes.boletos ? await imapCandidatos(sessoes.boletos, String(config.IMAP_PALAVRAS || '').split(','), 7) : [])
    : (lista.messages || []).map((m) => m.id);
  const jaLidas = new Set((ids.length ? await listar(SF.roboMensagensProcessadas, { ids: ids.join(',') }) : []).map((r) => r.MENSAGEM_ID));
  const novas = ids.filter((i) => !jaLidas.has(i)).slice(0, max);
  // Cada documento custa cerca de 26 execucoes (nota inclui a conferencia com pedidos), e chamada entre SFs conta no limite por minuto do
  // projeto. O resto fica para a proxima rodada: quem usa as telas nao pode ser barrado pelo robo.
  const TETO_ANEXOS = 8;
  let parouPorTeto = false;
  const empresas = await listar(SF.roboEmpresas, {});
  const tipos = await listar(SF.listarTiposDocumento, {});
  for (const id of novas) {
    if (Date.now() - inicio > 230000 || cont.anexos >= TETO_ANEXOS) { parouPorTeto = true; break; } // o teto da SF e 300s
    let cab = {};
    let anexos;
    let recebido;
    if (ehImap) {
      const m = await imapBaixar(String(id).startsWith('imapnotas:') ? sessoes.notas : sessoes.boletos, id);
      // E-mail sem NF-e na caixa de notas: guarda so o id, para nao baixar de novo. Remetente e assunto nao interessam.
      cab = String(id).startsWith('imapnotas:') && !m.anexos.length ? {} : m.cab; anexos = m.anexos; recebido = m.recebido;
    } else {
      const msg = await caixa('/gmail/v1/users/me/messages/' + encodeURIComponent(id));
      ((msg.payload && msg.payload.headers) || []).forEach((h) => { cab[String(h.name).toLowerCase()] = h.value; });
      anexos = acharAnexos(msg.payload, []);
      recebido = msg.internalDate ? new Date(Number(msg.internalDate)).toISOString().slice(0, 19) : '';
    }
    await chamar(SF.roboRegistrarEmail, { mensagemId: id, remetente: cab.from || '', assunto: cab.subject || '', recebidoEm: recebido, execucaoId: exec ? exec.ID : 0, anexos: anexos.length, mensagem: '' });
    const email = await uma(SF.roboEmailPorMensagem, { mensagemId: id });
    cont.mensagens++;
    let limite = false;
    for (const a of anexos) {
      try {
        let buffer = a.buffer;
        if (!buffer) {
          const bin = await caixa('/gmail/v1/users/me/messages/' + encodeURIComponent(id) + '/attachments/' + encodeURIComponent(a.id));
          buffer = Buffer.from(String(bin.data || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64');
        }
        const r = await processarAnexo({ nome: a.nome, buffer, emailId: email ? email.ID : 0, simulacao: false, config, empresas, tipos });
        cont.anexos++;
        if (r.decisao === 'LANCADO') cont.lancados++;
        else if (r.decisao === 'PRONTO') cont.prontos = (cont.prontos || 0) + 1;
        else if (r.decisao === 'APROVACAO') cont.aprovacao++;
        else if (r.decisao === 'REVISAO') cont.revisao++;
        else if (r.decisao === 'ERRO') cont.erros++;
      } catch (e) {
        // Limite do projeto nao e defeito do anexo: para a rodada e deixa a mensagem para a proxima.
        if (/RATE_LIMIT/.test(msgErro(e) + JSON.stringify(e))) { limite = true; break; }
        cont.erros++;
        await chamar(SF.roboRegistrarAnexo, { emailId: email ? email.ID : 0, nome: texto(a.nome, 300), tipo: '', tamanho: 0, hash: '', origemLeitura: 'EMAIL', confianca: 0, criterios: paraB64('[]'), campos: paraB64('{}'), decisao: 'ERRO', motivo: texto(msgErro(e), 500), lancamentoId: 0, documentoId: 0, chaveErp: '', arquivoKey: '' });
      }
    }
    if (limite) { parouPorTeto = true; break; }
    if (email) await chamar(SF.roboConcluirEmail, { id: email.ID });
  }
  await concluir(cont.erros || parouPorTeto ? 'PARCIAL' : 'OK', parouPorTeto ? 'Rodada interrompida para não estourar o limite do projeto: clique em Buscar agora de novo para continuar.' : novas.length ? 'Rodada concluída.' : 'Nenhuma mensagem nova na busca.');
  return Object.assign({ ok: true, parcial: parouPorTeto }, cont);
} catch (e) {
  const m = msgErro(e);
  await concluir('ERRO', m);
  return Object.assign({ ok: false, naoConectada: /IMAP_SEM_SENHA|PREENCHER|invalid_client|invalid_grant|401|Authentication|not found|n[aã]o encontrad/i.test(m), erro: m }, cont);
} finally {
  Object.values(sessoes).forEach((s) => s.fechar());
}
