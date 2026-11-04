# UX — Lançamentos Fiscais e Financeiros

## Estrutura
Sidebar fixa com as 8 entradas (Painel, Lançamentos, Caixa de entrada, Aprovações, Assistente, Playground, Configuração, Ajuda). Configuração some para quem não é administrador, só depois da resposta do servidor. Botão flutuante do robô some no Assistente e no estudo do Playground. Abaixo de `lg`, a sidebar vira menu.

## Fluxo do documento
Entrada (tela, chat ou e-mail) → duplicidade pelo hash → leitura → classificação → alçada → Aprovado ou Aguardando aprovação (ou Revisão de leitura, pelo robô) → envio ao ERP como ação explícita no detalhe → Lançado, Erro ou Parcial.

## Regras de UX aplicadas
- Lançamentos com uma aba por tipo, sem “todos”; a aba vive na URL; a lista só busca depois que a aba existe; o botão carrega o tipo (“Novo — Boleto”).
- Campos seguem o documento: Nota não tem vencimento; guia mostra “Data de apuração”; folha mostra “Competência”. A mesma regra está no formulário, no preâmbulo do assistente e nas instruções do agente.
- Campo lido por heurística aparece com o selo “conferir”.
- Todo indicador do painel navega; os gráficos se filtram entre si, com chips de filtro.
- Rejeição exige motivo; exclusão e envio ao ERP pedem confirmação.
- Assistente: arquivar é a ação primária, excluir confirma; sugestões preenchem o campo sem enviar; envio bloqueado enquanto um anexo é lido; cada ferramenta vira um chip com resultado e duração.
- Caixa de entrada: barra de confiança pintada contra o corte em vigor; erro de busca aparece como aviso com o motivo real.
- Estados de carregando, vazio com ação, erro com “Tentar novamente” e sem permissão em toda tela.

## Onde a implementação divergiu
- O detalhe também tem Aprovar/Rejeitar quando o lançamento está pendente, além da fila.
- A escolha de parceiro ambíguo aparece no bloco “Enviar ao ERP”, com código, razão social e se é fornecedor.
- “Tornar administrador” só aparece para desenvolvedor do projeto, porque grava no perfil da plataforma. Retirar não está na tela.
- Sem botão de sair: a sessão é do workspace da plataforma.
