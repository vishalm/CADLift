/**
 * WorldViewer - full-screen walkthrough of a World Labs Gaussian splat world (.spz), ported from
 * image-blaster's viewer: same orientation rules (flip_y, ground_plane_offset, metric_scale_factor),
 * Spark for splat rendering and Spark's fly controls (WASD + mouse drag). Plays an ambient loop
 * when one is given.
 *
 * ponytail: image-blaster's character, physics colliders, object placement and post effects are
 * not ported; the collider mesh is offered as a download only. Add them if walkthroughs need them.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as THREE from 'three';
import { SparkControls, SparkRenderer, SplatFileType, SplatMesh } from '@sparkjsdev/spark';

export interface WorldMeta {
  flip_y?: boolean;
  ground_plane_offset?: number;
  metric_scale_factor?: number;
  caption?: string;
}

interface WorldViewerProps {
  spzUrl: string;
  meta?: WorldMeta;
  audioUrl?: string;
  onClose: () => void;
}

const svg = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

const CloseIcon = () => <svg {...svg}><path d="M18 6 6 18M6 6l12 12" /></svg>;
const SoundOnIcon = () => (
  <svg {...svg}><path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" /></svg>
);
const SoundOffIcon = () => (
  <svg {...svg}><path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="m23 9-6 6M17 9l6 6" /></svg>
);

const barButton =
  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-white hover:bg-white/15 transition-colors';

const WorldViewer: React.FC<WorldViewerProps> = ({ spzUrl, meta, audioUrl, onClose }) => {
  const { t } = useTranslation();
  const mountRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [soundOn, setSoundOn] = useState(true);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;

    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#6b7280');
    // World Labs worlds are built around the source photo's viewpoint at the origin.
    const camera = new THREE.PerspectiveCamera(70, mount.clientWidth / Math.max(mount.clientHeight, 1), 0.05, 1000);
    scene.add(new SparkRenderer({ renderer }));

    const world = new THREE.Group();
    world.position.y = meta?.ground_plane_offset ?? 0;
    world.rotation.x = (meta?.flip_y ?? true) ? Math.PI : 0;
    world.scale.setScalar(meta?.metric_scale_factor ?? 1);
    scene.add(world);

    let splat: SplatMesh | null = null;
    fetch(spzUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.arrayBuffer();
      })
      .then((bytes) => {
        if (disposed) return;
        splat = new SplatMesh({ fileBytes: bytes, fileType: SplatFileType.SPZ });
        world.add(splat);
        return splat.initialized;
      })
      .then(() => {
        if (!disposed) setState('ready');
      })
      .catch((err: unknown) => {
        if (disposed) return;
        setError(err instanceof Error ? err.message : String(err));
        setState('error');
      });

    const controls = new SparkControls({ canvas: renderer.domElement });
    renderer.setAnimationLoop(() => {
      controls.update(camera);
      renderer.render(scene, camera);
    });

    const observer = new ResizeObserver(() => {
      const { clientWidth: w, clientHeight: h } = mount;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    observer.observe(mount);

    return () => {
      disposed = true;
      observer.disconnect();
      renderer.setAnimationLoop(null);
      splat?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [spzUrl, meta?.flip_y, meta?.ground_plane_offset, meta?.metric_scale_factor]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (soundOn) audio.play().catch(() => setSoundOn(false));
    else audio.pause();
  }, [soundOn, audioUrl]);

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900" role="dialog" aria-modal="true" aria-label={t('world.title')}>
      <div ref={mountRef} className="absolute inset-0" />
      <header className="absolute top-0 inset-x-0 h-12 flex items-center justify-between gap-2 px-2 sm:px-4 bg-black/50 backdrop-blur">
        <h2 className="text-sm font-bold text-white truncate">{meta?.caption || t('world.title')}</h2>
        <div className="flex items-center gap-1">
          {audioUrl && (
            <button
              type="button"
              onClick={() => setSoundOn((on) => !on)}
              aria-pressed={soundOn}
              aria-label={soundOn ? t('world.soundOff') : t('world.soundOn')}
              className={barButton}
            >
              {soundOn ? <SoundOnIcon /> : <SoundOffIcon />}
              <span className="hidden md:inline">{soundOn ? t('world.soundOff') : t('world.soundOn')}</span>
            </button>
          )}
          <button type="button" onClick={onClose} className={barButton} aria-label={t('world.close')}>
            <CloseIcon />
            <span className="hidden md:inline">{t('world.close')}</span>
          </button>
        </div>
      </header>
      {state === 'ready' && (
        <p className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg bg-black/60 text-white text-xs text-center">
          {t('world.controls')}
        </p>
      )}
      {state !== 'ready' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p role={state === 'error' ? 'alert' : 'status'} className="px-4 py-2 rounded-lg bg-black/60 text-white text-sm">
            {state === 'loading' ? t('world.loading') : t('world.error', { error })}
          </p>
        </div>
      )}
      {audioUrl && <audio ref={audioRef} src={audioUrl} loop />}
    </div>
  );
};

export default WorldViewer;
