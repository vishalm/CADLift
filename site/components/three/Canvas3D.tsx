'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import BlueprintArt from '@/components/ui/BlueprintArt';

let webglSupport: boolean | null = null;
function hasWebGL(): boolean {
  if (webglSupport !== null) return webglSupport;
  try {
    const c = document.createElement('canvas');
    webglSupport = !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}

type Props = {
  /** Render prop: `active` is true while the scene is on screen (render loop runs). */
  children: (active: boolean) => ReactNode;
  className?: string;
  fallback?: ReactNode;
  fallbackLabel: string;
};

/**
 * Lazy 3D slot: mounts the scene when it nears the viewport, pauses it off screen,
 * and shows a blueprint drawing when WebGL is unavailable.
 */
export default function Canvas3D({ children, className = '', fallback, fallbackLabel }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(hasWebGL());
    const el = ref.current;
    if (!el) return;
    const near = new IntersectionObserver(([e]) => e.isIntersecting && setMounted(true), { rootMargin: '400px' });
    const onScreen = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.01 });
    near.observe(el);
    onScreen.observe(el);
    return () => {
      near.disconnect();
      onScreen.disconnect();
    };
  }, []);

  const placeholder = fallback ?? <BlueprintArt className="h-full w-full" label={fallbackLabel} />;

  return (
    // Callers set positioning (absolute inset-0, flex-1, fixed height); "relative" is only the default.
    <div ref={ref} className={/\b(absolute|fixed|sticky)\b/.test(className) ? className : `relative ${className}`}>
      {supported && mounted ? children(visible) : placeholder}
    </div>
  );
}
