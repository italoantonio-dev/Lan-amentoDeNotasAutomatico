# Piloto assistido de conferência de NF-e: relatório

Gerado em 2026-11-05 14:22 UTC por `backend/piloto/relatorio-piloto.mjs`. Limite do piloto: 20 documentos ou 5 dias úteis.

## Situação
| Medida | Valor |
|---|---:|
| Documentos registrados | 0 |
| Conferidos por pessoa | 0 |
| Aguardando conferência | 0 |
| Falha de consulta ao Sankhya (sem conclusão) | 0 |

## Precisão e cobertura (só documentos conferidos)
| Medida | Valor |
|---|---:|
| Cobertura: previsão SEGURA | 0 de 0 (—) |
| **Precisão das SEGURAS** (pessoa confirmou o mesmo pedido) | 0 de 0 (—) |
| Falsas correspondências (SEGURA com pedido diferente) | 0 |
| AMBÍGUAS: pedido escolhido estava entre os candidatos | 0 de 0 |
| SEM PEDIDO confirmado pela pessoa | 0 de 0 |
| INCOMPATÍVEIS conferidas | 0 (não contam como acerto, mesmo com pedido escolhido pela pessoa) |

**Amostra pequena (0 conferidos):** os percentuais acima ainda não sustentam conclusão.

## Incompatibilidades
| Divergência | Ocorrências (linhas) |
|---|---:|
| — | 0 |

| # | Nota | Fornecedor | Empresa | Divergências | Conferência | Motivo |
|---|---|---|---|---|---|---|
| — | | | | | | |

## Falhas de consulta
Nenhuma.

## Registro auditável
| # | Nota | Chave | Fornecedor | Empresa | Recebida | Previsão | Candidatos | Sugerido | Resultado | Pedidos conferidos | Conferente | Em | Motivo |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| — |||||||||||||

## Evidências de que nada foi gravado no Sankhya
| Verificação | Resultado |
|---|---|
| `GRAVACAO_ERP_HABILITADA = false` no código das funções | Confirmado |
| `CRIACAO_NOTA_HABILITADA = false` no código das funções | Confirmado |
| Registros de envio ao ERP (`ERP_ENVIO`) | 0 |
| Teste de bloqueio (`_smoke-bloqueio-erp.mjs`) | rodar antes de cada relatório; compara o código publicado com o testado |
| Credencial do Sankhya | Só na integração do servidor; nenhuma tela chama a integração direto |

## Condições de acesso
| Condição | Situação |
|---|---|
| Usuários business no projeto | 0 |
| Proteção "perfis nas telas" | desligada: não liberar usuário business |
| Quem opera o piloto | Perfil Administrador (permissão existente) |
