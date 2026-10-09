// Run with: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EYE_HEIGHT, STEP_HEIGHT, walkStep } from './walk.ts';
import type { CastFn, Vec3 } from './walk.ts';

/** A world made of a floor height function and vertical walls at given x positions. */
function world(floorAt: (x: number, z: number) => number | null, wallsX: number[] = []): CastFn {
  return (origin: Vec3, dir: Vec3, far: number) => {
    if (dir.y === -1) {
      const floor = floorAt(origin.x, origin.z);
      if (floor === null || floor > origin.y) return null;
      const d = origin.y - floor;
      return d <= far ? d : null;
    }
    let best: number | null = null;
    for (const wx of wallsX) {
      if (dir.x === 0) continue;
      const d = (wx - origin.x) / dir.x;
      if (d >= 0 && d <= far && (best === null || d < best)) best = d;
    }
    return best;
  };
}

const flat = world(() => 0);
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('stands at eye height on a flat floor', () => {
  const out = walkStep({ x: 0, y: 5, z: 0 }, { x: 1, y: 5, z: 0 }, world(() => 0));
  // probe starts STEP_HEIGHT above the current feet (5 - 1.6), so a floor far below is still found
  assert.equal(out.x, 1);
  close(out.y, EYE_HEIGHT);
});

test('walks freely and keeps height', () => {
  const out = walkStep({ x: 0, y: EYE_HEIGHT, z: 0 }, { x: 0.5, y: 3, z: -0.5 }, flat);
  assert.deepEqual([out.x, out.z], [0.5, -0.5]);
  close(out.y, EYE_HEIGHT); // vertical input (Q / E) is ignored while walking
});

test('stops at a wall, including body radius', () => {
  const walls = world(() => 0, [1]);
  const blocked = walkStep({ x: 0.6, y: EYE_HEIGHT, z: 0 }, { x: 0.8, y: EYE_HEIGHT, z: 0 }, walls);
  assert.equal(blocked.x, 0.6);
  const free = walkStep({ x: 0, y: EYE_HEIGHT, z: 0 }, { x: 0.2, y: EYE_HEIGHT, z: 0 }, walls);
  assert.equal(free.x, 0.2);
});

test('climbs a step but not a ledge higher than STEP_HEIGHT', () => {
  const stairs = world((x) => (x >= 1 ? STEP_HEIGHT - 0.05 : 0));
  const up = walkStep({ x: 0.9, y: EYE_HEIGHT, z: 0 }, { x: 1.1, y: EYE_HEIGHT, z: 0 }, stairs);
  close(up.y, STEP_HEIGHT - 0.05 + EYE_HEIGHT);

  // Anything taller than a step reaches waist height, so the wall cast stops you first.
  const block = world((x) => (x >= 1 ? 1.0 : 0), [1]);
  const stopped = walkStep({ x: 0.6, y: EYE_HEIGHT, z: 0 }, { x: 0.8, y: EYE_HEIGHT, z: 0 }, block);
  assert.equal(stopped.x, 0.6);
});

test('walks down steps and slopes', () => {
  const down = world((x) => (x >= 1 ? -0.3 : 0));
  const out = walkStep({ x: 0.9, y: EYE_HEIGHT, z: 0 }, { x: 1.1, y: EYE_HEIGHT, z: 0 }, down);
  close(out.y, -0.3 + EYE_HEIGHT);
});

test('refuses to walk off the edge of the world', () => {
  const island = world((x) => (x < 1 ? 0 : null));
  const out = walkStep({ x: 0.9, y: EYE_HEIGHT, z: 0 }, { x: 1.2, y: EYE_HEIGHT, z: 0 }, island);
  assert.equal(out.x, 0.9);
  close(out.y, EYE_HEIGHT);
});

test('with no floor anywhere, stays put', () => {
  const out = walkStep({ x: 0, y: 2, z: 0 }, { x: 1, y: 2, z: 0 }, world(() => null));
  assert.deepEqual(out, { x: 0, y: 2, z: 0 });
});
