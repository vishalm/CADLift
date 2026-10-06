/**
 * Invented demo office floor plan (metres). Not based on any real drawing.
 * x runs 0-20, z runs 0-12. Scenes centre it at the origin.
 */

export type Segment = [x1: number, z1: number, x2: number, z2: number];
export type Box = { x: number; z: number; w: number; d: number; h: number };

export const PLAN = { width: 20, depth: 12 } as const;
export const WALL_HEIGHT = 3;
export const WALL_THICKNESS = 0.15;

export const WALLS: Segment[] = [
  // Outer shell, entrance gap at the reception
  [0, 0, 2, 0], [3.6, 0, 20, 0], [20, 0, 20, 12], [20, 12, 0, 12], [0, 12, 0, 0],
  // Reception
  [0, 4, 3.2, 4],
  // Meeting room A and B
  [0, 8, 4, 8], [5, 8, 6, 8], [7, 8, 10, 8], [5, 8, 5, 12], [10, 8, 10, 12],
  // Director cabin
  [15, 8, 17, 8], [18, 8, 20, 8], [15, 8, 15, 12],
  // Store room
  [15, 0, 15, 3], [15, 3, 16.5, 3], [17.5, 3, 20, 3],
];

const desks: Box[] = [];
const chairs: Box[] = [];
for (const x of [6.5, 8.5, 10.5, 12.5]) {
  for (const z of [2, 3.2, 5, 6.2]) {
    desks.push({ x, z, w: 1.6, d: 0.8, h: 0.75 });
    chairs.push({ x, z: z + (z === 2 || z === 5 ? -0.75 : 0.75), w: 0.5, d: 0.5, h: 0.5 });
  }
}

export const FURNITURE: Box[] = [
  ...desks,
  ...chairs,
  { x: 2, z: 2, w: 2.4, d: 0.8, h: 1.05 }, // reception desk
  { x: 2.5, z: 10, w: 3, d: 1.2, h: 0.75 }, // meeting table A
  { x: 7.5, z: 10, w: 2.6, d: 1.1, h: 0.75 }, // meeting table B
  { x: 12, z: 10.8, w: 2.4, d: 0.8, h: 0.45 }, // lounge sofa
  { x: 12, z: 9.6, w: 1, d: 0.6, h: 0.4 }, // coffee table
  { x: 17.5, z: 10.5, w: 2, d: 0.9, h: 0.75 }, // director desk
  { x: 19.2, z: 9.2, w: 0.8, d: 1.6, h: 0.45 }, // director sofa
  { x: 17.5, z: 0.8, w: 4, d: 0.5, h: 1.8 }, // store shelving
];

export const PLANTS: Array<{ x: number; z: number; s: number }> = [
  { x: 0.6, z: 0.6, s: 1 }, { x: 4.4, z: 3.4, s: 0.9 }, { x: 14.4, z: 1, s: 1.1 },
  { x: 14.4, z: 6.8, s: 1 }, { x: 9.5, z: 7.3, s: 0.8 }, { x: 0.6, z: 11.4, s: 1 },
  { x: 19.4, z: 11.4, s: 1 }, { x: 13.8, z: 11.4, s: 0.9 }, { x: 5.6, z: 4.6, s: 0.8 },
];

export const COLUMNS: Box[] = [
  { x: 5, z: 6, w: 0.45, d: 0.45, h: WALL_HEIGHT },
  { x: 10, z: 6, w: 0.45, d: 0.45, h: WALL_HEIGHT },
  { x: 15, z: 6, w: 0.45, d: 0.45, h: WALL_HEIGHT },
];

export type LayerColors = { floor: string; walls: string; furniture: string; plants: string; columns: string };

/** Drawing-style colours: what a fresh conversion looks like. */
export const DRAWING_COLORS: LayerColors = {
  floor: '#262b33',
  walls: '#9aa4b2',
  furniture: '#7c8aa0',
  plants: '#4f9d5b',
  columns: '#c9ced6',
};

/** The restyled look used after the chat demo. */
export const STYLED_COLORS: LayerColors = {
  floor: '#4a4a4a',
  walls: '#efece6',
  furniture: '#c79a6d',
  plants: '#5fae4f',
  columns: '#d9d6cf',
};

export const BLUEPRINT = '#3dd6f5';
