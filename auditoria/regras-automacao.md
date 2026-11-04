# Regras de automação — leitura, classificação e alçada

Base: DTNEG de 2025-11-01 a 2026-10-31 (12 meses completos); TGFFIN.RECDESP = -1 (despesa), PROVISAO = 'N' (sem provisao de pedido), CODEMP em 200,300,100,201,301,302,400,500,202,203,501,700,600. Toda regra abaixo é proposta: nada foi aplicado. As decisões ficam em `pendencias-aprovacao.csv`.

## 1. Separar o documento pela operação real [A019]

Ordem de prioridade (a primeira que casar vence):

| # | Categoria | Regra | Documentos | Confiança |
|---|---|---|---:|---|
| 1 | Guia de encargo de folha | natureza no grupo "Despesa com folha" e descrição com INSS, GPS, FGTS, IRRF ou sindical | 299 | ALTA (grupo contábil + descrição) |
| 2 | Folha de pagamento | natureza no grupo "Despesa com folha" e descrição de remuneração (salários, férias, rescisão, 13º, bônus, horas extras, comissão, premiação, indenização) | 1239 | ALTA (grupo contábil + descrição) |
| 3 | Guia tributária | natureza no grupo de tributação ou descrição de tributo (ICMS, ISSQN, IRPJ, CSLL, PIS, COFINS, DIFAL, IR retido, taxa de importação, multa fiscal), ou tipo de título DARF/DAE/GNRE/GPS/DAS | 1707 | ALTA (grupo contábil + descrição) |
| 4 | CT-e / frete | título com chave de CT-e, ou TOP de CT-e com natureza de frete | 3493 | ALTA (grupo contábil + descrição) |
| 5 | Nota fiscal de compra | título vindo de nota (ORIGEM = E) com TOP de compra (TIPMOV = C) | 11693 | MEDIA |
| 6 | Adiantamento | TOP ou natureza de adiantamento | 883 | MEDIA |
| 7 | Débito automático / tarifa | tipo de título débito automático ou TOP bancária | 3922 | MEDIA |
| 8 | Boleto | linha digitável ou código de barras preenchido, ou tipo de título boleto | 1719 | MEDIA |
| 9 | Nota de outra operação | veio de nota com TOP que não é de compra | 461 | MEDIA |
| 10 | Outro financeiro | o que sobrar | 1415 | BAIXA (residual) |

Para o sistema: os quatro tipos atuais não cobrem CT-e, encargo de folha, adiantamento e débito automático (8597 documentos no período). Criar tipos novos é decisão de negócio (pendência).

## 2. O que é parâmetro e o que é padrão do fornecedor

- **TOP:** vem do parâmetro por empresa e tipo; nunca do fornecedor. Onde a TOP dominante cobre pouco da categoria, a pessoa corrige no lançamento.
- **Natureza, centro, conta e tipo de título:** o parâmetro é o ponto de partida; o histórico do fornecedor só vale com ≥ 3 documentos e ≥ 70% no mesmo código (confiança MÉDIA) ou ≥ 5 e ≥ 90% (ALTA). Abaixo disso, a sugestão não é automática.
- **Cadastro inativo** nunca vira sugestão, mesmo que seja o mais usado.
- **Centro de outra empresa:** só como alerta (hipótese de convenção de código), nunca bloqueio.

## 3. Campos da leitura de PDF e XML

Preenchimento atual no ERP, por categoria [A136]:

| Categoria | Linha digitável | Código de barras | Nosso número | PIX (EMV) | Chave CT-e | Chave GNRE | Número | Série | Banco | Vencimento depois da emissão |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Guia tributária | 91% | 97.5% | 29.9% | 0% | 0% | 34% | 100% | 34.2% | 96.8% | 90.3% |
| Débito automático / tarifa | 0.1% | 0.2% | 97.6% | 0% | 0% | 0% | 99.9% | 0.2% | 100% | 3.7% |
| Guia de encargo de folha | 2.7% | 2.7% | 47.2% | 0% | 0% | 0% | 100% | 30.1% | 100% | 88.3% |
| Nota fiscal de compra | 56.2% | 63.5% | 19.4% | 0% | 0% | 0% | 100% | 100% | 99.4% | 98.9% |
| Nota de outra operação | 0% | 0% | 1.5% | 0% | 0% | 0% | 100% | 100% | 89.1% | 7.6% |
| Outro financeiro | 0% | 0% | 54.5% | 0% | 0% | 0% | 99.3% | 5.8% | 98.1% | 65.7% |
| Adiantamento | 3.5% | 15.6% | 47.8% | 0% | 0% | 0% | 100% | 0% | 100% | 12.2% |
| Folha de pagamento | 0.8% | 0.7% | 18.7% | 0% | 0% | 0% | 100% | 13.3% | 100% | 92.6% |
| Boleto | 80.8% | 84.5% | 27.3% | 0% | 0% | 0% | 100% | 12.5% | 100% | 88.8% |
| CT-e / frete | 5.8% | 5.8% | 4.4% | 0% | 66.1% | 0% | 100% | 100% | 99.7% | 100% |

