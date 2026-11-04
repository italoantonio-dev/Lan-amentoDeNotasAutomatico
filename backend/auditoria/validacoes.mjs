// Validacoes de identificadores usadas na auditoria (e que o leitor de documentos deve aplicar).

export const soDigitos = (v) => String(v ?? '').replace(/\D/g, '');

export function cnpjValido(v) {
  const d = soDigitos(v);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const dv = (base, pesos) => { const s = base.split('').reduce((a, n, i) => a + Number(n) * pesos[i], 0) % 11; return s < 2 ? 0 : 11 - s; };
  const d1 = dv(d.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = dv(d.slice(0, 12) + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d.endsWith(`${d1}${d2}`);
}

export function cpfValido(v) {
  const d = soDigitos(v);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n) => { const s = d.slice(0, n).split('').reduce((a, x, i) => a + Number(x) * (n + 1 - i), 0) % 11; return s < 2 ? 0 : 11 - s; };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

const mod10 = (num) => {
  let soma = 0; let peso = 2;
  for (let i = num.length - 1; i >= 0; i--) { let p = Number(num[i]) * peso; if (p > 9) p = Math.floor(p / 10) + (p % 10); soma += p; peso = peso === 2 ? 1 : 2; }
  const r = soma % 10; return r === 0 ? 0 : 10 - r;
};
const mod11Boleto = (num) => {
  let soma = 0; let peso = 2;
  for (let i = num.length - 1; i >= 0; i--) { soma += Number(num[i]) * peso; peso = peso === 9 ? 2 : peso + 1; }
  const r = 11 - (soma % 11); return r === 0 || r === 10 || r === 11 ? 1 : r;
};
const mod11Arrec = (num) => {
  let soma = 0; let peso = 2;
  for (let i = num.length - 1; i >= 0; i--) { soma += Number(num[i]) * peso; peso = peso === 9 ? 2 : peso + 1; }
  const r = soma % 11; return r === 0 || r === 1 ? 0 : 11 - r;
};

// Fator de vencimento: base 07/10/1997; desde 22/02/2025 o fator reinicia em 1000.
function datasDoFator(fator) {
  const f = Number(fator);
  if (!f) return [];
  const dia = 86400000;
  return [new Date(Date.UTC(1997, 9, 7) + f * dia), new Date(Date.UTC(2025, 1, 22) + (f - 1000) * dia)].map((d) => d.toISOString().slice(0, 10));
}

// Linha digitavel: 47 digitos (boleto bancario) ou 48 (arrecadacao: guias, contas de consumo).
export function analisarLinha(linha) {
  const d = soDigitos(linha);
  if (d.length === 47) {
    const campos = [[0, 9], [10, 20], [21, 31]];
    const camposOk = campos.every(([i, f]) => mod10(d.slice(i, f)) === Number(d[f]));
    const barras = d.slice(0, 4) + d.slice(33, 47) + d.slice(4, 9) + d.slice(10, 20) + d.slice(21, 31);
    const geralOk = mod11Boleto(barras) === Number(d[32]);
    return { tipo: 'BOLETO', valida: camposOk && geralOk, banco: d.slice(0, 3), vencimentos: datasDoFator(d.slice(33, 37)), valor: Number(d.slice(37, 47)) / 100 };
  }
  if (d.length === 48 && d[0] === '8') {
    const ref = d[2];
    const fn = ref === '6' || ref === '7' ? mod10 : mod11Arrec;
    const valida = [0, 12, 24, 36].every((i) => fn(d.slice(i, i + 11)) === Number(d[i + 11]));
    const barras = [0, 12, 24, 36].map((i) => d.slice(i, i + 11)).join('');
    return { tipo: 'ARRECADACAO', valida, segmento: d[1], valor: ref === '6' || ref === '8' ? Number(barras.slice(4, 15)) / 100 : null, vencimentos: [] };
  }
  return { tipo: 'INVALIDO', valida: false, vencimentos: [] };
}
