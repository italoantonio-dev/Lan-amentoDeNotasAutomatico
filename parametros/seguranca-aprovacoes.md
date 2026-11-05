# Segurança das aprovações (fail-closed): situação em 05/11/2026

Valendo no servidor desde 05/11/2026. Os cadastros de MARIA.APARECIDA e ITALO.ANTONIO e os perfis reais não foram alterados.

## Regras de autorização
Uma decisão (aprovar **ou** rejeitar) só passa se **todas** as condições abaixo forem verdadeiras. A conferência fica no próprio SQL de `verificarPermissaoAprovacao` e de `gravarDecisaoAprovacao`, então chamar a escrita direto também é recusado.

| # | Condição | Motivo da recusa |
|---|---|---|
| 1 | Existe aprovador ativo | `SEM_APROVADOR_ATIVO` |
| 2 | O e-mail do login autenticado é igual ao do aprovador ativo, e o vínculo gravado está vazio ou aponta para o mesmo usuário | `SEM_VINCULO` |
| 3 | O usuário está no perfil **Aprovador** | `SEM_PERFIL` |
| 4 | Existe linha ativa em `APROVADOR_ESCOPO` para a empresa e o tipo do documento | `FORA_DA_POLITICA` |
| 5 | Teto definido e maior que zero | `SEM_TETO` |
| 6 | Valor menor ou igual ao teto | `ACIMA_DA_ALCADA` |

**Antes desta correção:** sem aprovador ativo, qualquer usuário logado decidia; teto vazio significava "sem limite"; o vínculo só era feito ao salvar o cadastro.

**Agora:** qualquer ausência recusa. Hoje ninguém consegue decidir, porque `APROVADOR_ESCOPO` está vazia, ninguém está no perfil Aprovador e os dois aprovadores não têm login nem teto.

**Vínculo de login:** passa a ser resolvido na hora da decisão, pelo e-mail do login autenticado. Não depende de salvar o cadastro de novo. Só vale para quem também está no perfil Aprovador e na política.

## Arquivos alterados
- `backend/add-aprovadores.mjs`: tabela `APROVADOR_ESCOPO`, regras acima, motivo da recusa, `minhaAlcada` e `listarAprovadores` com o vínculo pelo e-mail.
- `backend/sf/aplicarDecisaoAprovacao.js`: só decide com `OK` do servidor e devolve o motivo.
- `frontend/src/pages/AprovacoesPage.tsx`, `config/AprovadoresTab.tsx`, `lib/guiaAjuda.ts`: textos sem a regra antiga.
- `backend/lib/smoke.mjs`:
  - a empresa de teste passa a ser a padrão;
  - a política e os perfis entram na comparação de antes e depois;
  - a nova repetição por limite de execuções (ver Testes);
  - um perfil Aprovador temporário.
- `backend/_smoke-aprovadores.mjs` (reescrito), `_smoke-test.mjs`, `_smoke-robo.mjs` (não muda mais o corte de confiança) e `_rodar-testes.mjs` (novo).
- `backend/auditoria/matriz-parametros.mjs`: separação por operação (`parametros/matriz-operacoes.csv`).

## Testes (`node backend/_rodar-testes.mjs`)
| Teste | Verificações OK | Resultado |
|---|---:|---|
| Isolamento de parâmetros | 12 | Passou |
| Aprovadores (fail-closed) | 20 | Passou |
| Núcleo | 21 | Passou após ajuste |
| Envio de título | 8 | Passou |
| Padrão do fornecedor | 10 | Passou |
| Parâmetros | 10 | Passou |
| Nota de entrada | 7 | Passou |
| Parceiro e duplicidade | 6 | Passou |
| Robô | 19 | Passou na 1ª execução |
| Bloqueio de gravação | 100 | Passou |

O teste de aprovadores cobre: aprovador inativo, e-mail sem login, vínculo gravado para outro usuário, teto vazio, teto zero, valor acima do teto e tipo fora da política. Também cobre a decisão sem o perfil Aprovador, o caminho real e a escrita direta sem autorização, a rejeição sem autorização e o caminho completo que aprova. O caminho que aprova roda com um aprovador de teste, a política só na empresa de teste e um perfil temporário, apagados no fim.

Limite de execuções por minuto:
- **Recusa antes de executar:** a chamada é repetida.
- **Limite estourado dentro de uma função:** a chamada não é repetida, para não duplicar efeito.
- **Ritmo:** as chamadas ficam espaçadas, e cada arquivo de teste começa numa janela nova do limite.

## Limitações remanescentes
- Não há tela para cadastrar a política (`APROVADOR_ESCOPO`). A carga será por script revisado, depois da aprovação formal.
- O caso "nenhum aprovador ativo no projeto" não foi exercitado com dados reais, porque existem 2 aprovadores ativos. Ele é coberto pela mesma regra, com o aprovador de teste inativo.
- O vínculo depende de o e-mail do login ser igual ao do cadastro do ERP. O e-mail vem da plataforma autenticada.
- A guarda de classificação do envio de título continua sem exercício ao vivo, porque hoje ninguém decide.
- O `_smoke-anexos.mjs` e o `_smoke-permissoes.mjs` ainda usam a primeira empresa real. Eles não gravam parâmetros, mas criam lançamentos de teste nela.
- O perfil Administrador tem um único usuário (`avncxowf@guerrillamailblock.com`, e-mail descartável), que deve ser confirmado.
- Existe no projeto um perfil chamado "dummy", criado fora deste trabalho.

## Sequência proposta para homologação
1. As áreas aprovam a matriz (`matriz-operacoes.csv` e `matriz-parametros.csv`).
2. A Diretoria Financeira define o teto e a política (aprovador × empresa × tipo) por escrito.
3. Com autorização:
   1. convidar os dois aprovadores com o mesmo e-mail do cadastro;
   2. colocá-los no perfil Aprovador;
   3. gravar o teto e a política por script, com registro de quem aprovou.
4. Fazer um teste assistido com cada aprovador:
   1. uma decisão dentro da política;
   2. uma recusa acima do teto;
   3. uma recusa fora da política.
5. Só então carregar os parâmetros aprovados, com a alçada automática ainda desligada (limite 0).
6. A gravação no Sankhya continua bloqueada até haver ambiente de homologação e serviço oficial validado.