Validação de uma amostra de 600 linhas digitáveis do ERP [A137]: 514 boletos bancários (47 dígitos), 72 de arrecadação (48 dígitos); 583 com dígitos verificadores corretos (97.2%). Nos boletos válidos, o vencimento calculado pelo fator bate com o do título em 90.4% e o valor embutido bate em 88.8%. **O campo CODBARRA guarda a linha digitável de 47 dígitos, não o código de barras de 44.**

| Documento | Campos obrigatórios | Validação | Onde gravar no ERP |
|---|---|---|---|
| NF-e (XML) | chave de acesso, CNPJ emitente, CNPJ destinatário, número, série, emissão, valor total, duplicatas (número, vencimento, valor), itens (código, descrição, quantidade, unitário, NCM, CFOP) | chave: módulo 11 + UF + AAMM + modelo 55 + CNPJ da chave = emitente; destinatário = empresa cadastrada; soma das duplicatas = valor da nota; soma dos itens ≈ total | TGFCAB/TGFITE pelo serviço do ERP; duplicatas viram TGFFIN |
| NF-e (PDF/DANFE) | os mesmos, lidos do texto; chave de 44 dígitos | idem; campo sem rótulo fica "conferir" | idem |
| CT-e | chave do CT-e (modelo 57), emitente, tomador, valor, vencimento | chave módulo 11 + modelo 57; tomador = empresa | TGFFIN.CHAVECTE |
| Boleto | linha digitável (47), beneficiário (nome/CNPJ), pagador (CNPJ), vencimento, valor, nosso número | dígitos dos 3 campos (módulo 10) + DV geral (módulo 11); fator → vencimento; últimos 10 dígitos → valor; pagador = empresa | TGFFIN.LINHADIGITAVEL, CODBARRA (hoje com a linha), NOSSONUM, CODBCO |
| Guia (DARF, DAE, GNRE, GPS, DAS) | linha de arrecadação (48), código da receita, período de apuração, CNPJ contribuinte, vencimento, valor | 4 blocos de 11 + DV (módulo 10 ou 11 conforme o 3º dígito); CNPJ = empresa; GNRE: chave da GNRE | TGFFIN.LINHADIGITAVEL, CHAVENFEGNRE; tipo de título DARF/DAE/GNRE |
| Folha | competência, empresa, verba (salário, férias, 13º, rescisão), valor líquido, vencimento; por funcionário quando houver | competência = mês fechado; total = soma das verbas | TGFFIN com natureza do grupo folha; tipo de título crédito em conta |
| PIX | payload EMV (copia e cola), chave, valor, recebedor | CRC16 do payload; recebedor = fornecedor | TGFFIN.EMVPIX |
| Dados bancários do fornecedor | banco, agência, conta, chave PIX | conta e PIX do cadastro do parceiro, não do documento | TGFPAR.CODBCO, CODAGE, CODCTABCO, CHAVEPIX |

**Lacunas do leitor atual do sistema:** não lê linha digitável, código de barras, nosso número, PIX, chave de CT-e, código de receita nem competência; não confere fator de vencimento nem valor embutido. Hoje boletos e guias dependem de rótulo de texto. São melhorias a aprovar antes de ligar o robô para esses tipos.

## 4. Alçada

- Nenhum usuário do ERP tem alçada cadastrada [A138]: 285 usuários, 125 com e-mail, 0 com VLRMAXAUT.
- A simulação (`simulacao-alcadas.csv`) mostra, por empresa e categoria, quantos documentos e quanto valor ficariam abaixo de cada limite. Abaixo do limite o documento seria aprovado sem pessoa; acima, iria para aprovação. **Nenhum limite foi aplicado.**
- Nota fiscal de compra (todas as empresas): 11693 documentos; mediana R$ 692, P80 R$ 5.139, P90 R$ 26.186, P95 R$ 120.224. Com limite de R$ 5.000: 79.8% dos documentos e 3.9% do valor sem aprovação.
- Boleto (todas as empresas): 1719 documentos; mediana R$ 403, P80 R$ 2.660, P90 R$ 8.553, P95 R$ 30.000. Com limite de R$ 5.000: 86.6% dos documentos e 8% do valor sem aprovação.
- Guia tributária (todas as empresas): 1707 documentos; mediana R$ 249, P80 R$ 2.250, P90 R$ 7.725, P95 R$ 20.620. Com limite de R$ 5.000: 87.9% dos documentos e 15.7% do valor sem aprovação.
- Folha de pagamento (todas as empresas): 1239 documentos; mediana R$ 3.469, P80 R$ 9.594, P90 R$ 15.731, P95 R$ 23.292. Com limite de R$ 5.000: 64.8% dos documentos e 21.7% do valor sem aprovação.
- Folha e guias têm valor alto e destino sensível: a recomendação é **não** aprovar automaticamente nenhum desses dois, independentemente de limite.
