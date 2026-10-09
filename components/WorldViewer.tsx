/**
 * WorldViewer - full-screen walkthrough of a World Labs Gaussian splat world (.spz), ported from
 * image-blaster's viewer: same orientation rules (flip_y, ground_plane_offset, metric_scale_factor),
 * Spark for splat rendering and Spark's controls (WASD + mouse drag). Plays an ambient loop when one
 * is given. With the world's collider mesh, walk mode keeps you at eye height on the floor and stops
 * you at walls (utils/walk.ts); fly mode moves freely.
 *
 * 3D object renders can be placed in front of the camera, then selected (click), turned, resized,
 * moved or removed; the list is saved through onSavePlacements.
 *
 * ponytail: image-blaster's character, rigid-body physics and post effects are not ported. Collider
 * raycasts are brute force; add three-mesh-bvh if large colliders make walking stutter.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SparkControls, SparkRenderer, SplatFileType, SplatMesh } from '@sparkjsdev/spark';
import { EYE_HEIGHT, snapToFloor, walkStep, type CastFn } from '../utils/walk';
import { pickPlacement, useWorldObjects, type Placement, type WorldObject } from './useWorldObjects';

const PLACE_DISTANCE = 2.5; // metres in front of the camera
const TURN_STEP = Math.PI / 12; // 15 degrees
const SCALE_STEP = 1.15;
const CLICK_SLOP_PX = 5; // a drag longer than this is looking around, not selecting

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
  /** Finished 3D object renders that can be placed into the world. */
  objects?: WorldObject[];
  placements?: Placement[];
  onSavePlacements?: (placements: Placement[]) => Promise<void>;
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

const panelButton =
  'px-2 py-1 rounded-md text-xs font-semibold text-white border border-white/30 hover:bg-white/15 disabled:opacity-40';

