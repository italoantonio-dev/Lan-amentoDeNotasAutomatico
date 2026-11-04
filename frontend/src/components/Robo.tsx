// O robo reage ao que esta acontecendo: por isso e SVG proprio, nao icone de biblioteca.
export default function Robo({ estado = 'ocioso', tamanho = 32 }: { estado?: 'ocioso' | 'pensando' | 'executando' | 'erro' | 'feliz'; tamanho?: number }) {
  const olho = estado === 'executando' ? 'var(--robo-acento)' : 'var(--robo-olho)';
  return (
    <svg className={`robo robo-${estado}`} width={tamanho} height={tamanho} viewBox="0 0 40 40" role="img" aria-label={`Robô ${estado}`}>
      <circle className="robo-halo" cx="20" cy="22" r="19" fill="var(--robo-halo)" />
      <line x1="20" y1="8" x2="20" y2="3.5" stroke="var(--robo-traco)" strokeWidth="1.75" />
      <circle className="robo-antena" cx="20" cy="3" r="2.2" fill="var(--robo-acento)" />
      <rect x="6" y="8" width="28" height="26" rx="8" fill="var(--robo-casco)" stroke="var(--robo-traco)" strokeWidth="1.5" />
      <rect x="10" y="13" width="20" height="13" rx="4" fill="var(--robo-visor)" />
      <rect className="robo-varredura" x="11" y="14" width="18" height="1.5" rx="0.75" fill="var(--robo-acento)" />
      {estado === 'erro' && (
        <g stroke="var(--danger)" strokeWidth="1.8" strokeLinecap="round">
          <path d="M14 17.5l3 3M17 17.5l-3 3M23 17.5l3 3M26 17.5l-3 3" />
        </g>
      )}
      {estado === 'feliz' && (
        <g fill="none" stroke={olho} strokeWidth="1.8" strokeLinecap="round">
          <path d="M13.5 21c.8-2 3-2 3.8 0M22.7 21c.8-2 3-2 3.8 0" />
        </g>
      )}
      {estado !== 'erro' && estado !== 'feliz' && (
        <g className="robo-olhos" fill={olho}>
          <circle cx="15.5" cy="19.5" r="2" />
          <circle cx="24.5" cy="19.5" r="2" />
        </g>
      )}
      <rect x="15" y="29" width="10" height="1.6" rx="0.8" fill="var(--robo-traco)" />
    </svg>
  );
}
