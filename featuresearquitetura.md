# Funcionalidades e arquitetura — Lançamentos Fiscais e Financeiros

## O que o usuário final tem
Contas a pagar automatizado: o documento fiscal (nota de entrada, boleto, guia, folha) entra, é lido, classificado, passa pela alçada e é gravado no Sankhya.

| Menu | O que faz |
|---|---|
| Painel | Pendências, lançados, erros e valor processado. Cada indicador abre a fila filtrada. Os dois gráficos se filtram entre si |
| Lançamentos | Uma aba por tipo de documento (na URL), upload com leitura no navegador, busca de fornecedor no ERP, detalhe com dados, classificação, itens, trilha, aprovação, envio ao ERP e painel de recusa |
| Caixa de entrada | O que o robô leu e decidiu: 5 indicadores, confiança contra o corte em vigor, justificativa critério a critério, Buscar agora, Entregar documento (simulação), Testar conexão, Ajustes (administrador) |
| Aprovações | Fila com a alçada de quem olha; aprovar e rejeitar com motivo; botões desabilitados com o motivo acima do teto |
| Assistente | Chat com ferramentas curadas, anexos lidos no navegador, conversas gravadas no banco, engrenagem da connection de IA |
| Playground | Estudos: a analista consulta a base e desenha a análise; versões; link público somente leitura |
| Configuração (administrador) | Empresas, TOPs, naturezas, centros, contas, parâmetros (com “Sugerir do ERP”), aprovadores, permissões; sincronização com o ERP |
| Ajuda | Guia em sanfona e assistente de dúvidas que responde só pelo guia |

## Camadas
- **Núcleo** (sem credencial): tabelas de `setup-backend.mjs`, documentos, lançamentos, alçada, aprovação, trilha, chat, robô em simulação, Playground.
- **Adaptador Sankhya**: só a conexão `sankhya` sabe onde está o ERP. Leitura de cadastro por SF INTEGRATION sem parâmetro; consulta com parâmetro e toda gravação só dentro de SF JavaScript que valida o valor antes (`sf/_erp.js`).

## Modelo de dados
O do §5 do pedido, com estas diferenças:

| Item | O que mudou | Por quê |
|---|---|---|
| `PERMISSOES_USUARIO.ADMINISTRADOR` | Não existe. Administrador é o perfil “Administrador” da plataforma (`INT_PROFILEUSER`) | Regra de segurança da plataforma: papel não fica em tabela própria. A tabela guarda só o alcance por tipo de documento |
| `DOCUMENTOS.ARQUIVO_URL`, `CHAT_ANEXO.URL`, `ROBO_ANEXO.ARQUIVO_URL` | Guardam a *key* do arquivo privado | Arquivo público fica aberto a quem tiver o endereço. O link sai de `obterLinkArquivo`, conferindo quem pede, e vale 5 minutos |
| `LANCAMENTOS.ENVIANDO_DESDE` | Nova coluna | Reserva o envio: dois cliques não criam dois títulos |
| `PLAYGROUND.CHAVE_IA` | Nova coluna | Prova de que quem grava o desenho é a analista daquele estudo (sem ela, qualquer usuário sobrescreveria estudo alheio pelo ID) |
| `CONFIG_SISTEMA` | Nova tabela (`IA_CONNECTION_ID`, `IA_MODELO`) | Variáveis de projeto estão descontinuadas na plataforma; a gravação exige administrador |
| `ROBO_EMAIL.PROCESSADO_EM` | Só é preenchido depois de todos os anexos | Rodada interrompida não perde anexo |
| FKs filhas de `LANCAMENTOS` | `ON DELETE CASCADE` | Excluir lançamento não trava na chave estrangeira |

