'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { site } from '@/content/site';
import Canvas3D from '@/components/three/Canvas3D';
import BlueprintArt from '@/components/ui/BlueprintArt';
import { SectionTitle } from '@/components/ui/Reveal';
import type { FlyKey } from '@/components/three/FlyScene';
import { useLite } from '@/lib/useLite';

const FlyScene = dynamic(() => import('@/components/three/FlyScene'), {
  ssr: false,
  loading: () => <BlueprintArt className="h-full w-full p-10" label={site.a11y.sceneFallback} />,
});

function KeyCap({ k, on }: { k: string; on: boolean }) {
  return (
    <span
      className={`flex h-11 w-11 items-center justify-center rounded-lg border font-display text-sm font-semibold transition-all duration-200 ${
        on ? 'translate-y-0.5 border-cyan bg-cyan text-ink shadow-[0_0_24px_rgba(61,214,245,0.55)]' : 'border-white/20 bg-ink/70 text-paper backdrop-blur'
      }`}
    >
      {k}
    </span>
  );
}

/** Letterboxed first-person fly-through; W A S D keys light up with the camera's movement. */
export default function WalkThrough() {
  const lite = useLite();
  const [key, setKey] = useState<FlyKey>('w');
  return (
    <section className="py-32" aria-labelledby="walk-title">
      <div className="mx-auto max-w-[1440px] px-6 sm:px-10">
        <SectionTitle id="walk-title" index={site.sections.walk.index} eyebrow={site.sections.walk.eyebrow} headline={site.walk.headline} line={site.walk.line} />
      </div>
      <div className="relative mx-auto mt-16 max-w-[1600px] px-0 sm:px-10">
        <div className="relative aspect-[16/10] overflow-hidden bg-surface sm:aspect-[21/9] sm:rounded-3xl">
          <Canvas3D className="absolute inset-0" fallbackLabel={site.a11y.sceneFallback}>
            {(active) => <FlyScene active={active} onKey={setKey} lite={lite} label={site.a11y.modelAlt} />}
          </Canvas3D>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[8%] bg-black" />
          {/* HUD: crosshair, mode readout, live indicator */}
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <svg className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-paper/70" width="36" height="36" viewBox="0 0 36 36" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M18 4v8M18 24v8M4 18h8M24 18h8" />
              <circle cx="18" cy="18" r="1.5" fill="currentColor" />
            </svg>
            <div className="absolute left-6 top-[12%] space-y-1 font-mono text-[11px] uppercase tracking-[0.2em] text-paper/80 sm:left-10">
              <p className="flex items-center gap-2"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />{site.walk.hud.live}</p>
              <p>{site.walk.hud.mode}</p>
              <p className="text-muted">{site.walk.hud.eye}</p>
            </div>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[8%] bg-black" />
          <div className="absolute bottom-[12%] right-6 grid grid-cols-3 gap-1.5 sm:right-10" aria-hidden="true">
            <span />
            <KeyCap k="W" on={key === 'w'} />
            <span />
            <KeyCap k="A" on={key === 'a'} />
            <KeyCap k="S" on={false} />
            <KeyCap k="D" on={key === 'd'} />
          </div>
        </div>
      </div>
    </section>
  );
}
