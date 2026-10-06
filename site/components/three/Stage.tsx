'use client';

import { ContactShadows, Environment, Lightformer } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  /** Render loop runs only while the scene is on screen */
  active: boolean;
  camera?: { position: [number, number, number]; fov?: number };
  /** Warm, low-sun lighting for the closing scene */
  dusk?: boolean;
  shadows?: boolean;
  label: string;
};

/** Shared canvas: soft studio light from procedural light panels (no HDR download), contact shadow. */
export default function Stage({ children, active, camera, dusk = false, shadows = true, label }: Props) {
  return (
    <Canvas
      dpr={[1, 2]}
      frameloop={active ? 'always' : 'never'}
      camera={{ position: camera?.position ?? [16, 14, 18], fov: camera?.fov ?? 35, near: 0.1, far: 200 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      aria-label={label}
      role="img"
    >
      <ambientLight intensity={dusk ? 0.35 : 0.55} color={dusk ? '#ffd9b0' : '#ffffff'} />
      <directionalLight position={dusk ? [-14, 6, 10] : [10, 18, 8]} intensity={dusk ? 1.6 : 1.3} color={dusk ? '#ffb37a' : '#ffffff'} />
      <Environment resolution={128} frames={1}>
        <Lightformer intensity={dusk ? 0.8 : 1.6} position={[0, 12, 0]} rotation-x={Math.PI / 2} scale={[30, 30, 1]} color={dusk ? '#ffcf9e' : '#ffffff'} />
        <Lightformer intensity={0.8} position={[-15, 4, 0]} rotation-y={Math.PI / 2} scale={[20, 6, 1]} color={dusk ? '#ff9d6b' : '#dff6ff'} />
        <Lightformer intensity={0.6} position={[15, 4, 0]} rotation-y={-Math.PI / 2} scale={[20, 6, 1]} color="#ffffff" />
      </Environment>
      {shadows && <ContactShadows position={[0, -0.13, 0]} opacity={0.45} scale={34} blur={2.6} far={10} resolution={512} />}
      {children}
    </Canvas>
  );
}
