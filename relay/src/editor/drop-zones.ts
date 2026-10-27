/** Side drops start outside the block, leaving its text area for ordinary moves. */
export function sideDropAt(x: number, left: number, right: number, previous?: "left" | "right", threshold=20) {
  const distance = Math.max(4,threshold-(previous?6:0));
  if (x <= left - distance) return "left" as const;
  if (x >= right + distance) return "right" as const;
  return null;
}
