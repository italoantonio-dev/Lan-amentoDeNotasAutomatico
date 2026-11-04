import { Fragment } from 'react';
import type { ReactNode } from 'react';

// Formata a resposta sem dangerouslySetInnerHTML: negrito, codigo e listas simples.
function trechos(linha: string): ReactNode[] {
  return linha.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong>;
    if (/^`[^`]+`$/.test(p)) return <code key={i} className="px-1 py-0.5 rounded bg-surface-active text-[12.5px]">{p.slice(1, -1)}</code>;
    return <Fragment key={i}>{p}</Fragment>;
  });
}

export default function TextoRobo({ texto }: { texto: string }) {
  const linhas = texto.split('\n');
  return (
    <div className="text-[14px] leading-relaxed">
      {linhas.map((l, i) => {
        const lista = /^\s*[-*•]\s+(.*)$/.exec(l);
        if (lista) return <div key={i} className="flex gap-2 pl-1"><span aria-hidden>•</span><span>{trechos(lista[1])}</span></div>;
        const titulo = /^#{1,4}\s+(.*)$/.exec(l);
        if (titulo) return <div key={i} className="font-semibold mt-2">{trechos(titulo[1])}</div>;
        return <div key={i} className={l.trim() ? '' : 'h-2'}>{trechos(l)}</div>;
      })}
    </div>
  );
}
