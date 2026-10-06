import { ImageResponse } from 'next/og';
import { PLAN, WALLS } from '@/lib/plan';
import { site } from '@/content/site';

export const alt = site.title;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Social card: blueprint plan with the headline. */
export default function OpengraphImage() {
  const s = 30;
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#0b0d10', color: '#f2f1ee', padding: 72, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 520 }}>
          <div style={{ fontSize: 30, color: '#3dd6f5', fontWeight: 600 }}>{site.name}</div>
          <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.02, letterSpacing: -2 }}>{site.hero.headline}</div>
          <div style={{ fontSize: 30, color: '#9aa3ad' }}>{site.hero.line}</div>
        </div>
        <svg width={PLAN.width * s} height={PLAN.depth * s} viewBox={`-0.5 -0.5 ${PLAN.width + 1} ${PLAN.depth + 1}`}>
          {WALLS.map(([x1, z1, x2, z2], i) => (
            <line key={i} x1={x1} y1={z1} x2={x2} y2={z2} stroke="#3dd6f5" strokeWidth={0.14} strokeLinecap="round" />
          ))}
        </svg>
      </div>
    ),
    size,
  );
}
