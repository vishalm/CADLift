'use client';

import dynamic from 'next/dynamic';
import { useScroll } from 'framer-motion';
import { useRef } from 'react';
import { site } from '@/content/site';
import Canvas3D from '@/components/three/Canvas3D';
import BlueprintArt from '@/components/ui/BlueprintArt';
import { Eyebrow } from '@/components/ui/Reveal';
import { useLite } from '@/lib/useLite';

const ScrollScene = dynamic(() => import('@/components/three/ScrollScene'), {
  ssr: false,
  loading: () => <BlueprintArt className="h-full w-full p-16" label={site.a11y.sceneFallback} />,
});

/** Pinned exploded view: floor, walls, plants and furniture separate on scroll and re-stack on the way back. */
export default function Layers() {
  const ref = useRef<HTMLElement>(null);
  const lite = useLite();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  return (
    <section ref={ref} className="relative h-[260vh]" aria-labelledby="layers-title">
      <div className="sticky top-0 flex h-[100svh] flex-col overflow-hidden">
        <div className="relative z-10 flex flex-col items-center px-6 pt-24 text-center sm:pt-28">
          <Eyebrow index={site.sections.layers.index} label={site.sections.layers.eyebrow} className="mb-5" />
          <h2 id="layers-title" className="font-display text-4xl font-semibold tracking-tight sm:text-6xl">{site.layers.headline}</h2>
        </div>
        <Canvas3D className="flex-1" fallbackLabel={site.a11y.sceneFallback}>
          {(active) => (
            <ScrollScene active={active} progress={scrollYProgress} mode="explode" lite={lite} labels={lite ? undefined : site.layers.labels} label={site.a11y.modelAlt} />
          )}
        </Canvas3D>
      </div>
    </section>
  );
}
