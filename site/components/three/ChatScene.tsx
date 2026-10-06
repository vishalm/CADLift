'use client';

import { OrbitControls } from '@react-three/drei';
import { useReducedMotion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { DRAWING_COLORS, STYLED_COLORS, type LayerColors } from '@/lib/plan';
import OfficeModel, { defaultControls } from './OfficeModel';
import Stage from './Stage';

const BASE_HEIGHT = 3.6;

/** Look after each chat step (cumulative): 0 = as drawn, 1 = oak furniture, 2 = concrete floor, 3 = off-white 2.8 m walls. */
export function lookForStep(step: number): { colors: LayerColors; wallHeight: number } {
  const colors: LayerColors = { ...DRAWING_COLORS };
  if (step >= 1) colors.furniture = STYLED_COLORS.furniture;
  if (step >= 2) colors.floor = STYLED_COLORS.floor;
  if (step >= 3) colors.walls = STYLED_COLORS.walls;
  return { colors, wallHeight: step >= 3 ? 2.8 : BASE_HEIGHT };
}

type Props = { active: boolean; label: string; step: number; lite?: boolean };

/** The office restyling live as the chat demo applies each prompt. */
export default function ChatScene({ active, label, step, lite }: Props) {
  const still = !!useReducedMotion();
  const controls = useRef(defaultControls({ ...lookForStep(step) }));

  useEffect(() => {
    Object.assign(controls.current, lookForStep(step));
  }, [step]);

  return (
    <Stage active={active} label={label} camera={{ position: [14, 15, 17], fov: 38 }}>
      <OfficeModel controls={controls} lite={lite} blueprint={false} />
      <OrbitControls makeDefault enableZoom={false} enablePan={false} autoRotate={!still && !lite} autoRotateSpeed={0.35} enableDamping minPolarAngle={0.4} maxPolarAngle={1.2} />
    </Stage>
  );
}
