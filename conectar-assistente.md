# Conectar o assistente de IA

Sem esta configuração, o Assistente, a Ajuda e o Playground funcionam com a credencial pessoal de cada usuário (quem não tiver, não conversa). Com uma **connection do projeto**, todos conversam pela mesma credencial; o chat e o histórico continuam de cada um.

1. Configurações da plataforma (canto superior direito) → aba **AI** → crie a connection do projeto, escolhendo o provedor e a credencial. Prefira deixar **só o modelo** que os usuários devem usar.
2. Copie o **identificador** da connection.
3. No sistema: **Assistente → engrenagem** → cole o identificador → escolha o modelo (ou deixe o padrão) → Salvar. Só o administrador grava.
4. Publique a aplicação: **fora da aplicação publicada a IA não responde** (a tela avisa e continua mostrando as conversas gravadas).

## Se der errado
| Sintoma | Causa | Correção |
|---|---|---|
| Lista de modelos vazia | Connection sem modelo ou id errado | Confira o id; sem lista, digite o modelo |
| Chat não responde e a tela avisa | Aplicação não publicada | Publique |
| “Sem permissão” ao salvar | Você não é administrador | Peça ao administrador |
| Cada usuário pede a própria chave | Engrenagem vazia | Passo 3 |
| Conversa “esquece” o começo | A sessão do agente expirou | Esperado: a tela reenvia o resumo gravado no banco |
| Playground diz para conectar a IA | Sem credencial | Passos 1 a 3 |
