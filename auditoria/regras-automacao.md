# Regras de automação — leitura, classificação e alçada

Base: DTNEG de 2025-11-01 a 2026-10-31 (12 meses completos); TGFFIN.RECDESP = -1 (despesa), PROVISAO = 'N' (sem provisao de pedido), CODEMP em 200,300,100,201,301,302,400,500,202,203,501,700,600. Toda regra abaixo é proposta: nada foi aplicado. As decisões ficam em `pendencias-aprovacao.csv`.

## 1. Separar o documento pela operação real [A019]

Ordem de prioridade (a primeira que casar vence):

| # | Categoria | Regra | Documentos | Confiança |
|---|---|---|---:|---|
| 1 | Folha vinda de integração (origem P) | título com ORIGEM = P (no período, todos na TOP 1607 e com naturezas de folha): folha que já entra por integração | 1103 | ALTA (origem, TOP e natureza coincidem) |
| 2 | CT-e / frete | chave de CT-e no título ou no cabeçalho da nota (avaliada logo depois da folha integrada); ou TOP de CT-e com natureza de frete | 3848 | ALTA (chave de CT-e) |
| 3 | NF-e de compra | título vindo de nota (ORIGEM = E), TOP de compra (TIPMOV = C) e cabeçalho com chave de NF-e | 6944 | ALTA (chave de NF-e) |
| 4 | Nota de serviço (sem chave NF-e) | título vindo de nota de compra sem chave de NF-e (nota de serviço municipal ou nota sem XML) | 4632 | MEDIA (ausência de chave; inclui energia e nota sem XML) |
| 5 | Guia de encargo de folha | natureza no grupo "Despesa com folha" e descrição com INSS, GPS, FGTS, IRRF ou sindical | 209 | ALTA (grupo contábil + descrição) |
| 6 | Folha de pagamento | natureza no grupo "Despesa com folha" e descrição de remuneração (salários, férias, rescisão, 13º salário, bônus, horas extras, premiação, indenização); comissão fica fora porque chega como nota de serviço | 37 | ALTA (grupo contábil + descrição) |
| 7 | Guia tributária | natureza no grupo de tributação ou descrição de tributo (ICMS, ISSQN, IRPJ, CSLL, PIS, COFINS, DIFAL, IR retido, taxa de importação, multa fiscal), ou tipo de título DARF/DAE/GNRE/GPS/DAS | 1706 | ALTA (grupo contábil, descrição ou tipo de título) |
| 8 | Adiantamento | TOP ou natureza de adiantamento | 883 | MEDIA (descrição) |
| 9 | Débito automático ou tarifa (sem documento a ler) | tipo de título débito automático ou TOP bancária | 3922 | MEDIA (descrição) |
| 10 | Boleto | linha digitável ou código de barras preenchido, ou tipo de título boleto | 1719 | MEDIA (descrição) |
| 11 | Nota de outra operação | veio de nota com TOP que não é de compra | 461 | MEDIA (descrição) |
| 12 | Outro financeiro | o que sobrar | 1367 | BAIXA (residual) |

Para o sistema: os quatro tipos atuais não cobrem CT-e, encargo de folha, adiantamento e débito automático (8862 documentos no período), e a nota de serviço (4632) precisa de leitura própria. Criar tipos novos é decisão de negócio (pendências). A folha de origem P já entra no ERP por integração (1103 documentos) e não deve ser lançada de novo por documento.

## 2. O que é parâmetro e o que é padrão do fornecedor

- **TOP:** vem do parâmetro por empresa e tipo; nunca do fornecedor. Onde a TOP dominante cobre pouco da categoria, a pessoa corrige no lançamento.
- **Natureza, centro, conta e tipo de título:** o parâmetro é o ponto de partida; o histórico do fornecedor só vale com ≥ 3 documentos e ≥ 70% no mesmo código (confiança MÉDIA) ou ≥ 5 e ≥ 90% (ALTA). Abaixo disso, a sugestão não é automática.
- **Cadastro inativo** nunca vira sugestão, mesmo que seja o mais usado.
- **Centro de outra empresa:** só como alerta (hipótese de convenção de código), nunca bloqueio.