## Decisões técnicas
| Decisão | Justificativa | Reversível? |
|---|---|---|
| `_nonce` em toda SF SQL e em toda chamada | Pedido explícito. Medido hoje: dois INSERTs iguais gravaram duas linhas, ou seja, o cache não se manifestou, mas o custo é zero | Sim |
| Lote por CTE recursiva sobre JSON em base64 | `JSON_TABLE` com parâmetro é bloqueado pela proteção de parâmetros | Sim |
| Chamada entre SFs conta no limite por minuto | Medido: 206 de 300 execuções que estouraram o limite eram aninhadas. Por isso: trilha em lote, detalhe em 1 chamada, envio com menos passos, robô com teto de 10 documentos por rodada | — |
| Situação inicial e alçada decididas no SQL | Chamar a SF direto não cria lançamento já aprovado nem aprova acima do teto | — |
| `criarLancamentoViaChat` atende tela e chat | Uma porta só, o canal vira o campo `origem`; o robô usa o mesmo código (`sf/_lancamento.js`) | Sim |
| Playground consulta pelo `runQuery` nativo do agente | Uma SF que executa SQL recebido (`consulta_livre`) é proibida pela plataforma: qualquer usuário logado a chamaria direto. O `runQuery` confere cada tabela contra o perfil; conversas, estudos e permissões ficam fora de todos os perfis | Sim |
| Chave de acesso conferida também por UF, mês, modelo e CNPJ | 44 zeros passam no módulo 11 | — |
| Simulação do robô não grava no ERP | Gravar é irreversível; a simulação mostra “lançaria no ERP” e o envio fica para o detalhe | Sim |

## Critérios de aceite (todos cobertos por smoke em `backend/`)
Nenhum lançamento nasce aprovado acima do limite; nenhuma rota aprova sem alçada; um papel vira um lançamento; parceiro ambíguo para e pergunta; documento já existente no ERP é barrado; nota sem produto é recusada; TOP incompatível é recusada; corte de leitura só de 0 a 100, só administrador; conversa e estudo de outro usuário não abrem; link público só com token de 32 hexadecimais.

## O que ficou aberto de propósito
- **Gravação real no ERP não foi executada.** A conexão `sankhya` deste projeto é de produção, com dados reais. Os smokes passam por todas as guardas e montam o pedido (`simular`), sem gravar. A primeira gravação real deve ser feita por uma pessoa, na tela, com um documento verdadeiro.
- **Assistente, Ajuda e Playground não foram testados com IA real**: o projeto ainda não tem connection de IA, e fora da aplicação publicada a plataforma não abre o agente. A IA do Playground depende do `runQuery` nativo do agente.
- **Retirar alguém do perfil Administrador** não tem função na SDK (ela só acrescenta). É feito na gestão de perfis da plataforma.
- **Varredura automática** desligada: `node backend/ligar-varredura.mjs S` liga (a cada 30 minutos).
- **OCR de imagem** baixa o idioma português do CDN do tesseract na primeira leitura.
- Com “perfis nas telas” desligado (situação atual), qualquer usuário logado chama qualquer SF privada. As conferências críticas estão no SQL. Sobra um risco residual: um usuário pode chamar direto as SFs internas de registro do envio (`erpRegistrarEnvio`, `erpConcluirEnvio`) e marcar um lançamento aprovado como lançado sem gravar no ERP. Ligar a proteção não fecha isso, porque as funções do robô precisam delas.
- Caixa Outlook/Microsoft 365 não faz parte desta entrega.

## Suposições registradas
- Desfecho de simulação “Lançaria (simulação)” é um sexto selo na Caixa de entrada.
- Busca de fornecedor e de produto é SF JavaScript (~1 a 2 s) para validar o texto antes do SQL do ERP.
- `sankhyaGravarFinanceiro/Nota/ItemNota`, `sankhyaCriarParceiro`, `sankhyaMarcarFornecedor/Cliente`, `sankhyaDuplicidade*` e `sankhyaParceiroPorCnpjCompleto` viraram funções internas de `enviarLancamentoParaErp` e `corrigirCadastroErp`, em vez de SFs que a tela pudesse chamar.
