// Relatorio do piloto assistido: precisao, cobertura, incompatibilidades, falhas de consulta e evidencias
// de que nada foi gravado no Sankhya. Somente leitura (banco do projeto e registro da plataforma).
//   cd backend && node piloto/relatorio-piloto.mjs
import fs from 'node:fs';
import { consulta, sdk, projectId } from '../lib/base.mjs';

const fonteErp = fs.readFileSync(new URL('../sf/_erp.js', import.meta.url), 'utf8');
const travas = ['GRAVACAO_ERP_HABILITADA', 'CRIACAO_NOTA_HABILITADA'].map((t) => [t, new RegExp(`^const ${t} = false;$`, 'm').test(fonteErp)]);
const regs = await consulta('SELECT ID, NUMERO, SERIE, CHAVE_NFE, CNPJ_EMITENTE, NOME_EMITENTE, CODEMP, CODPARC, RECEBIDO_EM, STATUS, ERRO_CONSULTA, CLASSIFICACAO, PEDIDOS_CANDIDATOS, PEDIDO_SUGERIDO, DIVERGENCIAS, JUSTIFICATIVA, RESULTADO, PEDIDOS_CONFERIDOS, MOTIVO, CONFERIDO_POR, CONFERIDO_EM FROM PILOTO_CONFERENCIA ORDER BY ID');
const envios = Number((await consulta('SELECT COUNT(*) AS N FROM ERP_ENVIO'))[0].N);
const usuarios = (await sdk.listProjectUsersMitra({ projectId })).result ?? [];
const ctx = (await sdk.getProjectContextMitra({ projectId })).result?.project ?? {};
const lista = (v) => String(v ?? '').split(',').filter(Boolean).map(Number).sort((a, b) => a - b).join(',');
const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1).replace('.', ',')}%` : '—');
const conf = regs.filter((r) => r.STATUS === 'CONFERIDO');
const por = (c) => conf.filter((r) => r.CLASSIFICACAO === c);
const seguras = por('SEGURA');
const segurasCertas = seguras.filter((r) => r.RESULTADO === 'CONFIRMOU_SUGESTAO' || (['ESCOLHEU_PEDIDO', 'CORRIGIU_PEDIDO'].includes(r.RESULTADO) && lista(r.PEDIDOS_CONFERIDOS) === lista(r.PEDIDO_SUGERIDO)));
const ambiguas = por('AMBIGUA');
const ambNosCandidatos = ambiguas.filter((r) => r.PEDIDOS_CONFERIDOS && lista(r.PEDIDOS_CONFERIDOS).split(',').every((p) => lista(r.PEDIDOS_CANDIDATOS).split(',').includes(p)));
const semPedidoCerto = por('SEM_PEDIDO').filter((r) => r.RESULTADO === 'SEM_PEDIDO');
const incomp = regs.filter((r) => r.CLASSIFICACAO === 'INCOMPATIVEL');
const erros = regs.filter((r) => r.STATUS === 'ERRO_CONSULTA');
const contaDiv = {};
for (const r of incomp) for (const d of String(r.DIVERGENCIAS ?? '').split(',').filter(Boolean)) { const [k, v] = d.split(':'); contaDiv[k] = (contaDiv[k] ?? 0) + Number(v); }
const md = `# Piloto assistido de conferência de NF-e: relatório

