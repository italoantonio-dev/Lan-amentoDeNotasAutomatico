// Tradutor da recusa do ERP. Mensagem que nao casa com nenhuma regra cai no caso generico: nunca adivinhe.

export interface Diagnostico {
  codigo: string;
  causa: string;
  acao: string;
  tentarDeNovo: boolean;
  corrigir?: 'MARCAR_FORNECEDOR' | 'MARCAR_CLIENTE';
  detalhe: string;
}

// ORA-06512 e ORA-04088 sao linhas internas do gatilho: dizem onde estourou, nao o que.
export function limparMensagem(mensagem: string): string {
  return String(mensagem ?? '')
    .split(/\r?\n/)
    .filter((l) => !/ORA-06512|ORA-04088/.test(l))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const REGRAS: { teste: RegExp; codigo: string; causa: string; acao: string; tentarDeNovo: boolean; corrigir?: 'MARCAR_FORNECEDOR' | 'MARCAR_CLIENTE' }[] = [
  { teste: /deve ser um fornecedor/i, codigo: 'NAO_FORNECEDOR', causa: 'O fornecedor não está marcado como fornecedor no cadastro do ERP.', acao: 'Corrija o cadastro e tente novamente.', tentarDeNovo: true, corrigir: 'MARCAR_FORNECEDOR' },
  { teste: /deve ser um cliente/i, codigo: 'NAO_CLIENTE', causa: 'O parceiro não está marcado como cliente no cadastro do ERP.', acao: 'Corrija o cadastro e tente novamente.', tentarDeNovo: true, corrigir: 'MARCAR_CLIENTE' },
  { teste: /ORA-00001|unique constraint|chave .*duplicad|j[aá] existe/i, codigo: 'DUPLICADO', causa: 'O ERP já tem um registro com estes dados.', acao: 'Confira no Sankhya antes de qualquer coisa: tentar de novo pode criar um segundo título.', tentarDeNovo: false },
  { teste: /ORA-01400|cannot insert NULL|n[aã]o pode ser nul/i, codigo: 'CAMPO_OBRIGATORIO', causa: 'Faltou um campo obrigatório na gravação.', acao: 'Confira TOP, natureza, centro e conta em Configuração → Parâmetros.', tentarDeNovo: true },
  { teste: /ORA-02291|integrity constraint|parent key/i, codigo: 'CODIGO_INEXISTENTE', causa: 'Um código enviado não existe no ERP (TOP, natureza, centro, conta ou produto).', acao: 'Sincronize os cadastros em Configuração e confira a classificação.', tentarDeNovo: true },
  { teste: /per[ií]odo.*(fechad|bloquead)|data.*(bloquead|fechad)|fechamento/i, codigo: 'PERIODO_FECHADO', causa: 'O período contábil desta data está fechado no ERP.', acao: 'Peça a reabertura no Sankhya ou corrija a data do documento.', tentarDeNovo: false },
  { teste: /HTTP 401|HTTP 403|n[aã]o autorizado|unauthor|invalid_client|PREENCHER|Authentication failed/i, codigo: 'CREDENCIAL', causa: 'A integração com o ERP não está configurada ou a credencial foi recusada.', acao: 'Confira a conexão sankhya em Integrações. Nada foi gravado.', tentarDeNovo: true },
  { teste: /timeout|tempo limite|HTTP 50\d|Bad Gateway|ECONN/i, codigo: 'SEM_RESPOSTA', causa: 'O ERP não respondeu a tempo.', acao: 'Confira no Sankhya se o título entrou antes de tentar de novo: a gravação pode ter acontecido.', tentarDeNovo: false },
];

export function diagnosticar(mensagem: string): Diagnostico {
  const detalhe = limparMensagem(mensagem);
  for (const r of REGRAS) {
    if (r.teste.test(mensagem)) return { codigo: r.codigo, causa: r.causa, acao: r.acao, tentarDeNovo: r.tentarDeNovo, corrigir: r.corrigir, detalhe };
  }
  return { codigo: 'GENERICO', causa: 'O ERP recusou a gravação.', acao: 'Leia a mensagem abaixo e confira o documento. Se persistir, leve a mensagem ao responsável pelo Sankhya.', tentarDeNovo: true, detalhe };
}
