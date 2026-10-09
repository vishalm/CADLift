/**
 * WorldViewer - full-screen walkthrough of a World Labs Gaussian splat world (.spz), ported from
 * image-blaster's viewer: same orientation rules (flip_y, ground_plane_offset, metric_scale_factor),
 * Spark for splat rendering and Spark's controls (WASD + mouse drag). Plays an ambient loop when one
 * is given. With the world's collider mesh, walk mode keeps you at eye height on the floor and stops
 * you at walls (utils/walk.ts); fly mode moves freely.
 *
 * ponytail: image-blaster's character, rigid-body physics and post effects are not ported. Collider
 * raycasts are brute force; add three-mesh-bvh if large colliders make walking stutter.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SparkControls, SparkRenderer, SplatFileType, SplatMesh } from '@sparkjsdev/spark';
import { snapToFloor, walkStep, type CastFn } from '../utils/walk';

export interface WorldMeta {
  flip_y?: boolean;
  ground_plane_offset?: number;
  metric_scale_factor?: number;
  caption?: string;
}

interface WorldViewerProps {
  spzUrl: string;
  /** World Labs collider mesh (.glb); enables walk mode. */
  colliderUrl?: string;
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
const WalkIcon = () => (
  <svg {...svg}><circle cx="13" cy="4" r="2" /><path d="m9 20 3-6 3 3v5M6 12l3-4 4 1 3 3 3 1M10 8l-2 6" /></svg>
);
const FlyIcon = () => (
  <svg {...svg}><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" /></svg>
);

/** Same placement image-blaster gives the splat: ground offset, optional upside-down flip, metric scale. */
function placeWorld(group: THREE.Object3D, meta?: WorldMeta) {
  group.position.y = meta?.ground_plane_offset ?? 0;
  group.rotation.x = (meta?.flip_y ?? true) ? Math.PI : 0;
  group.scale.setScalar(meta?.metric_scale_factor ?? 1);
}

const SoundOnIcon = () => (
  <svg {...svg}><path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" /></svg>
);
const SoundOffIcon = () => (
  <svg {...svg}><path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="m23 9-6 6M17 9l6 6" /></svg>
);

const barButton =
  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-white hover:bg-white/15 transition-colors';

const WorldViewer: React.FC<WorldViewerProps> = ({ spzUrl, colliderUrl, meta, audioUrl, onClose }) => {
  const { t } = useTranslation();
  const mountRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [soundOn, setSoundOn] = useState(true);
  const [hasCollider, setHasCollider] = useState(false);
  const [walking, setWalking] = useState(true);
  const walkingRef = useRef(walking);
  walkingRef.current = walking && hasCollider;

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
    placeWorld(world, meta);
    scene.add(world);

    // The collider is never drawn: it lives outside the scene and is only raycast against.
    const collider = new THREE.Group();
    placeWorld(collider, meta);
    const raycaster = new THREE.Raycaster();
    const cast: CastFn = (origin, dir, far) => {
      raycaster.set(new THREE.Vector3(origin.x, origin.y, origin.z), new THREE.Vector3(dir.x, dir.y, dir.z));
      raycaster.far = far;
      return raycaster.intersectObject(collider, true)[0]?.distance ?? null;
    };
    let snapped = false;
    if (colliderUrl) {
      new GLTFLoader().loadAsync(colliderUrl)
        .then((gltf) => {
          if (disposed) return;
          collider.add(gltf.scene);
          collider.updateMatrixWorld(true);
          setHasCollider(true);
        })
        .catch((err: unknown) => console.warn('World collider failed to load; walk mode off', err));
    }

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
    if (import.meta.env.DEV) (window as unknown as { __worldCamera?: THREE.Camera }).__worldCamera = camera; // e2e checks
    const prev = new THREE.Vector3();
    renderer.setAnimationLoop(() => {
      prev.copy(camera.position);
      controls.update(camera);
      if (walkingRef.current) {
        const at = snapped ? walkStep(prev, camera.position, cast) : snapToFloor(camera.position, cast);
        if (at) camera.position.set(at.x, at.y, at.z);
        snapped = snapped || at !== null;
      } else {
        snapped = false; // re-land on the floor when walking resumes
      }
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
  }, [spzUrl, colliderUrl, meta?.flip_y, meta?.ground_plane_offset, meta?.metric_scale_factor]);

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
          {hasCollider && (
            <button
              type="button"
              onClick={() => setWalking((on) => !on)}
              aria-pressed={walking}
              aria-label={walking ? t('world.fly') : t('world.walk')}
              className={barButton}
            >
              {walking ? <FlyIcon /> : <WalkIcon />}
              <span className="hidden md:inline">{walking ? t('world.fly') : t('world.walk')}</span>
            </button>
          )}
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
          {walkingRef.current ? t('world.controlsWalk') : t('world.controls')}
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
