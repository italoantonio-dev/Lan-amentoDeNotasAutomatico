import { useRef, useState, type ComponentProps } from 'react';
import { FileSearch, FileUp } from 'lucide-react';
import { execSF, SF } from '../lib/api';
import { getMitraErrorMessage } from '../lib/utils';
import { Card } from '../components/ui/Card';
import Button from '../components/ui/Button';
import { SkeletonCards } from '../components/ui/Skeleton';
import { Aviso, CabecalhoPagina, EstadoVazio } from '../components/Comum';
import ConferenciaPedidos from '../components/ConferenciaPedidos';

interface Resposta { ok: boolean; erro?: string; origem?: string; resultado?: ComponentProps<typeof ConferenciaPedidos>['resultado'] }

// Conferencia avulsa: o XML e lido, comparado e descartado. Nao cria lancamento nem grava nada.
export default function ConferenciaNfePage() {
  const arquivo = useRef<HTMLInputElement>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [nome, setNome] = useState('');
  const [resposta, setResposta] = useState<Resposta | null>(null);

  async function conferir(f: File) {
    setCarregando(true);
    setErro('');
    setResposta(null);
    setNome(f.name);
    try {
      if (!/\.xml$/i.test(f.name)) throw new Error('A conferência com pedidos precisa do XML da NF-e.');
      if (f.size > 3 * 1024 * 1024) throw new Error('Arquivo acima de 3 MB.');
      const buffer = new Uint8Array(await f.arrayBuffer());
      let bin = '';
      for (let i = 0; i < buffer.length; i += 0x8000) bin += String.fromCharCode(...buffer.subarray(i, i + 0x8000));
      const r = await execSF<Resposta>(SF.conferirNfePedidos, { nome: f.name, conteudoB64: btoa(bin) });
      if (!r.ok) setErro(r.erro ?? 'Não consegui conferir a nota.');
      else setResposta(r);
    } catch (e) {
      setErro(getMitraErrorMessage(e));
    } finally {
      setCarregando(false);
    }
  }

  const botao = <Button disabled={carregando} onClick={() => arquivo.current?.click()}><FileUp size={16} /> {carregando ? 'Conferindo...' : 'Escolher XML'}</Button>;

  return (
    <div className="p-4 md:p-8">
      <CabecalhoPagina titulo="Conferência de NF-e" descricao="Compara o XML da nota com os pedidos de compra: fornecedor, empresa, produtos, quantidades, preços e vínculos. Somente leitura: não cria nota, não altera pedido e não gera provisão." acoes={botao} />
      <input ref={arquivo} type="file" accept=".xml" className="hidden" onChange={(e) => { const a = e.target.files?.[0]; if (a) conferir(a); e.target.value = ''; }} />
      {erro && <Aviso tipo="danger">{erro}</Aviso>}
      {carregando && <SkeletonCards />}
      {!carregando && !resposta && !erro && (
        <Card><EstadoVazio icone={<FileSearch size={20} />} titulo="Nenhuma nota conferida ainda" descricao="Piloto: pedidos de compra de revenda de peças (TOP 1314), notas TOP 1419 e 1420. O arquivo é lido, comparado e descartado." acao={botao} /></Card>
      )}
      {!carregando && resposta?.resultado && (
        <div className="flex flex-col gap-3">
          <p className="text-[12.5px] text-fg-subtle break-all">{nome}</p>
          <ConferenciaPedidos resultado={resposta.resultado} origem={resposta.origem} />
        </div>
      )}
    </div>
  );
}
