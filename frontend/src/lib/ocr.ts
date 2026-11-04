// Leitura no navegador. pdf.js e tesseract so carregam no primeiro documento: pesam ~1,3 MB.

export interface CampoLido {
  valor: string;
  confianca: 'ALTA' | 'CONFERIR';
}
export interface ItemLido {
  descricao: string;
  quantidade: number;
  valorUnitario: number;
}
export interface LeituraDocumento {
  texto: string;
  origem: 'XML' | 'PDF_TEXTO' | 'OCR' | 'SEM_LEITURA';
  campos: Record<string, CampoLido>;
  itens: ItemLido[];
}

type Etapa = (etapa: string, progresso?: number) => void;

const soDigitos = (v: string) => (v || '').replace(/\D/g, '');

function chaveValida(chave: string): boolean {
  if (!/^\d{44}$/.test(chave)) return false;
  let soma = 0;
  let peso = 2;
  for (let i = 42; i >= 0; i--) {
    soma += Number(chave[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const r = soma % 11;
  return (r < 2 ? 0 : 11 - r) === Number(chave[43]);
}

const dataIso = (s: string) => {
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(s || '');
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
};
const moedaNumero = (s: string) => String(Number(s.replace(/\./g, '').replace(',', '.')) || '');

function rotulado(texto: string, rotulos: string[], padrao: RegExp, alcance = 80): string {
  for (const r of rotulos) {
    const m = new RegExp(`${r}[\\s\\S]{0,${alcance}}?${padrao.source}`, 'i').exec(texto);
    if (m) return m[m.length - 1];
  }
  return '';
}

export function extrairCampos(textoBruto: string): Record<string, CampoLido> {
  const texto = textoBruto.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const campos: Record<string, CampoLido> = {};
  const MOEDA = /(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/;

  let chave = '';
  for (const m of texto.matchAll(/\d(?:[ .]?\d){43,}/g)) {
    const d = soDigitos(m[0]);
    for (let i = 0; i + 44 <= d.length && !chave; i++) if (chaveValida(d.slice(i, i + 44))) chave = d.slice(i, i + 44);
    if (chave) break;
  }
  if (chave) {
    campos.chave = { valor: chave, confianca: 'ALTA' };
    campos.cnpj = { valor: chave.slice(6, 20), confianca: 'ALTA' };
    campos.numeroDoc = { valor: String(Number(chave.slice(25, 34))), confianca: 'ALTA' };
    campos.serie = { valor: String(Number(chave.slice(22, 25))), confianca: 'ALTA' };
  } else {
    const cnpj = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/.exec(texto);
    if (cnpj) campos.cnpj = { valor: soDigitos(cnpj[0]), confianca: 'CONFERIR' };
    const numero = rotulado(texto, ['NUMERO\\s+DO\\s+DOCUMENTO', 'NOTA\\s+FISCAL\\s*(?:N|NO|NUMERO)?', 'NF-?E\\s*N'], /(\d[\d.]{0,14})/, 20);
    if (numero) campos.numeroDoc = { valor: numero.replace(/\./g, ''), confianca: 'CONFERIR' };
  }

  const valor = rotulado(texto, ['VALOR\\s+TOTAL\\s+DA\\s+NOTA', 'V\\.?\\s*TOTAL\\s+DA\\s+NOTA', 'VALOR\\s+DO\\s+DOCUMENTO', 'VALOR\\s+COBRADO', 'VALOR\\s+TOTAL', 'TOTAL\\s+A\\s+PAGAR', 'VALOR\\s+A\\s+PAGAR', 'TOTAL\\s+LIQUIDO'], MOEDA);
  if (valor) {
    campos.valorTotal = { valor: moedaNumero(valor), confianca: 'ALTA' };
  } else {
    const todos = [...texto.matchAll(new RegExp(MOEDA.source, 'g'))].map((m) => Number(m[1].replace(/\./g, '').replace(',', '.')));
    if (todos.length) campos.valorTotal = { valor: String(Math.max(...todos)), confianca: 'CONFERIR' };
  }

  const emissao = dataIso(rotulado(texto, ['DATA\\s+(?:DE|DA)?\\s*EMISSAO', 'EMISSAO', 'DATA\\s+DO\\s+DOCUMENTO', 'APURACAO', 'COMPETENCIA'], /(\d{2}\/\d{2}\/\d{4})/));
  if (emissao) campos.dataEmissao = { valor: emissao, confianca: 'CONFERIR' };
  const vencimento = dataIso(rotulado(texto, ['VENCIMENTO', 'VENCTO', 'DATA\\s+DE\\s+VENC'], /(\d{2}\/\d{2}\/\d{4})/));
  if (vencimento) campos.dataVencimento = { valor: vencimento, confianca: 'CONFERIR' };

  const nome = /(?:EMITENTE|RAZAO\s+SOCIAL|BENEFICIARIO|CEDENTE)[:\s]+([A-Z0-9][^\n]{2,80})/i.exec(texto);
  if (nome) campos.nome = { valor: nome[1].trim(), confianca: 'CONFERIR' };
  return campos;
}

function lerXml(xml: string): LeituraDocumento {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const q = (ctx: Element | Document, tag: string) => ctx.getElementsByTagName(tag)[0]?.textContent?.trim() ?? '';
  const emit = doc.getElementsByTagName('emit')[0];
  const ide = doc.getElementsByTagName('ide')[0];
  const dup = [...doc.getElementsByTagName('dup')].map((d) => q(d, 'dVenc')).filter(Boolean).sort();
  const inf = doc.getElementsByTagName('infNFe')[0];
  const chave = soDigitos(inf?.getAttribute('Id') ?? '') || q(doc, 'chNFe');
  const a = (valor: string): CampoLido => ({ valor, confianca: 'ALTA' });
  const campos: Record<string, CampoLido> = {};
  if (chave) campos.chave = a(chave);
  if (emit) {
    campos.cnpj = a(q(emit, 'CNPJ') || q(emit, 'CPF'));
    campos.nome = a(q(emit, 'xNome'));
  }
  if (ide) {
    campos.numeroDoc = a(q(ide, 'nNF'));
    campos.serie = a(q(ide, 'serie'));
    campos.dataEmissao = a((q(ide, 'dhEmi') || q(ide, 'dEmi')).slice(0, 10));
  }
  campos.valorTotal = a(q(doc, 'vNF'));
  if (dup.length) campos.dataVencimento = a(dup[0]);
  const itens = [...doc.getElementsByTagName('prod')].map((p) => ({
    descricao: q(p, 'xProd').slice(0, 300),
    quantidade: Number(q(p, 'qCom')) || 1,
    valorUnitario: Number(q(p, 'vUnCom')) || Number(q(p, 'vProd')) || 0,
  }));
  return { texto: xml.slice(0, 60000), origem: 'XML', campos, itens };
}

async function reconhecer(imagem: HTMLCanvasElement | Blob, etapa: Etapa, rotulo: string): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('por', 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') etapa(rotulo, Math.round(m.progress * 100));
    },
  });
  try {
    const { data } = await worker.recognize(imagem);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

async function lerPdf(arquivo: File, etapa: Etapa): Promise<LeituraDocumento> {
  etapa('Carregando o leitor de PDF');
  const pdfjs = await import('pdfjs-dist');
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const pdf = await pdfjs.getDocument({ data: await arquivo.arrayBuffer() }).promise;
  const paginas = Math.min(pdf.numPages, 8);
  let texto = '';
  for (let i = 1; i <= paginas; i++) {
    etapa(`Lendo a página ${i} de ${paginas}`, Math.round(((i - 1) / paginas) * 100));
    const pg = await pdf.getPage(i);
    const conteudo = await pg.getTextContent();
    texto += `${conteudo.items.map((it) => ('str' in it ? it.str : '')).join(' ')}\n`;
  }
  if (texto.replace(/\s/g, '').length >= 40) return { texto, origem: 'PDF_TEXTO', campos: extrairCampos(texto), itens: [] };

  // Sem camada de texto: e foto de papel. OCR pagina a pagina.
  let ocr = '';
  const paginasOcr = Math.min(pdf.numPages, 3);
  for (let i = 1; i <= paginasOcr; i++) {
    const pg = await pdf.getPage(i);
    const vp = pg.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = vp.width;
    canvas.height = vp.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) break;
    await pg.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
    ocr += `${await reconhecer(canvas, etapa, `Reconhecendo a página ${i} de ${paginasOcr}`)}\n`;
  }
  return { texto: ocr, origem: 'OCR', campos: extrairCampos(ocr), itens: [] };
}

export async function lerArquivo(arquivo: File, etapa: Etapa = () => {}): Promise<LeituraDocumento> {
  const nome = arquivo.name.toLowerCase();
  if (nome.endsWith('.xml') || arquivo.type.includes('xml')) {
    etapa('Lendo o XML');
    return lerXml(await arquivo.text());
  }
  if (nome.endsWith('.pdf') || arquivo.type === 'application/pdf') return lerPdf(arquivo, etapa);
  if (arquivo.type.startsWith('image/')) {
    const texto = await reconhecer(arquivo, etapa, 'Reconhecendo a imagem');
    return { texto, origem: 'OCR', campos: extrairCampos(texto), itens: [] };
  }
  return { texto: '', origem: 'SEM_LEITURA', campos: {}, itens: [] };
}
