/** Infinite kinetic band of words separated by small blueprint diamonds. Decorative: hidden from screen readers. */
export default function Marquee({ items, reverse = false, outline = false }: { items: readonly string[]; reverse?: boolean; outline?: boolean }) {
  const row = (
    <ul className="flex shrink-0 items-center gap-10 pr-10">
      {items.map((item, i) => (
        <li key={`${item}-${i}`} className="flex items-center gap-10">
          <span className={`font-display text-4xl font-semibold tracking-tight sm:text-6xl ${outline ? 'text-outline' : 'text-paper'}`}>{item}</span>
          <svg width="14" height="14" viewBox="0 0 14 14" className="text-cyan" aria-hidden="true">
            <path d="M7 0 14 7 7 14 0 7z" fill="currentColor" />
          </svg>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="relative overflow-hidden border-y border-white/10 py-8 [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]" aria-hidden="true">
      <div className={`marquee flex w-max ${reverse ? 'marquee-reverse' : ''}`}>
        {row}
        {row}
      </div>
    </div>
  );
}
