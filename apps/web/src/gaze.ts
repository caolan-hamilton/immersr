export interface Point {
  x: number;
  y: number;
}

/** How far a pupil may move from its resting spot, in Blob's SVG units. The eye's white has room for more. */
export const MAX_PUPIL_OFFSET = 4;
/** Pointer distance in screen pixels at which the pupils reach their full offset. */
const FULL_OFFSET_DISTANCE = 160;

/**
 * Where Blob's pupils sit relative to their resting position when looking at the pointer.
 * `eyes` is the point on screen between Blob's eyes. A pointer at the eyes gives no offset,
 * a far pointer gives the full offset towards it, and reduced motion gives none.
 */
export function pupilOffset(pointer: Point | null, eyes: Point, reducedMotion: boolean): Point {
  if (!pointer || reducedMotion) return { x: 0, y: 0 };
  const dx = pointer.x - eyes.x;
  const dy = pointer.y - eyes.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return { x: 0, y: 0 };
  const reach = MAX_PUPIL_OFFSET * Math.min(1, distance / FULL_OFFSET_DISTANCE);
  return { x: (dx / distance) * reach, y: (dy / distance) * reach };
}