## 3. Campos da leitura de PDF e XML

Preenchimento atual no ERP, por categoria [A084]:

| Categoria | Linha digitável | Código de barras | Nosso número | PIX (EMV) | Chave CT-e | Chave GNRE | Número | Série | Banco | Vencimento depois da emissão |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Guia tributária | 91% | 97.5% | 30% | 0% | 0% | 34.1% | 100% | 34.1% | 96.8% | 90.4% |
| Nota de serviço (sem chave NF-e) | 59.5% | 59.5% | 26.7% | 0% | 0% | 0% | 100% | 100% | 99.8% | 97.7% |
| Débito automático ou tarifa (sem documento a ler) | 0.1% | 0.2% | 97.6% | 0% | 0% | 0% | 99.9% | 0.2% | 100% | 3.7% |
| Guia de encargo de folha | 0% | 0% | 34.4% | 0% | 0% | 0% | 100% | 0% | 100% | 86.1% |
| NF-e de compra | 55.3% | 65.8% | 17.3% | 0% | 0% | 0% | 100% | 100% | 99.3% | 99.1% |
| Nota de outra operação | 0% | 0% | 1.5% | 0% | 0% | 0% | 100% | 100% | 89.1% | 7.6% |
| Boleto | 80.8% | 84.5% | 27.3% | 0% | 0% | 0% | 100% | 12.5% | 100% | 88.8% |
| Outro financeiro | 0% | 0% | 53.9% | 0% | 0% | 0% | 99.3% | 6% | 98% | 64.3% |
| Adiantamento | 3.5% | 15.6% | 47.8% | 0% | 0% | 0% | 100% | 0% | 100% | 12.2% |
| Folha de pagamento | 0% | 0% | 37.8% | 0% | 0% | 0% | 100% | 0% | 100% | 43.2% |
| Folha vinda de integração (origem P) | 0.8% | 0.7% | 20.1% | 0% | 0% | 0% | 100% | 0% | 100% | 96.6% |
| CT-e / frete | 5.3% | 5.3% | 4.1% | 0% | 60% | 0% | 100% | 100% | 99.7% | 100% |

Validação de uma amostra de 600 linhas digitáveis do ERP [A085]: 514 boletos bancários (47 dígitos), 72 de arrecadação (48 dígitos); 583 com dígitos verificadores corretos (97.2%). Nos boletos válidos, o vencimento calculado pelo fator bate com o do título em 90.4% e o valor embutido bate em 88.6%. **O campo CODBARRA guarda a linha digitável de 47 dígitos, não o código de barras de 44.**

