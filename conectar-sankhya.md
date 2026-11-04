# Conectar o Sankhya

A conexão `sankhya` já existe na aba de Integrações. **Neste projeto ela já está conectada (produção)** e a sincronização de cadastros funcionou. Siga este guia ao replicar o sistema ou ao trocar a credencial.

## Os três campos
| Campo | Onde sai |
|---|---|
| Client ID | Portal do Desenvolvedor Sankhya (areadev.sankhya.com.br) → Minhas Soluções → criar solução do tipo Integração |
| Client Secret | Mesma tela do Client ID |
| X-Token | Tela **Configurações Gateway** do Sankhya OM (outro lugar, não o portal) |

## Passo a passo
1. Configurações da plataforma → **Integrações** → conexão `sankhya`.
2. Troque os três `PREENCHER` pelos valores reais e salve. O sistema não altera credencial por código: o caminho é sempre a tela.
3. Em **Configuração → Sincronizar com o ERP**, confira se as empresas chegam.
4. Cadastre **uma linha em Configuração → Parâmetros** para cada empresa e tipo de documento. Sem ela, nada cabe em alçada e até uma leitura perfeita para em aprovação.

## Produção ou homologação
| Template | Quando |
|---|---|
| `sankhya_gateway_mitra` | Tente primeiro |
| `sankhya_oauth` | Gateway de **produção** (o que este sistema cria) |
| `sankhya_oauth_sandbox` | Base de **homologação** |

Para usar homologação: exclua a conexão `sankhya` e crie de novo **com o mesmo slug `sankhya`**, escolhendo `sankhya_oauth_sandbox`. Nenhuma função precisa mudar: todas procuram a conexão pelo slug.

## Se der errado
| Sintoma | Causa | Correção |
|---|---|---|
| HTTP 401 com credencial certa | Credencial de homologação em template de produção | Recrie com `sankhya_oauth_sandbox`, mesmo slug |
| “Integração não configurada” | Ainda há `PREENCHER` | Passo 2 |
| Sincroniza 0 linhas | O ERP recusou a consulta (vem com HTTP 200) | Leia a mensagem na tela; confira permissão do usuário da integração |
| Tudo para em aprovação | Falta parâmetro | Passo 4 |
