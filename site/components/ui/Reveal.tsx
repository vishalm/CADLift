'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

const EASE = [0.22, 1, 0.36, 1] as const;

/** Fade-and-rise entrance when scrolled into view; instant for reduced motion. */
export default function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-10% 0px' }}
      transition={{ duration: 0.7, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/** Mono technical label: "02 / Restyle" with a short rule. */
export function Eyebrow({ index, label, className = '' }: { index: string; label: string; className?: string }) {
  return (
    <p className={`flex items-center gap-3 font-mono text-xs uppercase tracking-[0.25em] text-muted ${className}`}>
      <span className="text-cyan">{index}</span>
      <span className="h-px w-8 bg-white/20" aria-hidden="true" />
      {label}
    </p>
  );
}

type TitleProps = {
  index: string;
  eyebrow: string;
  headline: string;
  line?: string;
  /** split: headline left, line right (editorial). center: stacked and centred. */
  layout?: 'split' | 'center';
  id?: string;
};

/** Section header: numbered eyebrow, big headline, optional supporting line. */
export function SectionTitle({ index, eyebrow, headline, line, layout = 'split', id }: TitleProps) {
  if (layout === 'center') {
    return (
      <Reveal className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <Eyebrow index={index} label={eyebrow} />
        <h2 id={id} className="mt-5 font-display text-4xl font-semibold tracking-tight text-balance sm:text-6xl">{headline}</h2>
        {line && <p className="mt-4 text-lg text-muted text-balance">{line}</p>}
      </Reveal>
    );
  }
  return (
    <Reveal className="grid gap-6 border-t border-white/10 pt-8 md:grid-cols-[1.4fr_1fr] md:items-end">
      <div>
        <Eyebrow index={index} label={eyebrow} />
        <h2 id={id} className="mt-5 font-display text-4xl font-semibold leading-[1.02] tracking-tight text-balance sm:text-7xl">{headline}</h2>
      </div>
      {line && <p className="max-w-sm text-lg text-muted text-balance md:justify-self-end md:pb-2">{line}</p>}
    </Reveal>
  );
}
