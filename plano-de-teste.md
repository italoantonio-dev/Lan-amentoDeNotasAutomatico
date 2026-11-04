# Plano de teste — para fazer na tela, sem apoio técnico

Faça na ordem. Os testes que gravam no ERP ficam por último.

## Primeiros passos
1. **Configuração → Permissões**: marque quem é administrador. Enquanto ninguém for, todo usuário logado entra em Configuração. Só um desenvolvedor do projeto marca o primeiro.
2. **Configuração → Sincronizar com o ERP**: confira as abas Empresas, TOPs, Naturezas, Centros e Contas preenchidas.
3. **Configuração → Parâmetros → Adicionar**: escolha uma empresa e “Boleto”, clique em **Sugerir do ERP**, confira a evidência e coloque um limite de aprovação (ex.: R$ 5.000). Sem esta linha, tudo para em aprovação.
4. **Configuração → Aprovadores**: adicione um aprovador do ERP com o seu e-mail de login e uma alçada.

## Lançamentos
5. Lançamentos → aba Boleto → Novo: envie um PDF. Confira os campos marcados “conferir”, escolha a empresa e crie. Valor abaixo do limite: nasce **Aprovado**.
6. Envie o mesmo arquivo de novo: o sistema avisa que já entrou.
7. Crie outro com valor acima do limite: nasce **Aguardando aprovação** e aparece em Aprovações.
8. Em Aprovações, rejeite sem motivo (o botão não habilita), depois aprove.
9. No detalhe, corrija a classificação e veja a origem mudar para “Manual” e a trilha registrar.

## Caixa de entrada (sem conectar o e-mail)
10. **Entregar documento** com um XML de NF-e: veja a nota de confiança, a justificativa por critério e o desfecho.
11. **Ajustes**: tente salvar o corte vazio, “abc” e 101 (recusados) e depois 85. A frase do topo passa a dizer 85%.
12. **Testar conexão**: sem credencial, a resposta diz que a caixa não está conectada.

## Assistente, Ajuda e Playground (aplicação publicada e connection de IA criada)
13. Assistente → engrenagem: cole o id da connection. Pergunte “quais lançamentos aguardam aprovação?” e veja o chip da ferramenta.
14. Arraste um PDF para a conversa e peça para lançar.
15. Ajuda: pergunte “quando o robô lança sozinho?”.
16. Playground → Novo estudo → peça “onde está concentrado o gasto por fornecedor”. Compartilhe e abra o link numa janela anônima.

## Destrutivos (gravam no ERP de verdade)
17. No detalhe de um lançamento **Aprovado** com documento real: **Enviar ao ERP**. Confira a chave devolvida no Sankhya.
18. Clique em Enviar de novo: o sistema devolve a chave existente em vez de criar outro título.
19. Caixa de entrada → **Buscar agora** com a caixa conectada (`conectar-gmail.md`): o que passar pelo corte e pela alçada é gravado no ERP sem ninguém conferir.