| Documento | Campos obrigatórios | Validação | Onde gravar no ERP |
|---|---|---|---|
| NF-e (XML) | chave de acesso, CNPJ emitente, CNPJ destinatário, número, série, emissão, valor total, duplicatas (número, vencimento, valor), itens (código, descrição, quantidade, unitário, NCM, CFOP) | chave: módulo 11 + UF + AAMM + modelo 55 + CNPJ da chave = emitente; destinatário = empresa cadastrada; soma das duplicatas = valor da nota; soma dos itens ≈ total | TGFCAB/TGFITE pelo serviço do ERP; duplicatas viram TGFFIN |
| NFS-e (nota de serviço) | número da NFS-e, código de verificação, município, CNPJ prestador, CNPJ tomador, competência, valor dos serviços, ISS (retido ou não), retenções federais, vencimento | CNPJ prestador = fornecedor; tomador = empresa; não há chave de 44 dígitos: a confiança precisa de critério próprio (número + código de verificação + CNPJ), senão toda NFS-e cai em revisão | TGFCAB/TGFFIN pela TOP de serviço |
| NF-e (PDF/DANFE) | os mesmos, lidos do texto; chave de 44 dígitos | idem; campo sem rótulo fica "conferir" | idem |
| CT-e | chave do CT-e (modelo 57), emitente, tomador, valor, vencimento | chave módulo 11 + modelo 57; tomador = empresa | TGFFIN.CHAVECTE |
| Boleto | linha digitável (47), beneficiário (nome/CNPJ), pagador (CNPJ), vencimento, valor, nosso número | dígitos dos 3 campos (módulo 10) + DV geral (módulo 11); fator → vencimento; últimos 10 dígitos → valor; pagador = empresa | TGFFIN.LINHADIGITAVEL, CODBARRA (hoje com a linha), NOSSONUM, CODBCO |
| Guia (DARF, DAE, GNRE, GPS, DAS) | linha de arrecadação (48), código da receita, período de apuração, CNPJ contribuinte, vencimento, valor | 4 blocos de 11 + DV (módulo 10 ou 11 conforme o 3º dígito); CNPJ = empresa; GNRE: chave da GNRE | TGFFIN.LINHADIGITAVEL, CHAVENFEGNRE; tipo de título DARF/DAE/GNRE |
| Folha | competência, empresa, verba (salário, férias, 13º, rescisão), valor líquido, vencimento; por funcionário quando houver | competência = mês fechado; total = soma das verbas | TGFFIN com natureza do grupo folha; tipo de título crédito em conta |
| PIX | payload EMV (copia e cola), chave, valor, recebedor | CRC16 do payload; recebedor = fornecedor | TGFFIN.EMVPIX |
| Dados bancários do fornecedor | banco, agência, conta, chave PIX | conta e PIX do cadastro do parceiro, não do documento | TGFPAR.CODBCO, CODAGE, CODCTABCO, CHAVEPIX |

**Lacunas do leitor atual do sistema:** não lê linha digitável, código de barras, nosso número, PIX, chave de CT-e, código de receita nem competência; não confere fator de vencimento nem valor embutido. Hoje boletos e guias dependem de rótulo de texto. São melhorias a aprovar antes de ligar o robô para esses tipos.

## 4. Alçada

- Nenhum usuário do ERP tem alçada cadastrada [A087]: 285 usuários, 125 com e-mail, 0 com VLRMAXAUT.
- A simulação (`simulacao-alcadas.csv`) mostra, por empresa e categoria, quantos documentos e quanto valor ficariam abaixo de cada limite. Abaixo do limite o documento seria aprovado sem pessoa; acima, iria para aprovação. **Nenhum limite foi aplicado.**
- NF-e de compra (todas as empresas): 6944 documentos; mediana R$ 1.027, P80 R$ 13.172, P90 R$ 93.638, P95 R$ 174.844. Com limite de R$ 5.000: 72.6% dos documentos e 2.5% do valor sem aprovação.
- Nota de serviço (sem chave NF-e) (todas as empresas): 4633 documentos; mediana R$ 574, P80 R$ 3.000, P90 R$ 6.421, P95 R$ 11.669. Com limite de R$ 5.000: 87% dos documentos e 17.7% do valor sem aprovação.
- CT-e / frete (todas as empresas): 3848 documentos; mediana R$ 78, P80 R$ 266, P90 R$ 2.630, P95 R$ 3.850. Com limite de R$ 5.000: 98.3% dos documentos e 66.6% do valor sem aprovação.
- Boleto (todas as empresas): 1719 documentos; mediana R$ 403, P80 R$ 2.660, P90 R$ 8.553, P95 R$ 30.000. Com limite de R$ 5.000: 86.6% dos documentos e 8% do valor sem aprovação.
- Guia tributária (todas as empresas): 1706 documentos; mediana R$ 250, P80 R$ 2.262, P90 R$ 7.726, P95 R$ 20.636. Com limite de R$ 5.000: 87.9% dos documentos e 15.7% do valor sem aprovação.
- Folha vinda de integração (origem P) (todas as empresas): 1103 documentos; mediana R$ 3.101, P80 R$ 7.615, P90 R$ 13.719, P95 R$ 18.420. Com limite de R$ 5.000: 69.3% dos documentos e 28.2% do valor sem aprovação.
- Folha e guias têm valor alto e destino sensível: a recomendação é **não** aprovar automaticamente nenhum desses dois, independentemente de limite.
