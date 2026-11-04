// Identidade do documento: o hash do conteudo, nao o nome do arquivo.
export async function hashArquivo(arquivo: Blob): Promise<string> {
  const buffer = await arquivo.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