const WorldViewer: React.FC<WorldViewerProps> = ({
  spzUrl, colliderUrl, meta, audioUrl, objects = [], placements = [], onSavePlacements, onClose,
}) => {
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

  // Objects arrive from job polling as fresh arrays every few seconds; only rebuild when they change.
  const objectKey = objects.map((o) => `${o.id}:${o.modelUrl}`).join('|');
  const placeable = useMemo(() => objects, [objectKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const [placed, setPlaced] = useState<Placement[]>(placements);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [choice, setChoice] = useState(objects[0]?.id ?? '');
  const [saveError, setSaveError] = useState('');
  const [placedRoot, setPlacedRoot] = useState<THREE.Group | null>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const floorCastRef = useRef<CastFn | null>(null);
  useWorldObjects(placedRoot, placeable, placed, selectedId);
  const selected = placed.find((p) => p.id === selectedId) ?? null;

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
    // Splats carry their own lighting; placed 3D objects (PBR) need lights.
    scene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(5, 10, 7);
    scene.add(sun);
    const objectsRoot = new THREE.Group();
    scene.add(objectsRoot);
    setPlacedRoot(objectsRoot);
    cameraRef.current = camera;

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
          floorCastRef.current = cast;
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

    // A click (not a drag) selects the placed object under the pointer, or clears the selection.
    const picker = new THREE.Raycaster();
    let down: { x: number; y: number } | null = null;
    const onPointerDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > CLICK_SLOP_PX) return;
      const rect = renderer.domElement.getBoundingClientRect();
      picker.setFromCamera(new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      ), camera);
      setSelectedId(pickPlacement(objectsRoot, picker));
    };
    if (import.meta.env.DEV) { // hooks for browser e2e checks
      Object.assign(window, { __world: { camera, objectsRoot, pickAt: (x: number, y: number) => {
        picker.setFromCamera(new THREE.Vector2(x, y), camera);
        return pickPlacement(objectsRoot, picker);
      } } });
    }
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
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
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      floorCastRef.current = null;
      setPlacedRoot(null);
      renderer.setAnimationLoop(null);
      splat?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [spzUrl, colliderUrl, meta?.flip_y, meta?.ground_plane_offset, meta?.metric_scale_factor]);

  /** On the floor, PLACE_DISTANCE ahead of the camera (floor from the collider when there is one). */
  const inFront = (): [number, number, number] => {
    const camera = cameraRef.current;
    if (!camera) return [0, -EYE_HEIGHT, -PLACE_DISTANCE];
    const dir = camera.getWorldDirection(new THREE.Vector3()).setY(0);
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
    dir.normalize().multiplyScalar(PLACE_DISTANCE);
    const x = camera.position.x + dir.x;
    const z = camera.position.z + dir.z;
    const cast = floorCastRef.current;
    const eye = (cast && snapToFloor({ x, y: camera.position.y, z }, cast)?.y) ?? camera.position.y;
    return [x, eye - EYE_HEIGHT, z];
  };

  const commit = (next: Placement[]) => {
    setPlaced(next);
    setSaveError('');
    onSavePlacements?.(next).catch((err: unknown) => setSaveError(err instanceof Error ? err.message : String(err)));
  };

  const placeObject = () => {
    if (!choice) return;
    const placement: Placement = {
      id: crypto.randomUUID(), object_render_id: choice, position: inFront(), rotation_y: 0, scale: 1,
    };
    commit([...placed, placement]);
    setSelectedId(placement.id);
  };

  const editSelected = (change: (p: Placement) => Placement | null) => {
    if (!selected) return;
    const next = change(selected);
    commit(next ? placed.map((p) => (p.id === selected.id ? next : p)) : placed.filter((p) => p.id !== selected.id));
    if (!next) setSelectedId(null);
  };
  const clampScale = (value: number) => Math.min(50, Math.max(0.05, value));

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
      {state === 'ready' && placeable.length > 0 && onSavePlacements && (
        <div className="absolute top-14 left-2 w-64 p-2 space-y-2 rounded-lg bg-black/60 text-white text-xs">
          <p className="font-semibold">{t('world.objects')}</p>
          <div className="flex gap-1.5">
            <label htmlFor="world-object" className="sr-only">{t('world.objects')}</label>
            <select
              id="world-object"
              value={choice}
              onChange={(e) => setChoice(e.target.value)}
              className="flex-1 min-w-0 px-1.5 py-1 rounded-md bg-slate-900 border border-white/30"
            >
              {placeable.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <button type="button" onClick={placeObject} disabled={!choice} className={panelButton}>{t('world.place')}</button>
          </div>
          {selected ? (
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className={panelButton}
                onClick={() => editSelected((p) => ({ ...p, rotation_y: p.rotation_y + TURN_STEP }))}>{t('world.turnLeft')}</button>
              <button type="button" className={panelButton}
                onClick={() => editSelected((p) => ({ ...p, rotation_y: p.rotation_y - TURN_STEP }))}>{t('world.turnRight')}</button>
              <button type="button" className={panelButton}
                onClick={() => editSelected((p) => ({ ...p, scale: clampScale(p.scale / SCALE_STEP) }))}>{t('world.smaller')}</button>
              <button type="button" className={panelButton}
                onClick={() => editSelected((p) => ({ ...p, scale: clampScale(p.scale * SCALE_STEP) }))}>{t('world.bigger')}</button>
              <button type="button" className={panelButton}
                onClick={() => editSelected((p) => ({ ...p, position: inFront() }))}>{t('world.moveHere')}</button>
              <button type="button" className={`${panelButton} text-red-300`}
                onClick={() => editSelected(() => null)}>{t('world.remove')}</button>
            </div>
          ) : (
            <p className="text-white/70">{placed.length ? t('world.selectHint') : t('world.placeHint')}</p>
          )}
          {saveError && <p role="alert" className="text-red-300">{t('world.saveFailed', { error: saveError })}</p>}
        </div>
      )}
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
