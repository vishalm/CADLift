import * as THREE from 'three';

/**
 * Procedural surface textures drawn on a canvas at runtime (nothing downloaded). They are light
 * greyscale so a material's colour still sets the hue: the layer colour animations keep working,
 * the texture only adds the variation that makes a surface read as real.
 */

/** Small deterministic PRNG so every visit draws the same surfaces. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d') as CanvasRenderingContext2D];
}

function toTexture(c: HTMLCanvasElement, repeat: [number, number], srgb: boolean): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Soft blotches: grey value between lo and hi (0-255). */
function mottle(ctx: CanvasRenderingContext2D, size: number, rand: () => number, count: number, lo: number, hi: number, radius: number) {
  for (let i = 0; i < count; i++) {
    const v = Math.round(lo + rand() * (hi - lo));
    const r = radius * (0.4 + rand());
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, `rgba(${v},${v},${v},0.35)`);
    g.addColorStop(1, `rgba(${v},${v},${v},0)`);
    ctx.fillStyle = g;
    const x = rand() * size;
    const y = rand() * size;
    // Draw wrapped copies so the tile repeats without seams.
    for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) {
      ctx.save();
      ctx.translate(x + dx, y + dy);
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.restore();
    }
  }
}

/** Polished concrete: mottled cement with 2 m pour joints. One tile = 2 x 2 m. */
export function concreteFloor(planWidth: number, planDepth: number) {
  const size = 1024;
  const [c, ctx] = canvas(size);
  const rand = rng(7);
  ctx.fillStyle = 'rgb(226,226,226)';
  ctx.fillRect(0, 0, size, size);
  mottle(ctx, size, rand, 260, 190, 255, 140);
  // Fine aggregate speckle
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rand() - 0.5) * 14;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  // Saw-cut joints on the tile edges
  ctx.strokeStyle = 'rgba(70,70,70,0.55)';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, size - 3, size - 3);
  const map = toTexture(c, [planWidth / 2, planDepth / 2], true);
  const bump = toTexture(c, [planWidth / 2, planDepth / 2], false);
  return { map, bump };
}

/** Wood grain running along the texture's x axis (stretches naturally along furniture). */
export function woodGrain() {
  const size = 512;
  const [c, ctx] = canvas(size);
  const rand = rng(11);
  ctx.fillStyle = 'rgb(236,236,236)';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 160; i++) {
    const y0 = rand() * size;
    const v = Math.round(150 + rand() * 80);
    ctx.strokeStyle = `rgba(${v},${v},${v},${0.25 + rand() * 0.35})`;
    ctx.lineWidth = 0.6 + rand() * 2.2;
    ctx.beginPath();
    const amp = 2 + rand() * 6;
    const freq = (Math.PI * 2 * (1 + Math.floor(rand() * 3))) / size;
    const phase = rand() * Math.PI * 2;
    for (let x = 0; x <= size; x += 8) {
      const y = y0 + Math.sin(x * freq + phase) * amp;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return toTexture(c, [1, 1], true);
}

/** Barely-there plaster for walls: keeps large white planes from looking like flat CG. */
export function plaster() {
  const size = 256;
  const [c, ctx] = canvas(size);
  const rand = rng(23);
  ctx.fillStyle = 'rgb(244,244,244)';
  ctx.fillRect(0, 0, size, size);
  mottle(ctx, size, rand, 90, 215, 255, 40);
  return toTexture(c, [1, 1], true);
}
