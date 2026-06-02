// Local high-score table. Pure: insertion + ranking only (no storage, no Date).
// Entries rank by score descending, ties broken by the XP multiplier (harder mode wins).
export function addEntry(list, entry, max = 10) {
  return [...list, entry]
    .sort((a, b) => (b.score - a.score) || ((b.mult || 1) - (a.mult || 1)))
    .slice(0, max);
}
