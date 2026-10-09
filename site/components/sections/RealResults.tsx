'use client';

import Image from 'next/image';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { site } from '@/content/site';
import Icon from '@/components/ui/Icon';
import Reveal, { SectionTitle } from '@/components/ui/Reveal';
import { useTilt } from '@/lib/useTilt';

const ADVANCE_MS = 7000;
const EASE = [0.22, 1, 0.36, 1] as const;
const STAGE_SIZES = '(min-width: 1440px) 1360px, 100vw';

const clamp = (v: number) => Math.min(100, Math.max(0, v));

/**
 * Real sample plans beside their 3D results. The plan covers the left of the frame up to a
 * divider that follows the mouse (drag on touch, arrow keys on the handle); with no pointer
 * it drifts on its own. Projects advance on a timer that pauses on hover and off screen.
 */
export default function RealResults() {
  const copy = site.real;
  const slides = copy.slides;
  const reduced = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { amount: 0.3 });
  const tilt = useTilt(2.5);

  const [index, setIndex] = useState(0);
  const [split, setSplit] = useState(50);
  const [hovering, setHovering] = useState(false);
  const [touched, setTouched] = useState(false);
  const dragging = useRef(false);
  const slide = slides[index];

  const go = useCallback((step: number) => setIndex((i) => (i + step + slides.length) % slides.length), [slides.length]);

  // Idle drift: the divider sweeps gently until someone takes over.
  useEffect(() => {
    if (reduced || hovering || !inView) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      setSplit(50 + 22 * Math.sin((now - start) / 1400));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduced, hovering, inView, index]);

  // Auto-advance, paused while hovered or off screen.
  useEffect(() => {
    if (reduced || hovering || !inView) return;
    const timer = setTimeout(() => go(1), ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [reduced, hovering, inView, index, go]);

  const follow = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' || dragging.current) {
      const r = e.currentTarget.getBoundingClientRect();
      setSplit(clamp(((e.clientX - r.left) / r.width) * 100));
      setTouched(true);
    }
    tilt.onPointerMove(e);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 20 : 5;
    const next = { ArrowLeft: split - step, ArrowRight: split + step, Home: 0, End: 100 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    setHovering(true);
    setTouched(true);
    setSplit(clamp(next));
  };

  return (
    <section ref={sectionRef} className="py-32" aria-labelledby="real-title" aria-roledescription="carousel">
      <div className="mx-auto max-w-[1440px] px-6 sm:px-10">
        <SectionTitle id="real-title" index={site.sections.real.index} eyebrow={site.sections.real.eyebrow} headline={copy.headline} line={copy.line} />
      </div>

      <Reveal className="mx-auto mt-16 max-w-[1440px] px-0 sm:px-10">
        <div
          {...tilt}
          onPointerMove={follow}
          onPointerEnter={(e) => e.pointerType === 'mouse' && setHovering(true)}
          onPointerLeave={(e) => {
            setHovering(false);
            dragging.current = false;
            tilt.onPointerLeave(e);
          }}
          onPointerDown={(e) => {
            if (e.pointerType === 'mouse') return;
            dragging.current = true;
            setHovering(true);
            e.currentTarget.setPointerCapture(e.pointerId);
            follow(e);
          }}
          onPointerUp={() => {
            dragging.current = false;
          }}
          className="tilt glare group relative aspect-[16/10] cursor-ew-resize touch-pan-y select-none overflow-hidden bg-surface transition-transform duration-500 ease-out-expo sm:aspect-[16/9] sm:rounded-3xl sm:border sm:border-white/10"
          style={{ '--split': `${split}%` } as React.CSSProperties}
        >
          <AnimatePresence initial={false}>
            <motion.div
              key={slide.key}
              className="absolute inset-0"
              initial={{ opacity: 0, scale: 1.04, filter: 'blur(8px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, filter: 'blur(6px)' }}
              transition={{ duration: 0.9, ease: EASE }}
            >
              {/* Slow push-in on the 3D result, like a camera settling on the shot. */}
              <motion.div
                className="absolute inset-0"
                animate={reduced ? undefined : { scale: [1, 1.06] }}
                transition={{ duration: ADVANCE_MS / 1000 + 1, ease: 'linear' }}
              >
                <Image src={slide.model} alt={`${slide.title}: ${copy.after}`} fill sizes={STAGE_SIZES} className="object-cover" priority={index === 0} />
              </motion.div>
              <div className="absolute inset-0 [clip-path:inset(0_calc(100%_-_var(--split))_0_0)]">
                <Image src={slide.plan} alt={`${slide.title}: ${copy.before}`} fill sizes={STAGE_SIZES} className="object-cover" />
                {/* Paper sheen so the plan reads as a printed sheet */}
                <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_40%,rgb(255_255_255/0.35)_50%,transparent_60%)] mix-blend-soft-light" />
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Divider and handle */}
          <div className="pointer-events-none absolute inset-y-0 left-[var(--split)] w-px -translate-x-1/2 bg-paper shadow-[0_0_24px_4px_rgba(61,214,245,0.55)]" />
          <div
            role="slider"
            tabIndex={0}
            aria-label={copy.sliderLabel}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(split)}
            aria-valuetext={`${Math.round(split)}% ${copy.before}`}
            onKeyDown={onKey}
            onBlur={() => setHovering(false)}
            className="absolute top-1/2 left-[var(--split)] flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-ink/50 text-paper shadow-[0_10px_40px_rgba(0,0,0,0.45)] backdrop-blur-md transition-transform duration-300 ease-out-expo group-hover:scale-110"
          >
            <Icon name="compare" size={22} />
          </div>

          {/* Side labels fade out as their side closes */}
          <span
            className="absolute left-4 top-4 rounded-full bg-ink/75 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-paper backdrop-blur sm:left-6 sm:top-6"
            style={{ opacity: Math.min(1, split / 25) }}
          >
            {copy.before}
          </span>
          <span
            className="absolute right-4 top-4 rounded-full bg-cyan px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-ink sm:right-6 sm:top-6"
            style={{ opacity: Math.min(1, (100 - split) / 25) }}
          >
            {copy.after}
          </span>
          <span
            className={`pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full border border-white/15 bg-ink/70 px-4 py-1.5 text-xs text-paper backdrop-blur transition-opacity duration-500 ${touched ? 'opacity-0' : 'opacity-100'}`}
          >
            {copy.hint}
          </span>
        </div>
      </Reveal>

      {/* Project picker: hover lifts a card, the active one shows its timer */}
      <div className="mx-auto mt-6 grid max-w-[1440px] gap-3 px-6 sm:grid-cols-[1fr_1fr_1fr_auto] sm:px-10">
        {slides.map((s, i) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setIndex(i)}
            aria-current={i === index}
            className={`group/thumb relative flex items-center gap-4 overflow-hidden rounded-2xl border p-3 text-left transition-all duration-300 ease-out-expo hover:-translate-y-1 hover:border-cyan/50 hover:shadow-[0_18px_40px_-18px_rgba(61,214,245,0.45)] ${
              i === index ? 'border-white/25 bg-surface' : 'border-white/10 bg-surface/50'
            }`}
          >
            <span className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg">
              <Image src={s.model} alt="" fill sizes="96px" className="object-cover transition-transform duration-700 ease-out-expo group-hover/thumb:scale-110" />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-display text-base font-semibold text-paper">{s.title}</span>
              <span className="block truncate text-xs text-muted">{s.meta}</span>
            </span>
            <span className="absolute inset-x-0 bottom-0 h-0.5 bg-white/5" aria-hidden="true">
              {i === index && (
                <motion.span
                  key={`${s.key}-${index}-${hovering}`}
                  className="block h-full origin-left bg-cyan"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: reduced || hovering ? 0 : 1 }}
                  transition={{ duration: reduced || hovering ? 0 : ADVANCE_MS / 1000, ease: 'linear' }}
                />
              )}
            </span>
          </button>
        ))}
        <div className="flex items-center justify-end gap-2">
          {[
            { step: -1, icon: 'arrowLeft' as const, label: copy.prev },
            { step: 1, icon: 'arrowRight' as const, label: copy.next },
          ].map((b) => (
            <button
              key={b.label}
              type="button"
              onClick={() => go(b.step)}
              aria-label={b.label}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 text-paper transition-all duration-300 ease-out-expo hover:scale-105 hover:border-cyan hover:bg-cyan hover:text-ink"
            >
              <Icon name={b.icon} />
            </button>
          ))}
        </div>
      </div>
      <p className="mx-auto mt-6 max-w-[1440px] px-6 text-xs text-muted sm:px-10">{copy.credit}</p>
    </section>
  );
}
