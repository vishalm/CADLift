import { PLAN, WALLS } from '@/lib/plan';

type Props = {
  className?: string;
  label: string;
  /** Lines draw themselves (CSS, disabled for reduced motion) */
  animate?: boolean;
  /** Keep redrawing in a loop instead of drawing once */
  loop?: boolean;
};

/** The demo floor plan as cyan blueprint lines: site motif and 3D fallback. */
export default function BlueprintArt({ className = '', label, animate = true, loop = false }: Props) {
  const pad = 1;
  return (
    <svg
      className={className}
      viewBox={`${-pad} ${-pad} ${PLAN.width + pad * 2} ${PLAN.depth + pad * 2}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={label}
    >
      <g fill="none" stroke="var(--color-cyan)" strokeWidth={0.12} strokeLinecap="round">
        {WALLS.map(([x1, z1, x2, z2], i) => (
          <line
            key={i}
            x1={x1}
            y1={z1}
            x2={x2}
            y2={z2}
            pathLength={1}
            className={animate ? (loop ? 'draw-loop' : 'draw-line') : undefined}
            style={animate ? { animationDelay: `${i * 70}ms` } : undefined}
          />
        ))}
      </g>
    </svg>
  );
}
