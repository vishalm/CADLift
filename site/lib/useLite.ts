'use client';

import { useEffect, useState } from 'react';

/** True on small screens: 3D scenes drop meshes and auto-rotation. */
export function useLite(breakpoint = 640): boolean {
  const [lite, setLite] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setLite(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [breakpoint]);
  return lite;
}
