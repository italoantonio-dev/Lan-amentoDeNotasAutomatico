// Conecta a caixa de e-mail. Quem roda e o usuario, com as tres credenciais do Google:
//   cd backend && node add-gmail.mjs "<client_id>" "<client_secret>" "<refresh_token>"
// As credenciais vao direto para o cofre do servidor; nunca entram em arquivo.
// Conectar da permissao de ler, nao ordem de ler: nenhuma leitura e ligada aqui.
import { sdk, projectId, textoErro } from './lib/base.mjs';

const [clientId, clientSecret, refreshToken] = process.argv.slice(2);
if (!clientId || !clientSecret || !refreshToken) {
  console.error('Uso: node add-gmail.mjs "<client_id>" "<client_secret>" "<refresh_token>"');
  process.exit(1);
}

const lista = await sdk.listIntegrationsMitra({ projectId });
const existe = (lista?.result ?? lista ?? []).some((i) => String(i.slug) === 'gmail');
if (existe) {
  // O SDK nao altera credencial de integracao: recriar com o mesmo slug da 409.
  console.log('A conexao "gmail" ja existe. Para trocar a credencial, use Configuracoes > Integracoes > Caixa de e-mail (Gmail).');
} else {
  await sdk.createIntegrationMitra({
    projectId, name: 'Caixa de e-mail (Gmail)', slug: 'gmail', blueprintId: null, blueprintType: 'HTTP_REQUEST', authType: 'DYNAMIC_TOKEN',
    credentials: { base_url: 'https://gmail.googleapis.com', client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken },
    authenticationConfig: {
      method: 'POST', url: 'https://oauth2.googleapis.com/token', content_type: 'application/x-www-form-urlencoded',
      body: { grant_type: 'refresh_token', client_id: '{{client_id}}', client_secret: '{{client_secret}}', refresh_token: '{{refresh_token}}' },
      token_extraction: { path: '$.access_token', type: 'jsonpath' }, refresh_strategy: 're_authenticate',
    },
    authorizationConfig: { type: 'header', config: { name: 'Authorization', value: 'Bearer {{token}}' } },
  });
  console.log('Conexao gravada.');
}

try {
  const r = await sdk.callIntegrationMitra({ projectId, connection: 'gmail', method: 'GET', endpoint: '/gmail/v1/users/me/profile' });
  if (Number(r.statusCode) >= 400) throw new Error(`HTTP ${r.statusCode}: ${JSON.stringify(r.body)}`);
  console.log(`Caixa conectada: ${r.body.emailAddress} (${r.body.messagesTotal} mensagens).`);
  console.log('Nenhuma leitura foi ligada. Use "Buscar agora" na Caixa de entrada.');
} catch (e) {
  console.error('A consulta a caixa falhou:', textoErro(e));
  process.exit(1);
}
