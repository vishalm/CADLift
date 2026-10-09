/**
 * Walk mode for the 3D world viewer: keeps the camera at eye height above the collider mesh and
 * stops it walking through walls. Pure math over an injected raycast so it can be unit tested.
 *
 * Units are metres (the world group is scaled by World Labs' metric_scale_factor), scene +y is up.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Distance from `origin` along unit `dir` to the first collider hit within `far`, or null. */
export type CastFn = (origin: Vec3, dir: Vec3, far: number) => number | null;

export const EYE_HEIGHT = 1.6;
export const BODY_RADIUS = 0.3;
/** Highest ledge (stair step, kerb) you can walk up onto. */
export const STEP_HEIGHT = 0.4;
/** How far below you the floor may be before the move is refused (walking off the world's edge). */
export const MAX_DROP = 50;

const DOWN: Vec3 = { x: 0, y: -1, z: 0 };

/**
 * Where the camera ends up after the controls tried to move it from `prev` to `next`.
 * ponytail: a blocked move stops dead (no sliding along walls); add wall sliding if it feels sticky.
 */
export function walkStep(prev: Vec3, next: Vec3, cast: CastFn): Vec3 {
  const floorY = prev.y - EYE_HEIGHT;
  let x = next.x;
  let z = next.z;

  const dx = next.x - prev.x;
  const dz = next.z - prev.z;
  const dist = Math.hypot(dx, dz);
  if (dist > 1e-6) {
    // Waist height clears steps but hits walls and furniture.
    const waist = { x: prev.x, y: floorY + EYE_HEIGHT / 2, z: prev.z };
    const hit = cast(waist, { x: dx / dist, y: 0, z: dz / dist }, dist + BODY_RADIUS);
    if (hit !== null) {
      x = prev.x;
      z = prev.z;
    }
  }

  const probe = { x, y: floorY + STEP_HEIGHT, z };
  const down = cast(probe, DOWN, STEP_HEIGHT + MAX_DROP);
  if (down === null) {
    // No floor under the new spot: refuse the horizontal move, keep the current height.
    return x === prev.x && z === prev.z ? { ...prev } : walkStep(prev, prev, cast);
  }
  return { x, y: probe.y - down + EYE_HEIGHT, z };
}
