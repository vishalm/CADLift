'use client';

import dynamic from 'next/dynamic';
import { motion, useReducedMotion } from 'framer-motion';
import { site } from '@/content/site';
import Canvas3D from '@/components/three/Canvas3D';
import BlueprintArt from '@/components/ui/BlueprintArt';
import { SectionTitle } from '@/components/ui/Reveal';

const ShowcaseScene = dynamic(() => import('@/components/three/ShowcaseScene'), {
  ssr: false,
  loading: () => <BlueprintArt className="h-full w-full p-10" label={site.a11y.sceneFallback} />,
});

/** Neutral geometric marks (not trademark logos), one per destination. */
const GLYPHS = [
  <circle key="c" cx="12" cy="12" r="7" />,
  <path key="cube" d="M12 3 20 7.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12 4 7.5" />,
  <path key="u" d="M6 4v9a6 6 0 0 0 12 0V4" />,
  <path key="s" d="M5 5h14v14H5zM5 12h14" />,
  <path key="f" d="M12 3 21 12 12 21 3 12z" />,
  <path key="a" d="M4 20 12 4l8 16M8 13h8" />,
  <path key="p" d="M6 20h12M8 20V10h8v10M10 10V6h4v4" />,
];

// Badge positions as % of the stage (left column, then right column).
const LEFT = [16, 36, 56, 76];
const RIGHT = [24, 50, 76];

export default function Export() {
  const reduced = useReducedMotion();
  const { formats, targets } = site.export;
  const spots = targets.map((name, i) => (i < LEFT.length ? { name, x: 9, y: LEFT[i] } : { name, x: 91, y: RIGHT[i - LEFT.length] }));

  return (
    <section className="mx-auto max-w-[1440px] px-6 py-32 sm:px-10" aria-labelledby="export-title">
      <SectionTitle id="export-title" index={site.sections.export.index} eyebrow={site.sections.export.eyebrow} headline={site.export.headline} />

      <div className="relative mt-16 h-[520px] md:h-[600px]">
        {/* Curved links from the model to each destination */}
        <svg className="absolute inset-0 hidden h-full w-full md:block" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {spots.map((s, i) => {
            const fromX = s.x < 50 ? 38 : 62;
            const d = `M ${fromX} 50 C ${(fromX + s.x) / 2} 50, ${(fromX + s.x) / 2} ${s.y}, ${s.x < 50 ? s.x + 7 : s.x - 7} ${s.y}`;
            return (
              <g key={s.name}>
                <path d={d} fill="none" stroke="rgb(242 241 238 / 0.1)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                <path d={d} fill="none" stroke="var(--color-cyan)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" pathLength={1} className="flow" style={{ animationDelay: `${i * 0.3}s` }} />
              </g>
            );
          })}
        </svg>

        {/* Model with orbiting format chips */}
        <div className="absolute left-1/2 top-1/2 h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2 md:h-[420px] md:w-[420px]">
          <Canvas3D className="absolute inset-[12%] overflow-hidden rounded-full" fallbackLabel={site.a11y.sceneFallback}>
            {(active) => <ShowcaseScene active={active} label={site.a11y.modelAlt} cameraPosition={[24, 20, 26]} autoRotateSpeed={1.2} interactive={false} />}
          </Canvas3D>
          <div className="pointer-events-none absolute inset-0 rounded-full border border-dashed border-white/15" />
          <motion.div
            className="absolute inset-0"
            animate={reduced ? undefined : { rotate: 360 }}
            transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
          >
            {formats.map((f, i) => {
              const a = (i / formats.length) * Math.PI * 2 - Math.PI / 2;
              return (
                <motion.span
                  key={f}
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan/50 bg-ink px-4 py-1.5 font-display text-sm font-semibold text-cyan shadow-[0_0_30px_rgba(61,214,245,0.25)]"
                  style={{ left: `${50 + Math.cos(a) * 50}%`, top: `${50 + Math.sin(a) * 50}%` }}
                  animate={reduced ? undefined : { rotate: -360 }}
                  transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
                >
                  {f}
                </motion.span>
              );
            })}
          </motion.div>
        </div>

        {/* Destinations */}
        <ul className="absolute inset-x-0 bottom-0 flex flex-wrap justify-center gap-2 md:static">
          {spots.map((s, i) => (
            <li
              key={s.name}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-surface px-3 py-2 text-sm font-medium text-paper md:absolute md:left-[var(--x)] md:top-[var(--y)] md:-translate-x-1/2 md:-translate-y-1/2"
              style={{ ['--x' as string]: `${s.x}%`, ['--y' as string]: `${s.y}%` }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" className="text-muted" aria-hidden="true">
                {GLYPHS[i % GLYPHS.length]}
              </svg>
              {s.name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
