'use client';

import { animate, motion, useInView, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { site } from '@/content/site';
import Reveal, { SectionTitle } from '@/components/ui/Reveal';

const EASE = [0.22, 1, 0.36, 1] as const;

function useCountUp(target: number, run: boolean, duration = 1.6) {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(reduced ? target : 0);
  useEffect(() => {
    if (!run || reduced) return;
    const controls = animate(0, target, { duration, ease: EASE, onUpdate: setValue });
    return () => controls.stop();
  }, [run, reduced, target, duration]);
  return reduced ? target : value;
}

function Gauge({ run }: { run: boolean }) {
  const { gaugeValue, gaugeLabel } = site.metrics;
  const v = useCountUp(gaugeValue, run);
  const max = 10;
  const arc = 0.75; // 270 degree dial
  const r = 80;
  const c = 2 * Math.PI * r;
  return (
    <figure className="flex flex-col items-center">
      <svg viewBox="0 0 200 200" className="w-56" role="img" aria-label={`${gaugeValue} seconds ${gaugeLabel}`}>
        <g transform="rotate(135 100 100)" fill="none" strokeLinecap="round" strokeWidth="12">
          <circle cx="100" cy="100" r={r} stroke="rgb(242 241 238 / 0.08)" strokeDasharray={`${c * arc} ${c}`} />
          <circle cx="100" cy="100" r={r} stroke="var(--color-cyan)" strokeDasharray={`${c * arc * (v / max)} ${c}`} />
        </g>
        <text x="100" y="108" textAnchor="middle" className="fill-paper font-display" fontSize="44" fontWeight="600">
          {v.toFixed(1)}
        </text>
        <text x="100" y="134" textAnchor="middle" className="fill-muted" fontSize="13">
          s
        </text>
      </svg>
      <figcaption className="-mt-4 text-sm font-semibold uppercase tracking-[0.2em] text-muted">{gaugeLabel}</figcaption>
    </figure>
  );
}

function Stages({ run }: { run: boolean }) {
  const reduced = useReducedMotion();
  const { stages, stagesLabel } = site.metrics;
  const max = Math.max(...stages.map((s) => s.seconds));
  return (
    <figure className="w-full">
      <ul className="space-y-3">
        {stages.map((s, i) => (
          <li key={s.name} className="grid grid-cols-[70px_1fr_44px] items-center gap-3 text-sm">
            <span className="text-paper">{s.name}</span>
            <span className="h-3 overflow-hidden rounded-full bg-white/5">
              <motion.span
                className="block h-full rounded-full bg-gradient-to-r from-cyan to-oak"
                initial={reduced ? false : { width: 0 }}
                animate={run || reduced ? { width: `${(s.seconds / max) * 100}%` } : undefined}
                transition={{ duration: 1.1, ease: EASE, delay: 0.15 * i }}
              />
            </span>
            <span className="text-right tabular-nums text-muted">{s.seconds.toFixed(1)}</span>
          </li>
        ))}
      </ul>
      <figcaption className="mt-5 text-sm font-semibold uppercase tracking-[0.2em] text-muted">{stagesLabel}</figcaption>
    </figure>
  );
}

function Flow({ run }: { run: boolean }) {
  const { flowInputs, flowOutputs, flows, flowLabel } = site.metrics;
  const y = (i: number, n: number) => 20 + (i * 160) / Math.max(n - 1, 1);
  return (
    <figure className="w-full">
      <svg viewBox="0 0 320 200" className="w-full" role="img" aria-label={flowLabel}>
        {flowInputs.map((input, i) =>
          (flows[input] ?? []).map((out) => {
            const j = (flowOutputs as readonly string[]).indexOf(out);
            const y1 = y(i, flowInputs.length);
            const y2 = y(j, flowOutputs.length);
            return (
              <motion.path
                key={`${input}-${out}`}
                d={`M 70 ${y1} C 160 ${y1}, 160 ${y2}, 250 ${y2}`}
                fill="none"
                stroke="var(--color-cyan)"
                strokeOpacity="0.45"
                strokeWidth="2"
                initial={{ pathLength: 0 }}
                animate={run ? { pathLength: 1 } : undefined}
                transition={{ duration: 1.2, ease: EASE, delay: 0.1 * i }}
              />
            );
          }),
        )}
        {flowInputs.map((label, i) => (
          <g key={label}>
            <circle cx="70" cy={y(i, flowInputs.length)} r="4" fill="var(--color-paper)" />
            <text x="60" y={y(i, flowInputs.length) + 4} textAnchor="end" fontSize="12" className="fill-paper">{label}</text>
          </g>
        ))}
        {flowOutputs.map((label, j) => (
          <g key={label}>
            <circle cx="250" cy={y(j, flowOutputs.length)} r="4" fill="var(--color-cyan)" />
            <text x="260" y={y(j, flowOutputs.length) + 4} fontSize="12" className="fill-cyan" fontWeight="600">{label}</text>
          </g>
        ))}
      </svg>
      <figcaption className="mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-muted">{flowLabel}</figcaption>
    </figure>
  );
}

export default function Metrics() {
  const ref = useRef<HTMLDivElement>(null);
  const run = useInView(ref, { once: true, margin: '-20% 0px' });
  return (
    <section className="mx-auto max-w-[1440px] px-6 py-32 sm:px-10" aria-labelledby="metrics-title">
      <SectionTitle id="metrics-title" index={site.sections.metrics.index} eyebrow={site.sections.metrics.eyebrow} headline={site.metrics.headline} line={site.metrics.caption} />
      <div ref={ref} className="mt-16 grid items-stretch gap-6 lg:grid-cols-3">
        <Reveal className="rounded-3xl border border-white/10 bg-surface flex items-center p-8"><Gauge run={run} /></Reveal>
        <Reveal delay={0.1} className="rounded-3xl border border-white/10 bg-surface flex items-center p-8"><Stages run={run} /></Reveal>
        <Reveal delay={0.2} className="rounded-3xl border border-white/10 bg-surface flex items-center p-8"><Flow run={run} /></Reveal>
      </div>
    </section>
  );
}
