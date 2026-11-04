export function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(' ');
}

// Normaliza qualquer erro (Error, string, objeto da SDK { message, status, details }, aninhado)
// para texto legível. NUNCA renderize erro cru em toast/tela — vira "[object Object]".
export function getMitraErrorMessage(err: unknown): string {
  if (err == null) return 'Erro desconhecido';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message || 'Erro desconhecido';
  if (typeof err === 'object') {
    const o = err as Record<string, unknown>;
    for (const key of ['message', 'error', 'detail', 'details']) {
      const v = o[key];
      if (typeof v === 'string' && v.trim()) return v;
      if (v && typeof v === 'object') {
        const nested = getMitraErrorMessage(v);
        if (nested !== 'Erro desconhecido') return nested;
      }
    }
    if (typeof o.status === 'number') return `Erro ${o.status}`;
    try {
      const json = JSON.stringify(err);
      if (json && json !== '{}') return json;
    } catch { /* referência circular — ignora */ }
  }
  return 'Erro desconhecido';
}
