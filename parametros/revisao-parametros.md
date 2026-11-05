# Revisão dos parâmetros: situação em 05/11/2026

**Nenhum parâmetro está aprovado nem carregado.** `PARAMETROS_LANCAMENTO` tem 0 linhas. A planilha é `matriz-parametros.csv`; as colunas `*_APROVADA`, `APROVADO_POR` e `DATA_APROVACAO` ficam em branco até a aprovação de cada responsável. As consultas estão em `registro-consultas-matriz.md`.

Período: 01/11/2025 a 31/10/2026. Para refazer: `cd backend && node auditoria/matriz-parametros.mjs`.

## Como a matriz aplica as decisões

| Decisão | Na matriz |
|---|---|
| TOP de NF-e | 1403 só como candidata sem pedido. Com pedido, vale a TOP de destino da operação. Empresa 700 fica sem candidata |
| TOP de boleto e guia | Sugestão, pendente de validação por operação |
| Natureza e centro | `PENDENTE DE REVISÃO` em todas as linhas. A coluna `FORNECEDORES_COM_SUGESTAO` conta os fornecedores com natureza e centro de confiança alta na auditoria, e o detalhe está em `auditoria/matriz-fornecedores.csv` |
| Folha | 13 linhas excluídas, com validação pendente de RH, Contabilidade e TI |
| Alçada | `NÃO DEFINIDA` em todas as linhas |

**Confiança** descreve só a evidência da TOP e não autoriza preenchimento automático: ALTA com 80% ou mais dos documentos da categoria, MÉDIA com 50% ou mais, BAIXA abaixo disso ou com menos de 30 documentos.

**Conta, tipo de título e produto** são referência do levantamento e não foram decididos. O envio de título exige tipo de título, então essas colunas precisam de responsável antes da carga.

## Pontos para o revisor

1. A TOP 1403 chama-se "COMPRA - USO/CONSUMO". Revenda usa 1419, 1420 e 1401, então a 1403 não serve para qualquer mercadoria.
2. A 1403 cobre de 1,2% a 47,5% das NF-e em 12 empresas. A 1452 (transferência entre filiais) lidera em várias e não é compra. A 1426 e a 1425 são compras "entre lojas/sem pedido".
3. Boleto nas empresas 300, 400 e 700: o levantamento sugere 1600, mas a 1112 é a mais usada (95 de 115, 84 de 97 e 6 de 12). A sugestão foi mantida com confiança BAIXA para o revisor decidir.
4. Guia nas empresas 300, 302 e 700: a 1609 não é a TOP mais usada. As principais são 1152, 1121 e 1123.

## Aprovadores (nada foi alterado)

| Aprovador | Ativo | Vínculo | Login no projeto | Teto |
|---|---|---|---|---|
| MARIA.APARECIDA (15) | Sim | Vazio | Não | Sem teto |
| ITALO.ANTONIO (129) | Sim | Vazio | Não | Sem teto |

- **Causa:** o e-mail dos dois não corresponde a nenhum usuário do projeto. Não há o que vincular até eles terem login.
- **Efeito:** com aprovador ativo sem vínculo, ninguém consegue aprovar.
- **Vínculo só ao salvar:** `salvarAprovador` só procura o login ao salvar o aprovador. Quem receber login depois continua sem vínculo até o cadastro ser salvo de novo.
- **Sem teto:** depois de vinculados, os dois podem aprovar qualquer valor, porque o limite está vazio.
- **Sem aprovador ativo:** se todos forem inativados, a regra de alçada deixa de valer e qualquer usuário logado decide.

Correção proposta, que depende de autorização:
1. Convidar os dois e-mails e atribuir perfil.
2. Salvar os dois cadastros de novo para gravar o vínculo.
3. Definir o teto com a Diretoria Financeira.
4. Mudar `PODE_DECIDIR` para recusar a decisão quando não houver aprovador ativo, e buscar o login também na hora de decidir.

Para repetir o diagnóstico, só com leitura: `cd backend && node auditoria/diagnostico-aprovadores.mjs`.

## Condições antes da carga

| # | Condição | Situação |
|---|---|---|
| 1 | Corrigir os 6 testes | Feito |
| 2 | Isolamento e restauração | Feito e testado |
| 3 | Fases 1 e 2 concluídas | Primeiro incremento publicado; próximos pendentes de revisão |
| 4 | Conflitos | Nenhum até agora; conferir de novo antes da carga |
| 5 | Vínculo dos aprovadores | Investigado; correção depende de autorização |
| 6 e 7 | Planilha; proposto x aprovado | Feito |
| 8 | Trava de gravação | Mantida |
| 9 | ZZ_PROBE | Não tocada |

## Testes

| Teste | Verificações OK | Resultado |
|---|---:|---|
| `_smoke-erp` | 8 | Passou |
| `_smoke-padrao` | 10 | Passou |
| `_smoke-parametros` | 10 | Passou |
| `_smoke-erp-nota` | 7 | Passou |
| `_smoke-parceiro-duplicidade` | 6 | Passou |
| `_smoke-robo` | 19 | Passou na 2ª execução |
| `_teste-isolamento-parametros` (novo) | 12 | Passou |
| `_smoke-bloqueio-erp` | 100 | Passou |

Os testes agora gravam parâmetro só em uma empresa e um tipo de teste, criados no início e apagados no fim. A exceção é a duplicidade, que usa empresa real com o tipo de teste. Gravar em par real é recusado antes de chamar o servidor. Ao fechar, cada um dos 6 testes confere que parâmetros, aprovadores, configuração do robô e envios ao ERP ficaram iguais ao início.

Limites:
- **`_smoke-robo`:** na 1ª execução, 1 verificação falhou. A rodada bateu no limite de execuções por minuto e, ao repetir a chamada, o documento já tinha entrado. Isolado, passou com todas as verificações. O teste continua sensível a esse limite.
- **Guarda de classificação em `_smoke-erp`:** não foi exercitada ao vivo, porque ninguém consegue aprovar hoje. `_smoke-bloqueio-erp` cobre essa guarda em memória.
- **Parte ao vivo de `_smoke-bloqueio-erp`:** não foi executada, pois exige `--vivo`.
- **Gravação real no ERP:** não foi executada.
- **Durante os testes:** a empresa e o tipo de teste (`ZZ ...`) ficam visíveis nas listas do sistema por alguns instantes.
