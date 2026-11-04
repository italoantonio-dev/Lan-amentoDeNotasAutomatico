// O texto da tela e a fonte da IA: o mesmo conteudo vai como preambulo. Atualizar o fluxo e mexer aqui.
export const GUIA: { titulo: string; corpo: string[] }[] = [
  {
    titulo: 'Do documento ao lançamento',
    corpo: [
      'Um documento pode entrar por três portas: a tela de Lançamentos, o Assistente ou o robô de e-mail. As três seguem as mesmas regras.',
      'O sistema lê os campos, confere se o mesmo arquivo já entrou, classifica (TOP, natureza, centro e conta) e decide a situação pela alçada.',
      'Abaixo do limite cadastrado em Parâmetros, o lançamento nasce Aprovado. Acima do limite, sem parâmetro ou com limite zero, nasce Aguardando aprovação.',
    ],
  },
  {
    titulo: 'Situações de um lançamento',
    corpo: [
      'Aguardando aprovação: precisa da decisão de uma pessoa.',
      'Aprovado: pronto para conferência no detalhe do lançamento. A gravação no ERP está desligada nesta fase.',
      'Lançado: gravado no ERP; a chave devolvida fica no histórico de envios.',
      'Rejeitado: não segue; a rejeição sempre tem motivo.',
      'Erro: o ERP recusou; o detalhe explica a causa e o que fazer.',
      'Revisão de leitura: o robô leu abaixo do corte de confiança e alguém precisa conferir os campos.',
    ],
  },
  {
    titulo: 'Como a classificação é decidida',
    corpo: [
      'A TOP vem sempre do parâmetro da empresa e do tipo de documento: ela nunca é aprendida do fornecedor.',
      'Natureza, centro e conta podem herdar o histórico do fornecedor quando há dominância: 70% em pelo menos 2 lançamentos deste sistema, ou 70% em pelo menos 3 títulos do ERP. A trilha mostra a contagem que sustentou cada herança.',
      'Você pode corrigir a classificação no detalhe; ela passa a constar como Manual.',
    ],
  },
  {
    titulo: 'Aprovação e alçada',
    corpo: [
      'Cada aprovador tem uma alçada: um teto de valor, ou qualquer valor quando fica em branco. Quem aprova é o login vinculado pelo e-mail ao aprovador.',
      'Itens acima da sua alçada aparecem com os botões desabilitados e o motivo à vista. A recusa também acontece no servidor.',
      'Enquanto não houver aprovador cadastrado, a alçada não vale, e a tela avisa.',
    ],
  },
  {
    titulo: 'Conferência para o ERP',
    corpo: [
      'O sistema confere: se já foi enviado, se está aprovado, se a classificação está completa, se a TOP combina com o tipo de documento, qual é o parceiro e se o documento já existe no ERP.',
      'Quando há mais de um parceiro com o mesmo CNPJ, o sistema para e pergunta. A escolha fica guardada para os próximos documentos daquele CNPJ.',
      'Nota de entrada não é criada por este sistema: ela nasce do pedido de compra no Sankhya e é confirmada por uma pessoa autorizada.',
      'A gravação no ERP está desligada nesta fase: a tela só confere e mostra o que seria enviado.',
    ],
  },
  {
    titulo: 'Robô de e-mail e Caixa de entrada',
    corpo: [
      'A caixa só é lida quando alguém clica em Buscar agora ou pede ao Assistente.',
      'Cada leitura recebe uma nota de confiança, com a justificativa critério a critério: chave de acesso (40), valor rotulado (25), vencimento (15), emissão (10) e destinatário (10).',
      'Acima do corte e dentro da alçada, o robô confere sem gravar e deixa pronto. Nota de entrada não é criada aqui: segue pelo pedido de compra no Sankhya. Acima do corte e fora da alçada, vai para aprovação. Abaixo do corte, vai para revisão de leitura.',
      'O robô nunca grava no ERP e nunca confirma nota: a confirmação é manual, por pessoa autorizada no Sankhya.',
      'O corte padrão é 90 e o administrador muda em Caixa de entrada → Ajustes.',
      'Entregar documento testa o robô com um arquivo seu: mesmo motor e mesma decisão, sem gravar no ERP.',
    ],
  },
  {
    titulo: 'Assistente e Playground',
    corpo: [
      'O Assistente responde e age pelas mesmas funções das telas, e cada ação vira um chip na conversa. A conferência para o ERP é feita no detalhe do lançamento, sem gravar.',
      'No Playground, você faz uma pergunta que nenhuma tela previu e a analista investiga a base e desenha a resposta ao lado da conversa. O estudo fica guardado com versões e pode ser compartilhado por link. Quem tem o link vê sem login.',
      'A IA só responde na aplicação publicada e depois de conectada em Configurações da plataforma, aba AI.',
    ],
  },
  {
    titulo: 'Configuração e permissões',
    corpo: [
      'Configuração é restrita ao administrador. Enquanto ninguém for administrador, todos entram, e a tela avisa.',
      'Parâmetros: uma linha por empresa e tipo de documento, com TOP, natureza, centro, conta, tipo de título, produto padrão e limite de aprovação. O botão Sugerir do ERP preenche com o que a empresa praticou nos últimos 24 meses e mostra a evidência.',
      'Sincronizar com o ERP traz empresas, TOPs, naturezas, centros, contas e tipos de título. O cadastro à mão convive: a carga atualiza pelo código, sem duplicar.',
    ],
  },
];

export const textoDoGuia = () => GUIA.map((s) => `## ${s.titulo}\n${s.corpo.join('\n')}`).join('\n\n');
