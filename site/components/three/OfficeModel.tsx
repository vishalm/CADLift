'use client';

import { Html, Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import {
  BLUEPRINT,
  COLUMNS,
  DRAWING_COLORS,
  FURNITURE,
  PLAN,
  PLANTS,
  WALLS,
  WALL_HEIGHT,
  WALL_THICKNESS,
  type LayerColors,
} from '@/lib/plan';
import { concreteFloor, plaster, woodGrain } from '@/lib/textures';

/** Live controls a scene mutates; the model eases colours and wall height toward them. */
export type ModelControls = {
  /** 0 = flat blueprint, 1 = fully built */
  rise: number;
  /** 0 = stacked, 1 = layers fully separated */
  explode: number;
  wallHeight: number;
  colors: LayerColors;
};

export const defaultControls = (overrides: Partial<ModelControls> = {}): ModelControls => ({
  rise: 1,
  explode: 0,
  wallHeight: WALL_HEIGHT,
  colors: DRAWING_COLORS,
  ...overrides,
});

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const stagger = (rise: number, index: number, count: number, start: number, spread: number, length: number) =>
  easeOut(clamp01((rise - (start + (index / Math.max(count, 1)) * spread)) / length));

const LAYER_GAP = 2.4;

type Props = {
  controls: MutableRefObject<ModelControls>;
  /** Fewer meshes on small screens */
  lite?: boolean;
  /** Draw the cyan blueprint lines on the floor */
  blueprint?: boolean;
  /** Optional labels per layer: [furniture, plants, walls, floor] */
  labels?: readonly string[];
};

export default function OfficeModel({ controls, lite = false, blueprint = true, labels }: Props) {
  const unitBox = useMemo(() => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), []);
  const pot = useMemo(() => new THREE.CylinderGeometry(0.22, 0.18, 0.4, 10).translate(0, 0.2, 0), []);
  const leaves = useMemo(() => new THREE.IcosahedronGeometry(0.42, 0).translate(0, 0.85, 0), []);

  const mats = useMemo(() => {
    // Real-world surface detail; colours still come from the layer colours (textures are light grey).
    const floor = concreteFloor(PLAN.width + 0.4, PLAN.depth + 0.4);
    return {
      floor: new THREE.MeshStandardMaterial({ roughness: 0.55, map: floor.map, bumpMap: floor.bump, bumpScale: 0.6 }),
      walls: new THREE.MeshStandardMaterial({ roughness: 0.9, map: plaster() }),
      furniture: new THREE.MeshStandardMaterial({ roughness: 0.62, map: woodGrain() }),
      plants: new THREE.MeshStandardMaterial({ roughness: 0.8, flatShading: true }),
      columns: new THREE.MeshStandardMaterial({ roughness: 0.9 }),
      pot: new THREE.MeshStandardMaterial({ color: '#e8e4dc', roughness: 0.6 }),
    };
  }, []);

  const walls = useMemo(
    () =>
      WALLS.map(([x1, z1, x2, z2]) => ({
        x: (x1 + x2) / 2,
        z: (z1 + z2) / 2,
        len: Math.hypot(x2 - x1, z2 - z1) + WALL_THICKNESS,
        angle: -Math.atan2(z2 - z1, x2 - x1),
        pts: [[x1, 0.02, z1], [x2, 0.02, z2]] as [number, number, number][],
      })),
    [],
  );
  const furniture = useMemo(() => (lite ? FURNITURE.filter((_, i) => i % 2 === 0 || i >= 32) : FURNITURE), [lite]);
  const plants = useMemo(() => (lite ? PLANTS.slice(0, 5) : PLANTS), [lite]);

  const wallRefs = useRef<THREE.Mesh[]>([]);
  const columnRefs = useRef<THREE.Mesh[]>([]);
  const furnRefs = useRef<THREE.Mesh[]>([]);
  const plantRefs = useRef<THREE.Group[]>([]);
  const layerRefs = useRef<THREE.Group[]>([]);
  const lineRefs = useRef<Array<{ material: { opacity: number } } | null>>([]);
  const labelRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const height = useRef(controls.current.wallHeight);
  const colorCache = useRef(new Map<string, THREE.Color>());

  const target = (hex: string) => {
    let c = colorCache.current.get(hex);
    if (!c) {
      c = new THREE.Color(hex);
      colorCache.current.set(hex, c);
    }
    return c;
  };

  // Snap colours on first frame so there is no fade from black.
  const initialised = useRef(false);

  useFrame((_, dt) => {
    const c = controls.current;
    const k = initialised.current ? 1 - Math.exp(-Math.min(dt, 0.1) * 4) : 1;
    initialised.current = true;
    (Object.keys(c.colors) as Array<keyof LayerColors>).forEach((layer) => mats[layer].color.lerp(target(c.colors[layer]), k));
    height.current += (c.wallHeight - height.current) * k;

    walls.forEach((w, i) => {
      const m = wallRefs.current[i];
      if (m) m.scale.set(w.len, Math.max(0.001, height.current * stagger(c.rise, i, walls.length, 0, 0.45, 0.5)), WALL_THICKNESS);
    });
    COLUMNS.forEach((col, i) => {
      const m = columnRefs.current[i];
      if (m) m.scale.set(col.w, Math.max(0.001, height.current * stagger(c.rise, i, COLUMNS.length, 0.2, 0.3, 0.4)), col.d);
    });
    furniture.forEach((f, i) => {
      const m = furnRefs.current[i];
      const p = stagger(c.rise, i, furniture.length, 0.45, 0.35, 0.2);
      if (m) m.scale.set(f.w * Math.max(p, 0.001), f.h * Math.max(p, 0.001), f.d * Math.max(p, 0.001));
    });
    plants.forEach((pl, i) => {
      const g = plantRefs.current[i];
      const p = stagger(c.rise, i, plants.length, 0.6, 0.3, 0.15) * pl.s;
      if (g) g.scale.setScalar(Math.max(p, 0.001));
    });
    // Layer order bottom to top: floor 0, walls 1, plants 2, furniture 3
    layerRefs.current.forEach((g, i) => g && (g.position.y = c.explode * i * LAYER_GAP));
    // Labels only once layers have separated enough not to overlap.
    const labelOpacity = String(clamp01((c.explode - 0.35) / 0.3));
    labelRefs.current.forEach((el) => el && (el.style.opacity = labelOpacity));
    const lineOpacity = 1 - 0.75 * clamp01(c.rise);
    lineRefs.current.forEach((l) => l && (l.material.opacity = lineOpacity));
  });

  const label = (text: string | undefined, y: number, slot: number) =>
    text ? (
      <Html position={[PLAN.width + 0.8, y, PLAN.depth / 2]} center={false} zIndexRange={[10, 0]}>
        <span
          ref={(el) => { labelRefs.current[slot] = el; }}
          style={{ opacity: 0, transition: 'opacity 200ms' }}
          className="pointer-events-none whitespace-nowrap rounded-full border border-white/15 bg-ink/80 px-3 py-1 text-xs font-medium text-paper backdrop-blur">
          {text}
        </span>
      </Html>
    ) : null;

  return (
    <group position={[-PLAN.width / 2, 0, -PLAN.depth / 2]}>
      <group ref={(g) => { if (g) layerRefs.current[0] = g; }}>
        <mesh receiveShadow geometry={unitBox} material={mats.floor} position={[PLAN.width / 2, -0.12, PLAN.depth / 2]} scale={[PLAN.width + 0.4, 0.12, PLAN.depth + 0.4]} />
        {blueprint &&
          walls.map((w, i) => (
            <Line
              key={i}
              ref={(l) => { lineRefs.current[i] = l as unknown as { material: { opacity: number } } | null; }}
              points={w.pts}
              color={BLUEPRINT}
              lineWidth={1.6}
              transparent
              opacity={1}
            />
          ))}
        {label(labels?.[3], 0.2, 3)}
      </group>

      <group ref={(g) => { if (g) layerRefs.current[1] = g; }}>
        {walls.map((w, i) => (
          <mesh
            key={i}
            castShadow
            receiveShadow
            ref={(m) => { if (m) wallRefs.current[i] = m; }}
            geometry={unitBox}
            material={mats.walls}
            position={[w.x, 0, w.z]}
            rotation={[0, w.angle, 0]}
            scale={[w.len, 0.001, WALL_THICKNESS]}
          />
        ))}
        {COLUMNS.map((col, i) => (
          <mesh
            key={i}
            castShadow
            ref={(m) => { if (m) columnRefs.current[i] = m; }}
            geometry={unitBox}
            material={mats.columns}
            position={[col.x, 0, col.z]}
            scale={[col.w, 0.001, col.d]}
          />
        ))}
        {label(labels?.[2], 1.5, 2)}
      </group>

      <group ref={(g) => { if (g) layerRefs.current[2] = g; }}>
        {plants.map((pl, i) => (
          <group key={i} ref={(g) => { if (g) plantRefs.current[i] = g; }} position={[pl.x, 0, pl.z]} scale={0.001}>
            <mesh castShadow geometry={pot} material={mats.pot} />
            <mesh castShadow geometry={leaves} material={mats.plants} />
          </group>
        ))}
        {label(labels?.[1], 0.8, 1)}
      </group>

      <group ref={(g) => { if (g) layerRefs.current[3] = g; }}>
        {furniture.map((f, i) => (
          <mesh
            key={i}
            castShadow
            receiveShadow
            ref={(m) => { if (m) furnRefs.current[i] = m; }}
            geometry={unitBox}
            material={mats.furniture}
            position={[f.x, 0, f.z]}
            scale={0.001}
          />
        ))}
        {label(labels?.[0], 0.6, 0)}
      </group>
    </group>
  );
}
