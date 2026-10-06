'use client';

import { useFrame } from '@react-three/fiber';
import type { MotionValue } from 'framer-motion';
import { useReducedMotion } from 'framer-motion';
import { useRef } from 'react';
import { DRAWING_COLORS, STYLED_COLORS } from '@/lib/plan';
import OfficeModel, { defaultControls, type ModelControls } from './OfficeModel';
import Stage from './Stage';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const range = (v: number, from: number, to: number) => clamp01((v - from) / (to - from));

type Mode = 'build' | 'explode';

type Props = {
  active: boolean;
  label: string;
  /** Scroll progress of the pinned section, 0-1 */
  progress: MotionValue<number>;
  mode: Mode;
  lite?: boolean;
  labels?: readonly string[];
};

function Driver({ progress, mode, still, controls }: { progress: MotionValue<number>; mode: Mode; still: boolean; controls: React.MutableRefObject<ModelControls> }) {
  useFrame(() => {
    const p = still ? 1 : progress.get();
    if (mode === 'build') {
      // Blueprint until 15%, walls rise by 70%, colours apply after 75%
      controls.current.rise = range(p, 0.15, 0.7);
      controls.current.colors = p > 0.75 ? STYLED_COLORS : DRAWING_COLORS;
    } else {
      controls.current.explode = range(p, 0.2, 0.65);
    }
  });
  return null;
}

/** Scroll-scrubbed office: "build" grows it from the blueprint, "explode" separates its layers. */
export default function ScrollScene({ active, label, progress, mode, lite, labels }: Props) {
  const still = !!useReducedMotion();
  const controls = useRef(
    defaultControls(mode === 'build' ? { rise: still ? 1 : 0 } : { colors: STYLED_COLORS, explode: still ? 1 : 0 }),
  );
  return (
    <Stage active={active} label={label} camera={{ position: mode === 'build' ? [15, 17, 17] : [20, 16, 20], fov: mode === 'build' ? 35 : 40 }} shadows={mode === 'build'}>
      <Driver progress={progress} mode={mode} still={still} controls={controls} />
      <group position={mode === 'explode' ? [-1.5, -3, 0] : [0, 0, 0]}>
        <OfficeModel controls={controls} lite={lite} blueprint={mode === 'build'} labels={labels} />
      </group>
    </Stage>
  );
}
