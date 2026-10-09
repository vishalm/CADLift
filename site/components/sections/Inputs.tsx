'use client';

import dynamic from 'next/dynamic';
import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState, type ReactNode } from 'react';
import { site } from '@/content/site';
import Canvas3D from '@/components/three/Canvas3D';
import BlueprintArt from '@/components/ui/BlueprintArt';
import Reveal, { SectionTitle } from '@/components/ui/Reveal';
import { useTilt } from '@/lib/useTilt';

const MugScene = dynamic(() => import('@/components/three/MugScene'), { ssr: false });

function Tile({ label, children, className = '', delay = 0 }: { label: string; children: ReactNode; className?: string; delay?: number }) {
  const tilt = useTilt();
  return (
    <Reveal delay={delay} className={className}>
      <div
        {...tilt}
        className="tilt spotlight group relative h-full min-h-[260px] overflow-hidden rounded-3xl border border-white/10 bg-surface transition-[transform,border-color] duration-300 ease-out-expo hover:border-cyan/40"
      >
        <div className="absolute inset-0">{children}</div>
        <span className="absolute bottom-5 left-5 rounded-full border border-white/15 bg-ink/70 px-3 py-1 text-xs font-semibold tracking-wide text-paper backdrop-blur">
          {label}
        </span>
      </div>
    </Reveal>
  );
}

/** Three CAD layers sliding apart in isometric view. */
function CadLayers() {
  const reduced = useReducedMotion();
  const colors = ['#3dd6f5', '#9aa4b2', '#c79a6d'];
  return (
    <svg viewBox="0 0 200 160" className="h-full w-full p-8" aria-hidden="true">
      {colors.map((c, i) => (
        <motion.g
          key={c}
          animate={reduced ? undefined : { y: [0, (1 - i) * 18, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: [0.45, 0, 0.55, 1], delay: i * 0.1 }}
        >
          <path d={`M100 ${40 + i * 22} L160 ${70 + i * 22} L100 ${100 + i * 22} L40 ${70 + i * 22} Z`} fill={`${c}22`} stroke={c} strokeWidth="1.5" />
          <path d={`M70 ${70 + i * 22} L100 ${55 + i * 22} L130 ${70 + i * 22}`} fill="none" stroke={c} strokeWidth="1" opacity="0.7" />
        </motion.g>
      ))}
    </svg>
  );
}

/** A loose sketch that resolves into a low-poly mesh, and back. */
function SketchToMesh() {
  const reduced = useReducedMotion();
  const loop = reduced ? undefined : { repeat: Infinity, duration: 4.5, ease: 'easeInOut' as const };
  const tris = [
    'M60 120 L100 50 L140 120 Z', 'M60 120 L100 95 L140 120', 'M100 50 L100 95', 'M60 120 L80 85 L100 95 Z', 'M140 120 L120 85 L100 95 Z',
  ];
  return (
    <svg viewBox="0 0 200 160" className="h-full w-full p-8" aria-hidden="true">
      <motion.path
        d="M58 121 C 70 100, 85 70, 99 49 C 112 72, 128 98, 141 120 C 115 118, 85 123, 58 121"
        fill="none"
        stroke="#f2f1ee"
        strokeWidth="1.6"
        strokeDasharray="3 2"
        animate={reduced ? { opacity: 0 } : { opacity: [1, 1, 0, 0, 1] }}
        transition={loop}
      />
      <motion.g animate={reduced ? { opacity: 1 } : { opacity: [0, 0, 1, 1, 0] }} transition={loop}>
        {tris.map((d, i) => (
          <path key={i} d={d} fill={i === 0 ? '#3dd6f51a' : 'none'} stroke="#3dd6f5" strokeWidth="1.4" strokeLinejoin="round" />
        ))}
      </motion.g>
    </svg>
  );
}

/** Prompt typed in, mug spins up in 3D. */
function PromptToMug({ sample }: { sample: string }) {
  const reduced = useReducedMotion();
  const [chars, setChars] = useState(reduced ? sample.length : 0);
  useEffect(() => {
    if (reduced) return;
    const t = setInterval(() => setChars((c) => (c >= sample.length + 30 ? 0 : c + 1)), 80);
    return () => clearInterval(t);
  }, [reduced, sample.length]);
  return (
    <div className="flex h-full flex-col">
      <div className="mx-5 mt-5 rounded-xl border border-white/10 bg-ink px-4 py-2.5 font-mono text-sm text-paper">
        {sample.slice(0, Math.min(chars, sample.length))}
        <span className="ml-0.5 inline-block h-4 w-px translate-y-0.5 animate-pulse bg-cyan" />
      </div>
      <Canvas3D className="flex-1" fallback={<span />} fallbackLabel={site.a11y.sceneFallback}>
        {(active) => <MugScene active={active} label={sample} />}
      </Canvas3D>
    </div>
  );
}

export default function Inputs() {
  const tiles = site.inputs.tiles;
  return (
    <section className="mx-auto max-w-[1440px] px-6 py-32 sm:px-10" aria-labelledby="inputs-title">
      <SectionTitle id="inputs-title" index={site.sections.inputs.index} eyebrow={site.sections.inputs.eyebrow} headline={site.inputs.headline} />
      <div className="mt-16 grid auto-rows-[280px] gap-4 md:grid-cols-3">
        <Tile label={tiles[0].label} className="md:col-span-2">
          <BlueprintArt className="h-full w-full p-10" label={tiles[0].label} loop />
        </Tile>
        <Tile label={tiles[1].label} delay={0.08}>
          <CadLayers />
        </Tile>
        <Tile label={tiles[2].label} delay={0.16}>
          <SketchToMesh />
        </Tile>
        <Tile label={tiles[3].label} className="md:col-span-2" delay={0.24}>
          <PromptToMug sample={tiles[3].sample ?? ''} />
        </Tile>
      </div>
    </section>
  );
}
