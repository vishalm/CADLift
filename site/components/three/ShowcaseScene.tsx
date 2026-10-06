'use client';

import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useReducedMotion } from 'framer-motion';
import { useRef, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { DRAWING_COLORS, STYLED_COLORS } from '@/lib/plan';
import OfficeModel, { defaultControls, type ModelControls } from './OfficeModel';
import Stage from './Stage';

type Props = {
  active: boolean;
  label: string;
  /** Walls rise out of the blueprint and the camera eases from top-down into 3/4 */
  intro?: boolean;
  dusk?: boolean;
  lite?: boolean;
  autoRotateSpeed?: number;
  styled?: boolean;
  cameraPosition?: [number, number, number];
  interactive?: boolean;
};

const INTRO_SECONDS = 2.6;
const TOP = new THREE.Vector3(0, 34, 0.01);

function Rig({ intro, end, still, onDone }: { intro: boolean; end: THREE.Vector3; still: boolean; onDone: () => void }) {
  const camera = useThree((s) => s.camera);
  const t = useRef(0);
  const done = useRef(!intro || still);
  useFrame((_, dt) => {
    if (done.current) return;
    t.current = Math.min(1, t.current + dt / INTRO_SECONDS);
    const e = 1 - Math.pow(1 - t.current, 3);
    camera.position.lerpVectors(TOP, end, e);
    camera.lookAt(0, 0, 0);
    if (t.current >= 1) {
      done.current = true;
      onDone();
    }
  });
  return null;
}

/** Grows the walls out of the blueprint over the intro. */
function Riser({ controls }: { controls: MutableRefObject<ModelControls> }) {
  useFrame((_, dt) => {
    if (controls.current.rise < 1) controls.current.rise = Math.min(1, controls.current.rise + dt / (INTRO_SECONDS * 0.85));
  });
  return null;
}

/** The office model on show: hero intro, export centrepiece and closing scene. */
export default function ShowcaseScene({
  active,
  label,
  intro = false,
  dusk = false,
  lite = false,
  autoRotateSpeed = 0.5,
  styled = true,
  cameraPosition = [16, 13, 18],
  interactive = true,
}: Props) {
  const reduced = !!useReducedMotion();
  const still = reduced;
  const controls = useRef(defaultControls({ rise: intro && !still ? 0 : 1, colors: styled ? STYLED_COLORS : DRAWING_COLORS }));
  const [introDone, setIntroDone] = useState(!intro || still);
  const end = useRef(new THREE.Vector3(...cameraPosition)).current;

  return (
    <Stage active={active} dusk={dusk} label={label} camera={{ position: intro && !still ? [0, 34, 0.01] : cameraPosition }}>
      {intro && !still && <Riser controls={controls} />}
      <Rig intro={intro} end={end} still={still} onDone={() => setIntroDone(true)} />
      <OfficeModel controls={controls} lite={lite} />
      {introDone && (
        <OrbitControls
          makeDefault
          target={[0, 0, 0]}
          enableZoom={false}
          enablePan={false}
          enableRotate={interactive}
          autoRotate={!still && !lite}
          autoRotateSpeed={autoRotateSpeed}
          enableDamping
          minPolarAngle={0.35}
          maxPolarAngle={1.25}
        />
      )}
    </Stage>
  );
}
