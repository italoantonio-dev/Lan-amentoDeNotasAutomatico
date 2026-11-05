// Corte de leitura: o unico numero que decide se um documento chega ao ERP sem olhar humano.
import { ex, uma, rows, conf, encerrar, comPerfilTemporario, b64, consulta, dml } from './lib/smoke.mjs';

const lerCorte = async () => (await rows('roboLerConfig')).find((c) => c.CHAVE === 'CORTE_CONFIANCA').VALOR;
const original = await lerCorte();
const tenta = (valor) => ex('roboSalvarConfig', { chave: 'CORTE_CONFIANCA', valor });
const mensagens = [];
try {
  for (const invalido of ['', 'abc', '85.5', '-1', '101', '9 0']) {
    const r = await tenta(invalido);
    conf(`recusa "${invalido}"`, Number(r.affectedRows) === 0 && (await lerCorte()) === original);
  }
  const fora = await ex('roboSalvarConfig', { chave: 'ATIVO', valor: 'S' });
  conf('tela nao liga a varredura automatica', Number(fora.affectedRows) === 0);

  await comPerfilTemporario(async (copiar) => {
    const s = await copiar('roboSalvarConfig');
    conf('quem nao e administrador nao altera (zero linhas)', Number((await s({ chave: 'CORTE_CONFIANCA', valor: '10' })).affectedRows) === 0 && (await lerCorte()) === original);
  });

  // Gravar um corte valido mudaria a configuracao operacional do robo: nao e feito aqui. O uso do corte
  // real numa rodada esta coberto por _smoke-robo.mjs, que nao altera configuracao.
} finally {
  // nada gravado: so tentativas recusadas
}
conf('valor original restaurado', (await lerCorte()) === original, `corte ${original}`);
conf('roboKpis responde', Boolean(await uma('roboKpis')), mensagens.join());
encerrar('Ajustes');
