// Liga ou desliga a varredura automatica da caixa de e-mail. Por padrao ela nasce desligada:
// a caixa so e lida quando alguem clica em "Buscar agora" ou pede ao assistente.
//   node ligar-varredura.mjs S   -> le a caixa a cada 30 minutos
//   node ligar-varredura.mjs N   -> volta a ler so a pedido
// Ligado, o robo pode gravar no ERP sem ninguem olhar o que passar pelo corte e pela alcada.
import { sdk, projectId, dml, idSF, fim } from './lib/base.mjs';

const valor = String(process.argv[2] || '').toUpperCase();
if (valor !== 'S' && valor !== 'N') {
  console.error('Uso: node ligar-varredura.mjs S | N');
  process.exit(1);
}
await dml(`UPDATE ROBO_CONFIG SET VALOR = '${valor}' WHERE CHAVE = 'ATIVO'`);
const id = await idSF('roboVarrerEmails');
// Cron do Spring, 6 campos (segundo minuto hora dia mes diaDaSemana). Minimo da plataforma: 5 minutos.
await sdk.updateServerFunctionMitra({ projectId, serverFunctionId: id, cronExpression: valor === 'S' ? '0 */30 * * * *' : '' });
fim(valor === 'S' ? 'Varredura automatica ligada (a cada 30 minutos).' : 'Varredura automatica desligada.');
