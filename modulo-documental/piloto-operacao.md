# Piloto assistido de conferência de NF-e: operação

**Situação em 05/11/2026:** preparado e liberado para uso. **Nenhum documento registrado ainda.** O piloto começa quando o primeiro XML entrar.

## Verificação antes da ativação
| # | Condição | Situação |
|---|---|---|
| 1 | Porta única de gravação bloqueada | Confirmada no código e no teste de bloqueio (106 verificações) |
| 2 | Não confirmar, criar nem alterar notas | A trava recusa antes do Sankhya; o piloto só chama a conferência de leitura |
| 3 | Não alterar pedidos, títulos, parceiros nem parâmetros | O piloto grava só na tabela interna `PILOTO_CONFERENCIA` |
| 4 | Testes sem lançamento em empresa real | Recusado no próprio auxiliar de testes; o teste do piloto usa XML com CNPJ fictício e apaga o que criou |
| 5 | Nenhum acesso business | Não há usuário business; "perfis nas telas" está desligada, então nenhum deve ser criado |
| 6 | Credencial só no servidor | A leitura usa a integração do servidor; o navegador nunca recebe credencial |
| 7 | Conta descartável sem ampliar acessos | Nenhum perfil, usuário ou permissão foi alterado. O piloto usa a permissão existente do perfil Administrador |
| 8 e 9 | Usuários 7 e 8; Maria e Italo | Nada alterado, ninguém convidado |
| 10 | ZZ_PROBE | Não tocada |

## Como operar
1. Abrir **Piloto de conferência** no menu (visível só para o perfil Administrador).
2. **Adicionar XML** de uma NF-e nova do piloto (TOP 1419/1420). A previsão do motor é gravada nesse momento: classificação, candidatos, pedido sugerido, divergências e justificativa completa.
3. Clicar em **Conferir**, comparar no Sankhya e registrar o resultado:
   - confirmar o pedido sugerido, só quando a previsão é Segura;
   - escolher entre os candidatos;
   - informar outro pedido;
   - não há pedido;
   - rejeitar o documento.
4. Quem confere e o horário saem do login. Todo resultado diferente de "confirmo" exige motivo.
5. A conferência é gravada uma única vez e não altera a previsão.
6. **Relatório:** `cd backend && node piloto/relatorio-piloto.mjs` gera `modulo-documental/piloto-relatorio.md`.

**Limites:**
- O piloto encerra sozinho com 20 documentos ou 5 dias úteis contados do primeiro. Feriados não são descontados.
- Hoje só o usuário 7 está no perfil Administrador. Outra pessoa conferir exige incluí-la no perfil, o que é uma alteração de permissão e depende da sua autorização.

## Regras de medição
- **Precisão** conta só previsões Seguras em que a pessoa confirmou o mesmo pedido.
- Ambígua ou incompatível **nunca** conta como acerto, mesmo que a pessoa escolha um pedido.
- Não há tolerância de preço, equivalência UN/PC nem escolha automática entre pedidos equivalentes.
- Falha de consulta ao Sankhya gera registro com o erro e sem conclusão (`ERRO_CONSULTA`).

## Diagnóstico das falhas de autenticação
- **Conexão:** integração `sankhya`, modelo `sankhya_oauth`, com token renovado pela plataforma.
- **O que acontece:** o login no Sankhya às vezes devolve **HTTP 400** ("Authentication failed: remote server returned HTTP 400"). A plataforma repassa o erro.
- **Registro de 3 dias** (04 e 05/11): 55 execuções de funções falharam assim, todas em horas de uso intenso.

| Hora (UTC) | Falhas | Execuções na hora |
|---|---:|---:|
| 04/11 18h | 9 | 1.227 |
| 04/11 20h | 6 | 724 |
| 04/11 21h | 6 | 579 |
| 05/11 10h | 6 | 458 |
| 05/11 11h | 3 | 496 |
| 05/11 13h | 12 | 782 |
| 05/11 14h | 13 | 354 |

As leituras diretas da auditoria também falharam assim. Em todos os casos a conexão voltou sozinha, em minutos.

**Hipóteses, nenhuma comprovada:**
1. Limite de logins por minuto no Sankhya quando há muitas renovações de token seguidas.
2. Renovação concorrente: várias chamadas renovam o token ao mesmo tempo.
3. Instabilidade do serviço de autenticação do Sankhya.

Credencial errada é pouco provável, porque a mesma credencial funciona minutos depois.

**Pedido à TI:** ver nos registros do Sankhya os logins recusados nesses horários e o motivo, e confirmar se há limite de autenticação por cliente.

**Proteção no piloto:** o volume é baixo (algumas conferências por dia). Se falhar, o documento fica registrado com o erro e pode ser reenviado depois.

## Evidências de que nada foi gravado
Ficam no relatório do piloto, a cada geração:
- as travas no código;
- a contagem de `ERP_ENVIO`;
- a ausência de usuários business;
- o teste de bloqueio, que compara o código publicado com o testado.

## Decisões pendentes das áreas
| Área | Decisão | Por que importa |
|---|---|---|
| Compras + Fiscal | Tolerância de preço | 31,5% das linhas diferem até R$ 0,01; hoje toda diferença torna a nota incompatível |
| Compras + Fiscal | Equivalência de unidades (UN/PC, EA, PEC) | 31,8% das linhas; a quantidade bate em 97,7% delas |
| Compras | Regra para vários pedidos candidatos | 40,7% das notas da validação são ambíguas |
| Compras + TI | Saldo oficial do item do pedido (V-05) e quando o de-para é alimentado (V-20) | Definem a cobertura real |
| Fiscal, Contabilidade, Controladoria | Matrizes de parâmetros; compras "entre lojas" | Antes de qualquer carga |
| Diretoria Financeira | Tetos e política de aprovação | Hoje ninguém aprova (fail-closed) |
| TI | Usuário de integração sem permissão de gravar e de confirmar; falhas de autenticação | Fecha o V-17 |
| Grupo Lidon | Conta administrativa corporativa (`parametros/seguranca-contas.md`) | Substituir o usuário 7 |
| Administrador do workspace | Ligar "perfis nas telas" | Antes de qualquer usuário business |
