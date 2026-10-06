'use client';

import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { links, site } from '@/content/site';
import Icon from '@/components/ui/Icon';
import Reveal, { SectionTitle } from '@/components/ui/Reveal';

const { commands } = site.openSource;
const full = commands.join('\n');

/** Terminal that types the quick start once in view, with copy-to-clipboard and a toast. */
function Terminal() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-15% 0px' });
  const reduced = useReducedMotion();
  const [chars, setChars] = useState(reduced ? full.length : 0);
  const [toast, setToast] = useState(false);

  useEffect(() => {
    if (!inView || reduced || chars >= full.length) return;
    const t = setTimeout(() => setChars((c) => c + 1), full[chars] === '\n' ? 350 : 22);
    return () => clearTimeout(t);
  }, [inView, reduced, chars]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(false), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(full);
      setToast(true);
    } catch {
      /* clipboard blocked: nothing to do, text is selectable */
    }
  };

  const shown = (reduced ? full : full.slice(0, chars)).split('\n');

  return (
    <div ref={ref} className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#07090c] text-left shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="h-3 w-3 rounded-full bg-white/15" />
          <span className="h-3 w-3 rounded-full bg-white/15" />
          <span className="h-3 w-3 rounded-full bg-white/15" />
        </div>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-muted hover:bg-white/5 hover:text-paper"
        >
          <Icon name={toast ? 'check' : 'copy'} size={14} />
          {toast ? site.openSource.copied : site.openSource.copy}
        </button>
      </div>
      <pre className="min-h-[136px] overflow-x-auto p-5 font-mono text-[13px] leading-7 text-paper sm:text-sm">
        {shown.map((line, i) => (
          <div key={i}>
            <span className="select-none text-cyan">$ </span>
            {line}
            {i === shown.length - 1 && chars < full.length && <span className="ml-0.5 inline-block h-4 w-2 translate-y-0.5 animate-pulse bg-cyan" />}
          </div>
        ))}
      </pre>
      <AnimatePresence>
        {toast && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-4 right-4 rounded-full bg-cyan px-3 py-1 text-xs font-bold text-ink"
          >
            {site.openSource.copied}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function OpenSource() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-32 text-center sm:px-10" aria-labelledby="os-title">
      <SectionTitle id="os-title" layout="center" index={site.sections.openSource.index} eyebrow={site.sections.openSource.eyebrow} headline={site.openSource.headline} />
      <Reveal className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <motion.a
          href={links.github}
          target="_blank"
          rel="noreferrer"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          className="inline-flex items-center gap-3 rounded-full bg-paper px-7 py-4 text-base font-semibold text-ink"
        >
          <Icon name="github" size={22} />
          {site.openSource.star}
          <Icon name="star" size={18} className="text-oak" />
        </motion.a>
        <a href={links.license} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3.5 text-sm font-semibold text-paper hover:border-white/40">
          <Icon name="license" size={18} className="text-cyan" />
          {site.openSource.license}
        </a>
      </Reveal>
      <Reveal delay={0.15} className="mt-12">
        <Terminal />
      </Reveal>
    </section>
  );
}
