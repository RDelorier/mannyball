// Grade a timing press by distance from the sweet-spot center.
// sweet = { center, green, yellow } where green/yellow are half-widths.
export function gradePress(markerPos, sweet) {
  const distance = Math.abs(markerPos - sweet.center);
  if (distance <= sweet.green) return 'green';
  if (distance <= sweet.yellow) return 'yellow';
  return 'red';
}

// Should a press actually count for the bar that's currently open?
// Timing bars run back-to-back (~260ms apart), so input from the PREVIOUS bar
// can leak into the next one and register an instant (red) press:
//   - touch devices fire a delayed "ghost" mouse event ~300ms after a tap
//   - a held key produces auto-repeat keydowns
// Reject auto-repeats, and anything inside a short arming window after the bar
// opens — no human can react that fast, so a press that early is always stale.
export function pressCounts() { return true; } // TEMP pre-fix emulation
