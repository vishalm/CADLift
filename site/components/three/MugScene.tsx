'use client';

import { useFrame } from '@react-three/fiber';
import { useReducedMotion } from 'framer-motion';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import Stage from './Stage';

function Mug({ still }: { still: boolean }) {
  const group = useRef<THREE.Group>(null);
  const grow = useRef(still ? 1 : 0);
  const body = useMemo(() => {
    // Half profile of a 90 mm mug with a 3 mm wall (scaled up for the scene)
    const pts = [
      [0, 0], [3.4, 0], [3.6, 0.15], [3.8, 9], [3.5, 9], [3.3, 0.6], [0, 0.6],
    ].map(([r, y]) => new THREE.Vector2(r * 0.2, y * 0.2));
    return new THREE.LatheGeometry(pts, 48);
  }, []);
  // Half torus opening toward the body (-x), attached at the outer wall
  const handle = useMemo(() => new THREE.TorusGeometry(0.38, 0.08, 12, 32, Math.PI), []);

  useFrame((_, dt) => {
    if (!group.current) return;
    if (!still) {
      group.current.rotation.y += dt * 0.6;
      grow.current = Math.min(1, grow.current + dt * 0.8);
    }
    const e = 1 - Math.pow(1 - grow.current, 3);
    group.current.scale.set(1, Math.max(e, 0.001), 1);
  });

  return (
    <group ref={group} position={[0, -0.9, 0]}>
      <mesh geometry={body}>
        <meshStandardMaterial color="#f2f1ee" roughness={0.35} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={handle} position={[0.74, 0.95, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <meshStandardMaterial color="#c79a6d" roughness={0.4} />
      </mesh>
    </group>
  );
}

/** A prompt-generated coffee mug, spinning. */
export default function MugScene({ active, label }: { active: boolean; label: string }) {
  const still = !!useReducedMotion();
  return (
    <Stage active={active} label={label} camera={{ position: [0, 1.2, 5.2], fov: 35 }} shadows={false}>
      <Mug still={still} />
    </Stage>
  );
}
