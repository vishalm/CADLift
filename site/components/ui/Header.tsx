import { links, site } from '@/content/site';
import Icon from './Icon';

/** Brand mark: a plan outline with one wall extruded. */
export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="4" y="12" width="20" height="16" rx="1.5" stroke="var(--color-cyan)" strokeWidth="2" />
      <path d="M4 12 10 6h20l-6 6M24 28l6-6V6" stroke="var(--color-paper)" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export default function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-ink/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-3.5 sm:px-10">
        <a href="#" className="flex items-center gap-2.5 font-display text-lg font-semibold">
          <Logo />
          {site.name}
        </a>
        <nav className="flex items-center gap-2" aria-label="Main">
          <a
            href={links.github}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-paper hover:bg-white/5"
          >
            <Icon name="github" size={18} />
            <span className="hidden sm:inline">{site.nav.github}</span>
          </a>
          <a href={links.docs} target="_blank" rel="noreferrer" className="rounded-full bg-paper px-4 py-2 text-sm font-semibold text-ink hover:bg-cyan">
            {site.nav.tryIt}
          </a>
        </nav>
      </div>
    </header>
  );
}
