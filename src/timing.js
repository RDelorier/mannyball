// Grade a timing press by distance from the sweet-spot center.
// sweet = { center, green, yellow } where green/yellow are half-widths.
export function gradePress(markerPos, sweet) {
  const distance = Math.abs(markerPos - sweet.center);
  if (distance <= sweet.green) return 'green';
  if (distance <= sweet.yellow) return 'yellow';
  return 'red';
}
