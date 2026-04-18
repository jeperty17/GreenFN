/**
 * Shared display utilities for the contacts feature: avatar colour derivation
 * and pagination page-number generation.
 */

/** Derives a consistent hue-based background/text colour from a name initial. */
export function getAvatarStyle(
  name: string,
): { backgroundColor: string; color: string } {
  const hues = [142, 200, 260, 25, 340, 45, 170, 220, 300, 60];
  const h = hues[(name.charCodeAt(0) || 0) % hues.length];
  return {
    backgroundColor: `hsl(${h}, 40%, 82%)`,
    color: `hsl(${h}, 50%, 28%)`,
  };
}

/** Returns page numbers with "..." placeholders when the range is long. */
export function getPageNumbers(
  current: number,
  total: number,
): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "...", total];
  if (current >= total - 3)
    return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "...", current - 1, current, current + 1, "...", total];
}
