'use client';

import { useReducedMotion } from 'framer-motion';
import type { PointerEvent } from 'react';

/**
 * Pointer-follow hover for cards: tilts toward the cursor and moves the spotlight and glare.
 * Writes CSS variables (no React re-render per move); pair with the `.tilt`, `.spotlight`
 * and `.glare` classes. Mouse only, and off for reduced motion.
 */
export function useTilt<T extends HTMLElement = HTMLDivElement>(maxDeg = 6) {
  const reduced = useReducedMotion();

  const onPointerMove = (e: PointerEvent<T>) => {
    if (reduced || e.pointerType !== 'mouse') return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
    el.style.setProperty('--gx', `${px * 100}%`);
    el.style.setProperty('--gy', `${py * 100}%`);
    el.style.setProperty('--rx', `${(py - 0.5) * -2 * maxDeg}deg`);
    el.style.setProperty('--ry', `${(px - 0.5) * 2 * maxDeg}deg`);
  };

  const onPointerLeave = (e: PointerEvent<T>) => {
    e.currentTarget.style.setProperty('--rx', '0deg');
    e.currentTarget.style.setProperty('--ry', '0deg');
  };

  return { onPointerMove, onPointerLeave };
}