Gerado em ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC por \`backend/piloto/relatorio-piloto.mjs\`. Limite do piloto: 20 documentos ou 5 dias úteis.

## Situação
| Medida | Valor |
|---|---:|
| Documentos registrados | ${regs.length} |
| Conferidos por pessoa | ${conf.length} |
| Aguardando conferência | ${regs.filter((r) => r.STATUS === 'AGUARDANDO_CONFERENCIA').length} |
| Falha de consulta ao Sankhya (sem conclusão) | ${erros.length} |

## Precisão e cobertura (só documentos conferidos)
| Medida | Valor |
|---|---:|
| Cobertura: previsão SEGURA | ${seguras.length} de ${conf.length} (${pct(seguras.length, conf.length)}) |
| **Precisão das SEGURAS** (pessoa confirmou o mesmo pedido) | ${segurasCertas.length} de ${seguras.length} (${pct(segurasCertas.length, seguras.length)}) |
| Falsas correspondências (SEGURA com pedido diferente) | ${seguras.length - segurasCertas.length} |
| AMBÍGUAS: pedido escolhido estava entre os candidatos | ${ambNosCandidatos.length} de ${ambiguas.length} |
| SEM PEDIDO confirmado pela pessoa | ${semPedidoCerto.length} de ${por('SEM_PEDIDO').length} |
| INCOMPATÍVEIS conferidas | ${por('INCOMPATIVEL').length} (não contam como acerto, mesmo com pedido escolhido pela pessoa) |

${conf.length < 20 ? `**Amostra pequena (${conf.length} conferidos):** os percentuais acima ainda não sustentam conclusão.` : ''}

## Incompatibilidades
| Divergência | Ocorrências (linhas) |
|---|---:|
${Object.entries(contaDiv).map(([k, v]) => `| ${k} | ${v} |`).join('\n') || '| — | 0 |'}

| # | Nota | Fornecedor | Empresa | Divergências | Conferência | Motivo |
|---|---|---|---|---|---|---|
${incomp.map((r) => `| ${r.ID} | ${r.NUMERO} | ${r.NOME_EMITENTE} (${r.CNPJ_EMITENTE}) | ${r.CODEMP ?? '—'} | ${r.DIVERGENCIAS ?? '—'} | ${r.RESULTADO ?? 'pendente'} | ${r.MOTIVO ?? ''} |`).join('\n') || '| — | | | | | | |'}

## Falhas de consulta
${erros.map((r) => `- Documento ${r.ID} (nota ${r.NUMERO}), ${r.RECEBIDO_EM}: ${r.ERRO_CONSULTA}`).join('\n') || 'Nenhuma.'}

## Registro auditável
| # | Nota | Chave | Fornecedor | Empresa | Recebida | Previsão | Candidatos | Sugerido | Resultado | Pedidos conferidos | Conferente | Em | Motivo |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
${regs.map((r) => `| ${r.ID} | ${r.NUMERO}/${r.SERIE ?? ''} | ${r.CHAVE_NFE ?? '—'} | ${r.CODPARC ?? '—'} | ${r.CODEMP ?? '—'} | ${r.RECEBIDO_EM} | ${r.CLASSIFICACAO ?? r.STATUS} | ${r.PEDIDOS_CANDIDATOS ?? '—'} | ${r.PEDIDO_SUGERIDO ?? '—'} | ${r.RESULTADO ?? '—'} | ${r.PEDIDOS_CONFERIDOS ?? '—'} | ${r.CONFERIDO_POR ?? '—'} | ${r.CONFERIDO_EM ?? '—'} | ${r.MOTIVO ?? ''} |`).join('\n') || '| — |||||||||||||'}

## Evidências de que nada foi gravado no Sankhya
| Verificação | Resultado |
|---|---|
${travas.map(([t, ok]) => `| \`${t} = false\` no código das funções | ${ok ? 'Confirmado' : '**NÃO**'} |`).join('\n')}
| Registros de envio ao ERP (\`ERP_ENVIO\`) | ${envios} |
| Teste de bloqueio (\`_smoke-bloqueio-erp.mjs\`) | rodar antes de cada relatório; compara o código publicado com o testado |
| Credencial do Sankhya | Só na integração do servidor; nenhuma tela chama a integração direto |

## Condições de acesso
| Condição | Situação |
|---|---|
| Usuários business no projeto | ${usuarios.filter((u) => u.userType === 'business').length} |
| Proteção "perfis nas telas" | ${ctx.businessUserProfilesInScreens ? 'ligada' : 'desligada: não liberar usuário business'} |
| Quem opera o piloto | Perfil Administrador (permissão existente) |
`;
fs.writeFileSync(new URL('../../modulo-documental/piloto-relatorio.md', import.meta.url), md);
console.log(`Relatorio: ${regs.length} documentos, ${conf.length} conferidos, ${erros.length} falhas. Travas: ${travas.map(([t, ok]) => `${t}=${ok ? 'off' : 'ON'}`).join(' ')}. ERP_ENVIO=${envios}.`);
