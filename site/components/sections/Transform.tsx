'use client';

import dynamic from 'next/dynamic';
import { motion, useMotionValueEvent, useScroll, useTransform } from 'framer-motion';
import { useRef, useState } from 'react';
import { site } from '@/content/site';
import Canvas3D from '@/components/three/Canvas3D';
import BlueprintArt from '@/components/ui/BlueprintArt';
import Icon from '@/components/ui/Icon';
import { Eyebrow } from '@/components/ui/Reveal';
import { useLite } from '@/lib/useLite';

const ScrollScene = dynamic(() => import('@/components/three/ScrollScene'), {
  ssr: false,
  loading: () => <BlueprintArt className="h-full w-full p-16" label={site.a11y.sceneFallback} />,
});

/** Pinned, scroll-scrubbed: PDF page -> blueprint -> walls rise -> colours, with a 0-5 s timer. */
export default function Transform() {
  const ref = useRef<HTMLElement>(null);
  const lite = useLite();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const [seconds, setSeconds] = useState(0);
  useMotionValueEvent(scrollYProgress, 'change', (p) => setSeconds(Math.round(Math.min(1, Math.max(0, (p - 0.1) / 0.75)) * 50) / 10));

  const pdfOpacity = useTransform(scrollYProgress, [0, 0.12, 0.2], [1, 1, 0]);
  const pdfScale = useTransform(scrollYProgress, [0, 0.2], [1, 0.6]);
  const steps = site.transform.steps;
  const stepOpacity = [
    useTransform(scrollYProgress, [0.05, 0.12, 0.3, 0.36], [0, 1, 1, 0.35]),
    useTransform(scrollYProgress, [0.3, 0.38, 0.65, 0.7], [0, 1, 1, 0.35]),
    useTransform(scrollYProgress, [0.68, 0.76, 1], [0, 1, 1]),
  ];

  return (
    <section id="transform" ref={ref} className="relative h-[320vh]" aria-labelledby="transform-title">
      <div className="sticky top-0 flex h-[100svh] flex-col overflow-hidden">
        <div className="relative z-10 flex flex-col items-center px-6 pt-24 text-center sm:pt-28">
          <Eyebrow index={site.sections.transform.index} label={site.sections.transform.eyebrow} className="mb-5" />
          <h2 id="transform-title" className="font-display text-4xl font-semibold tracking-tight sm:text-6xl">
            {site.transform.headline}
          </h2>
          <p className="mt-4 font-display text-6xl font-semibold tabular-nums text-cyan sm:text-7xl" aria-live="off">
            {seconds.toFixed(1)}
            <span className="ml-1 text-2xl text-muted">{site.transform.unit}</span>
          </p>
        </div>

        <div className="relative flex-1">
          <Canvas3D className="absolute inset-0" fallbackLabel={site.a11y.sceneFallback}>
            {(active) => <ScrollScene active={active} progress={scrollYProgress} mode="build" lite={lite} label={site.a11y.modelAlt} />}
          </Canvas3D>
          <motion.div style={{ opacity: pdfOpacity, scale: pdfScale }} className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="flex h-56 w-44 items-center justify-center rounded-xl border border-white/15 bg-surface/90 shadow-2xl backdrop-blur sm:h-72 sm:w-56">
              <Icon name="file" size={64} className="text-cyan" strokeWidth={1.25} />
              <span className="absolute bottom-4 rounded bg-cyan px-2 py-0.5 text-xs font-bold text-ink">PDF</span>
            </div>
          </motion.div>
        </div>

        <ol className="relative z-10 flex justify-center gap-8 pb-10 sm:gap-16">
          {steps.map((step, i) => (
            <motion.li key={step} style={{ opacity: stepOpacity[i] }} className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-paper">
              <span className="font-display text-cyan">0{i + 1}</span>
              {step}
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
