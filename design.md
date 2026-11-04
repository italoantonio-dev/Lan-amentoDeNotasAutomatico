# Design — Lançamentos Fiscais e Financeiros

## Referência
Linear + Stripe Dashboard, tom claro: sobriedade, densidade e legibilidade.

## Identidade (sobre o design system Mitra)
- Marca: `--brand` #2E3C50 (ardósia) nas ações e no item ativo; verde #66CB66 como acento (barra do item ativo, aba ativa, anel de foco, progresso). Texto sobre a marca: branco (~10:1).
- Fundo #f8fafc, superfície #ffffff, borda #e2e8f0, texto #0f172a, secundário #64748b.
- Semânticos: receita/pago #2F8F3F, despesa #dc2626, pendente #d97706.
- **Identidade provisória “Mitra”** (título, navegação, favicon). Troca de duas formas: o cliente envia a logo (aplicada exatamente como veio, em `public/`), ou a sincronização com o ERP traz os nomes reais das empresas.

## Desvios do design system (pedidos no documento)
- Controles de 40px (`--altura-controle`) e cartões com raio 16px e `--shadow-md`.
- Logo “Mitra” no topo da navegação, a pedido.
- Robô em SVG próprio com estados (ocioso, pensando, executando, erro, feliz) e paleta `--robo-*`; o visor escuro é detalhe de ícone, não mudança de tom.
- Microinterações de 120 a 320 ms, desligadas em `prefers-reduced-motion`.

## Componentes
- Navegação: `.nav-item` com barra verde que cresce.
- KPIs: `.cartao` clicável, ícone em círculo com cor por métrica.
- Tabelas: `.tabela`, números à direita com `tabular-nums`, situação em `StatusBadge` (âmbar aguardando, azul aprovado, verde lançado, vermelho rejeitado/erro, neutro revisão).
- Gráficos: `ShadcnBarChart` com a paleta fixa dos gráficos.
- Formulários: `Select`, `MultiSelect`, `DatePicker`, `Checkbox`, `Radio` do template; nenhum controle nativo.

## Por tela
- Painel: avisos de configuração, 4 KPIs, 2 gráficos com filtro cruzado, últimos lançamentos.
- Detalhe: duas colunas (dados, classificação, itens, trilha | aprovação, envio ao ERP, decisões).
- Assistente e Playground: conversa em fundo com grade de 26px; bolha do usuário em ardósia, do robô em `--robo-bolha`.
