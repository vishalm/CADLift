'use client';

import { motion, useInView, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { site } from '@/content/site';
import Icon from '@/components/ui/Icon';
import Reveal, { SectionTitle } from '@/components/ui/Reveal';

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/**
 * Letterboxed showreel of real FloorPlanTo3D captures. Plays muted on loop while on screen (not
 * for reduced motion). On hover a play / pause pill follows the cursor and chapter marks rise
 * on the timeline; clicking a chapter jumps to it.
 */
export default function Film() {
  const copy = site.film;
  const reduced = useReducedMotion();
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const inView = useInView(frameRef, { amount: 0.35 });
  const [playing, setPlaying] = useState(false);
  const [wantPlay, setWantPlay] = useState(true);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hover, setHover] = useState(false);

  // Cursor-following pill, sprung so it trails the pointer slightly.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 380, damping: 32, mass: 0.6 });
  const sy = useSpring(py, { stiffness: 380, damping: 32, mass: 0.6 });

  useEffect(() => {
    if (reduced) setWantPlay(false);
  }, [reduced]);

  // Play only while visible and wanted.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (inView && wantPlay) video.play().catch(() => setWantPlay(false));
    else video.pause();
  }, [inView, wantPlay]);

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    px.set(e.clientX - r.left);
    py.set(e.clientY - r.top);
  };

  const seek = (at: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = at;
    setTime(at);
    setWantPlay(true);
  };

  const chapter = [...copy.chapters].reverse().find((c) => time >= c.at) ?? copy.chapters[0];
  const total = duration || 26.8;

  return (
    <section className="py-32" aria-labelledby="film-title">
      <div className="mx-auto max-w-[1440px] px-6 sm:px-10">
        <SectionTitle id="film-title" index={site.sections.film.index} eyebrow={site.sections.film.eyebrow} headline={copy.headline} line={copy.line} />
      </div>

      <Reveal className="relative mx-auto mt-16 max-w-[1600px] px-0 sm:px-10">
        <div
          ref={frameRef}
          onPointerMove={onMove}
          onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(true)}
          onPointerLeave={() => setHover(false)}
          onClick={() => setWantPlay((w) => !w)}
          className={`group relative aspect-[16/10] overflow-hidden bg-black sm:aspect-[21/9] sm:rounded-3xl ${hover ? 'cursor-none' : ''}`}
        >
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full scale-[1.02] object-cover transition-transform duration-[1.6s] ease-out-expo group-hover:scale-100"
            poster="/media/film-poster.jpg"
            muted
            loop
            playsInline
            preload="metadata"
            aria-label={copy.label}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          >
            <source src="/media/film.webm" type="video/webm" />
            <source src="/media/film.mp4" type="video/mp4" />
          </video>

          {/* Cinema bars and edge falloff */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[7%] bg-black" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[7%] bg-black" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgb(0_0_0/0.55))]" />

          {/* HUD */}
          <div className="pointer-events-none absolute left-6 top-[10%] space-y-1 font-mono text-[11px] uppercase tracking-[0.2em] text-paper/85 sm:left-10">
            <p className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full bg-red-400 ${playing ? 'animate-pulse' : 'opacity-40'}`} />
              {copy.hud.source}
            </p>
            <p className="text-muted">{copy.hud.res}</p>
          </div>
          <motion.p
            key={chapter.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="pointer-events-none absolute right-6 top-[10%] font-display text-lg font-semibold text-paper sm:right-10 sm:text-2xl"
          >
            {chapter.label}
          </motion.p>

          {/* Cursor pill (decorative; the real control is the button below) */}
          <motion.div
            aria-hidden="true"
            style={{ x: sx, y: sy }}
            className={`pointer-events-none absolute left-0 top-0 transition-opacity duration-300 ${hover ? 'opacity-100' : 'opacity-0'}`}
          >
            <span className="flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full bg-paper px-4 py-2 text-sm font-semibold text-ink shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
              <Icon name={playing ? 'pause' : 'play'} size={16} />
              {playing ? copy.pause : copy.play}
            </span>
          </motion.div>

          {/* Timeline with chapter marks */}
          <div className="absolute inset-x-6 bottom-[10%] sm:inset-x-10" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => setWantPlay((w) => !w)}
                aria-label={playing ? copy.pause : copy.play}
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-white/25 bg-ink/60 text-paper backdrop-blur transition-all duration-300 ease-out-expo hover:scale-110 hover:border-cyan hover:bg-cyan hover:text-ink"
              >
                <Icon name={playing ? 'pause' : 'play'} size={16} />
              </button>
              <span className="font-mono text-xs text-paper/80">{fmt(time)} / {fmt(total)}</span>
            </div>
            <div className="relative h-1 rounded-full bg-white/15">
              <div className="absolute inset-y-0 left-0 rounded-full bg-cyan shadow-[0_0_12px_rgba(61,214,245,0.8)]" style={{ width: `${(time / total) * 100}%` }} />
              {copy.chapters.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => seek(c.at)}
                  aria-label={`${c.label} ${fmt(c.at)}`}
                  className="group/ch absolute top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-pointer p-2"
                  style={{ left: `${(c.at / total) * 100}%` }}
                >
                  <span className={`block h-2.5 w-2.5 rounded-full border-2 border-ink transition-transform duration-300 group-hover/ch:scale-150 ${time >= c.at ? 'bg-cyan' : 'bg-paper/70'}`} />
                  <span className="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink/80 px-2 py-0.5 text-[11px] text-paper opacity-0 transition-all duration-300 ease-out-expo group-hover:opacity-100 group-hover/ch:-translate-y-1">
                    {c.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
