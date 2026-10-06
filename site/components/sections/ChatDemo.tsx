'use client';

import dynamic from 'next/dynamic';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { site } from '@/content/site';
import Canvas3D from '@/components/three/Canvas3D';
import BlueprintArt from '@/components/ui/BlueprintArt';
import Icon from '@/components/ui/Icon';
import { SectionTitle } from '@/components/ui/Reveal';
import { useLite } from '@/lib/useLite';

const ChatScene = dynamic(() => import('@/components/three/ChatScene'), {
  ssr: false,
  loading: () => <BlueprintArt className="h-full w-full p-10" label={site.a11y.sceneFallback} />,
});

type Phase = 'typing' | 'reply' | 'hold' | 'undo' | 'reset';
type State = { index: number; chars: number; phase: Phase };

const { prompts, replies } = site.chat;
const TIMING: Record<Phase, number> = { typing: 45, reply: 550, hold: 1700, undo: 1600, reset: 1300 };

function next(s: State): State {
  switch (s.phase) {
    case 'typing':
      return s.chars < prompts[s.index].length ? { ...s, chars: s.chars + 1 } : { ...s, phase: 'reply' };
    case 'reply':
      return { ...s, phase: 'hold' };
    case 'hold':
      return s.index < prompts.length - 1 ? { index: s.index + 1, chars: 0, phase: 'typing' } : { ...s, phase: 'undo' };
    case 'undo':
      return { ...s, phase: 'reset' };
    case 'reset':
      return { index: 0, chars: 0, phase: 'typing' };
  }
}

/** Typed chat on the left drives live recolouring of the model on the right; loops, pauses on hover. */
export default function ChatDemo() {
  const lite = useLite();
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: '-15% 0px' });
  const [paused, setPaused] = useState(false);
  const [s, setS] = useState<State>({ index: 0, chars: 0, phase: 'typing' });

  const final: State = { index: prompts.length - 1, chars: prompts[prompts.length - 1].length, phase: 'hold' };
  const view = reduced ? final : s;

  useEffect(() => {
    if (reduced || paused || !inView) return;
    const t = setTimeout(() => setS(next), TIMING[s.phase]);
    return () => clearTimeout(t);
  }, [s, paused, inView, reduced]);

  // Model step: number of prompts already answered (reset rewinds to 0).
  const answered = view.phase === 'reset' ? 0 : view.index + (view.phase === 'typing' ? 0 : 1);
  const sent = view.phase === 'reset' ? [] : prompts.slice(0, view.index + (view.phase === 'typing' ? 0 : 1));

  return (
    <section className="mx-auto max-w-[1440px] px-6 py-32 sm:px-10" aria-labelledby="chat-title">
      <SectionTitle id="chat-title" index={site.sections.chat.index} eyebrow={site.sections.chat.eyebrow} headline={site.chat.headline} line={site.chat.line} />
      <div
        ref={ref}
        className="relative mt-14 overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-surface to-ink lg:h-[640px]"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        <Canvas3D className="h-[380px] lg:absolute lg:inset-0 lg:h-auto" fallbackLabel={site.a11y.sceneFallback}>
          {(active) => <ChatScene active={active} step={answered} lite={lite} label={site.a11y.modelAlt} />}
        </Canvas3D>
        <div className="relative z-10 flex min-h-[340px] flex-col border-t border-white/10 bg-ink/70 p-5 backdrop-blur-xl lg:absolute lg:bottom-6 lg:left-6 lg:top-6 lg:w-[380px] lg:rounded-2xl lg:border lg:border-white/15 lg:shadow-2xl">
          <div className="mb-4 flex items-center gap-2 border-b border-white/10 pb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan shadow-[0_0_10px_#3dd6f5]" aria-hidden="true" />
            {site.chat.ai}
          </div>
          <div className="flex-1 space-y-3" aria-live="polite">
            <AnimatePresence initial={false}>
              {sent.map((p, i) => (
                <motion.div key={`${p}-${i}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                  <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-paper px-4 py-2 text-sm text-ink">
                    <span className="sr-only">{site.chat.you}: </span>{p}
                  </div>
                  {(i < view.index || view.phase !== 'typing') && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-fit max-w-[85%] rounded-2xl rounded-bl-sm bg-white/5 px-4 py-2 text-sm text-paper">
                      <span className="sr-only">{site.chat.ai}: </span>{replies[i]}
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            <AnimatePresence>
              {(view.phase === 'undo') && (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex justify-center pt-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-cyan px-4 py-1.5 text-xs font-bold text-ink">
                    <Icon name="undo" size={14} /> {site.chat.undo}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-ink px-4 py-3 text-sm">
            <span className="flex-1 truncate text-paper">
              {view.phase === 'typing' ? prompts[view.index].slice(0, view.chars) : ''}
              <span className="ml-0.5 inline-block h-4 w-px translate-y-0.5 animate-pulse bg-cyan" />
            </span>
            <Icon name="send" size={16} className="text-cyan" />
          </div>
        </div>
      </div>
    </section>
  );
}
