/** A cowrie shell, seen from below: the coin's mark. */
export function Cowrie({ className = "", title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 40 52" className={className} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <path d="M20 2C9 2 3 13 3 27s7 23 17 23 17-9 17-23S31 2 20 2Z" fill="currentColor" opacity=".18" />
      <path d="M20 2C9 2 3 13 3 27s7 23 17 23 17-9 17-23S31 2 20 2Z" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M20 8c-2.4 6-2.4 30 0 38" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      {[13, 18, 23, 28, 33, 38].map((y) => (
        <g key={y} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <path d={`M18.6 ${y}h-3.4`} />
          <path d={`M21.4 ${y}h3.4`} />
        </g>
      ))}
    </svg>
  );
}
