# Conectar a caixa frota@grupolidon.com.br (IMAP)

1. Entre como administrador: Caixa de entrada → Ajustes.
2. Preencha **Senha da caixa** e salve. Nunca envie a senha por chat.
3. Clique em **Testar conexão**: deve mostrar o endereço e o total de mensagens.
4. Clique em **Buscar agora**. A leitura só acontece a pedido.

A leitura abre a caixa somente para consulta: não apaga, não move e não marca como lida. São lidos os e-mails dos últimos 7 dias com PDF e alguma das palavras de Ajustes no assunto ou no nome do anexo.

A senha fica em arquivo privado do projeto, fora de tabelas e do registro de execuções. Quem é desenvolvedor do projeto consegue acessar esse arquivo. Para trocar, informe a nova em Ajustes; a anterior é apagada.

## Caixa de notas (italo.antonio@grupolidon.com.br)

Em Ajustes, preencha **Senha da caixa de notas**. Essa caixa é lida na mesma rodada, também só para consulta: entram apenas e-mails dos últimos 7 dias com XML de NF-e ou PDF com chave válida de NF-e ou de NFS-e nacional (nota de serviço), sem usar as palavras. Outros PDFs e XMLs são ignorados, e de um e-mail sem NF-e não se guardam remetente nem assunto. O corpo do e-mail não é guardado.

Nota que chega só em PDF entra com os dados do cabeçalho (chave, número, emitente) e vai para revisão: sem o XML não há itens para conferir com o pedido nem entrada no piloto.

A NFS-e entra como nota fiscal, sempre em revisão: não tem XML de itens nem conferência com pedido.
