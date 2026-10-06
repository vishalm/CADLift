'use client';

import dynamic from 'next/dynamic';
import { links, site } from '@/content/site';
import Canvas3D from '@/components/three/Canvas3D';
import BlueprintArt from '@/components/ui/BlueprintArt';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { useLite } from '@/lib/useLite';

const ShowcaseScene = dynamic(() => import('@/components/three/ShowcaseScene'), {
  ssr: false,
  loading: () => <BlueprintArt className="h-full w-full p-16 opacity-60" label={site.a11y.sceneFallback} />,
});

export default function FinalCta() {
  const lite = useLite();
  const year = new Date().getFullYear();
  return (
    <>
      <section className="relative h-[90svh] min-h-[560px] overflow-hidden" aria-labelledby="cta-title">
        <Canvas3D className="absolute inset-0" fallbackLabel={site.a11y.sceneFallback}>
          {(active) => <ShowcaseScene active={active} dusk lite={lite} label={site.a11y.modelAlt} autoRotateSpeed={0.3} cameraPosition={[18, 9, 20]} />}
        </Canvas3D>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink via-transparent to-ink" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_45%_35%_at_50%_50%,rgb(11_13_16/0.75),transparent)]" />
        <div className="pointer-events-none relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
          <h2 id="cta-title" className="font-display text-5xl font-semibold tracking-tight sm:text-8xl">{site.finalCta.headline}</h2>
          <div className="pointer-events-auto mt-10 flex flex-wrap justify-center gap-3">
            <Button href={links.docs} trailingIcon="arrowRight">{site.hero.primary}</Button>
            <Button href={links.github} variant="ghost" icon="github">{site.hero.secondary}</Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted sm:flex-row sm:px-10">
          <div className="flex items-center gap-2">
            <Icon name="scale" size={16} className="text-cyan" />
            <span className="font-display font-semibold text-paper">{site.name}</span>
            <span>· {year}</span>
          </div>
          <nav className="flex flex-wrap items-center gap-5" aria-label="Footer">
            <a href={links.github} target="_blank" rel="noreferrer" className="hover:text-paper">{site.footer.github}</a>
            <a href={links.docs} target="_blank" rel="noreferrer" className="hover:text-paper">{site.footer.docs}</a>
            <a href={links.license} target="_blank" rel="noreferrer" className="hover:text-paper">{site.footer.license}</a>
            <span>
              {site.footer.createdBy}{' '}
              <a href={links.creator} target="_blank" rel="noreferrer" className="text-paper hover:text-cyan">{site.creator}</a>
            </span>
          </nav>
        </div>
      </footer>
    </>
  );
}
