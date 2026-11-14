/** Confetti positions for a scored reveal. Pure so a new celebration does not touch the board. */

export type PointChip = {
  left: string;
  top: string;
  delay: string;
  key: number;
};

export function pointChips(points: number, turnIndex: number): PointChip[] {
  const count = Math.min(12, points * 3);
  return Array.from({ length: count }, (_, index) => {
    const seed = points * 37 + turnIndex * 91 + index * 53;
    return {
      left: `${8 + (seed % 78)}%`,
      top: `${15 + ((seed * 7) % 45)}%`,
      delay: ((seed % 60) / 100).toFixed(2),
      key: index,
    };
  });
}
