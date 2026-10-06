'use client';

import dynamic from 'next/dynamic';
import { motion, useReducedMotion } from 'framer-motion';
import { links, site } from '@/content/site';
import Canvas3D from '@/components/three/Canvas3D';
import BlueprintArt from '@/components/ui/BlueprintArt';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Marquee from '@/components/ui/Marquee';
import { useLite } from '@/lib/useLite';

const ShowcaseScene = dynamic(() => import('@/components/three/ShowcaseScene'), {
  ssr: false,
  loading: () => <BlueprintArt className="h-full w-full p-16 opacity-60" label={site.a11y.sceneFallback} />,
});

const EASE = [0.22, 1, 0.36, 1] as const;
// Where each spec chip sits over the model (percent of the stage), plus its leader-line direction.
const CHIP_SPOTS = [
  { top: '18%', left: '14%' },
  { top: '30%', left: '78%' },
  { top: '72%', left: '10%' },
  { top: '80%', left: '70%' },
];

/** Split hero: kinetic headline left, model framed right with annotation chips, capability band below. */
export default function Hero() {
  const lite = useLite();
  const reduced = useReducedMotion();
  const enter = (delay: number, y = 24) =>
    reduced ? {} : { initial: { opacity: 0, y }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.9, ease: EASE, delay } };

  return (
    <section className="relative overflow-hidden pt-20" aria-labelledby="hero-title">
      <div className="mx-auto grid min-h-[calc(100svh-5rem)] max-w-[1440px] items-center gap-6 px-6 sm:px-10 lg:grid-cols-[0.9fr_1.1fr]">
        {/* Copy */}
        <div className="relative z-10 order-2 pb-10 lg:order-1 lg:pb-0">
          <motion.p {...enter(0.1)} className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.25em] text-cyan">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan shadow-[0_0_12px_#3dd6f5]" aria-hidden="true" />
            {site.hero.eyebrow}
          </motion.p>
          <h1 id="hero-title" className="mt-6 font-display text-[clamp(3.25rem,8.5vw,8.5rem)] font-semibold leading-[0.9] tracking-[-0.04em]">
            <motion.span {...enter(0.2, 40)} className="block">{site.hero.headlineTop}</motion.span>
            <motion.span {...enter(0.35, 40)} className="block text-outline">{site.hero.headlineBottom}</motion.span>
          </h1>
          <motion.p {...enter(0.55)} className="mt-8 max-w-md text-lg text-muted sm:text-xl">
            {site.hero.line}
          </motion.p>
          <motion.div {...enter(0.7)} className="mt-10 flex flex-wrap gap-3">
            <Button href={links.docs} trailingIcon="arrowRight">{site.hero.primary}</Button>
            <Button href={links.github} variant="ghost" icon="github">{site.hero.secondary}</Button>
          </motion.div>
        </div>

        {/* Model stage */}
        <div className="relative order-1 h-[52svh] min-h-[340px] lg:order-2 lg:h-[78svh]">
          <div className="glow-cyan pointer-events-none absolute inset-[-10%]" aria-hidden="true" />
          <div className="absolute inset-0 rounded-[2rem] border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent" aria-hidden="true" />
          {/* Corner ticks: drafting-frame feel */}
          {['left-3 top-3 border-l border-t', 'right-3 top-3 border-r border-t', 'left-3 bottom-3 border-l border-b', 'right-3 bottom-3 border-r border-b'].map((c) => (
            <span key={c} className={`pointer-events-none absolute h-5 w-5 border-cyan/60 ${c}`} aria-hidden="true" />
          ))}
          <Canvas3D className="absolute inset-0" fallbackLabel={site.a11y.sceneFallback}>
            {(active) => <ShowcaseScene active={active} intro lite={lite} label={site.a11y.modelAlt} cameraPosition={lite ? [22, 22, 26] : [19, 15, 21]} />}
          </Canvas3D>
          {!lite &&
            site.hero.specs.map((spec, i) => (
              <motion.div
                key={spec.label}
                initial={reduced ? false : { opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: EASE, delay: reduced ? 0 : 2.6 + i * 0.12 }}
                className="pointer-events-none absolute rounded-lg border border-white/15 bg-ink/75 px-3 py-2 backdrop-blur-md"
                style={CHIP_SPOTS[i]}
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">{spec.label}</p>
                <p className="font-display text-base font-semibold text-paper">{spec.value}</p>
              </motion.div>
            ))}
        </div>
      </div>

      <a href="#transform" className="absolute bottom-28 left-1/2 z-10 hidden -translate-x-1/2 text-muted hover:text-paper lg:block" aria-label={site.hero.scroll}>
        <Icon name="chevronDown" size={28} className="float-y" />
      </a>

      <Marquee items={site.marquee.capabilities} />
    </section>
  );
}
