'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useReducedMotion } from 'framer-motion';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { PLAN, STYLED_COLORS } from '@/lib/plan';
import OfficeModel, { defaultControls } from './OfficeModel';
import Stage from './Stage';

export type FlyKey = 'w' | 'a' | 'd';

const EYE = 1.6;
const LOOP_SECONDS = 30;
// Plan coordinates (x, z) of a loop through reception, the desk aisle, the lounge and back.
const PATH: Array<[number, number]> = [
  [2.8, 0.8], [2.8, 3], [5.5, 4.1], [9.5, 4.1], [13.6, 4.1], [14.3, 6.9], [12, 8.8], [9, 7.2], [6, 7], [4.2, 5.4],
];

function Camera({ onKey, still }: { onKey: (key: FlyKey) => void; still: boolean }) {
  const camera = useThree((s) => s.camera);
  const curve = useMemo(
    () => new THREE.CatmullRomCurve3(PATH.map(([x, z]) => new THREE.Vector3(x - PLAN.width / 2, EYE, z - PLAN.depth / 2)), true, 'centripetal'),
    [],
  );
  const t = useRef(0);
  const lastKey = useRef<FlyKey>('w');
  const ahead = useMemo(() => new THREE.Vector3(), []);
  const tanNow = useMemo(() => new THREE.Vector3(), []);
  const tanNext = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, dt) => {
    if (!still) t.current = (t.current + Math.min(dt, 0.1) / LOOP_SECONDS) % 1;
    curve.getPointAt(t.current, camera.position);
    curve.getPointAt((t.current + 0.012) % 1, ahead);
    camera.lookAt(ahead);
    // Turning left or right shows A or D on the keyboard graphic, straight shows W.
    curve.getTangentAt(t.current, tanNow);
    curve.getTangentAt((t.current + 0.02) % 1, tanNext);
    const turn = tanNow.x * tanNext.z - tanNow.z * tanNext.x;
    const key: FlyKey = turn > 0.05 ? 'd' : turn < -0.05 ? 'a' : 'w';
    if (key !== lastKey.current) {
      lastKey.current = key;
      onKey(key);
    }
  });
  return null;
}

type Props = { active: boolean; label: string; onKey: (key: FlyKey) => void; lite?: boolean };

/** First-person fly-through of the office along a scripted path. */
export default function FlyScene({ active, label, onKey, lite }: Props) {
  const still = !!useReducedMotion();
  const controls = useRef(defaultControls({ colors: STYLED_COLORS, wallHeight: 2.8 }));
  return (
    <Stage active={active} label={label} camera={{ position: [0, EYE, 0], fov: 62 }} shadows={false}>
      <Camera onKey={onKey} still={still} />
      <OfficeModel controls={controls} lite={lite} blueprint={false} />
    </Stage>
  );
}
