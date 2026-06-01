// Field/weather conditions. Pure data + lookup, no DOM.
//   fgMaxRange   — max field-goal distance (yards) before it's a near-impossible kick
//   barSpeedMult — multiplier on the timing-bar sweep speed (higher = harder)
//   overlay      — CSS class for the animated weather layer (null = none)
// `unlock` is the battle-pass level required (0 = always available).
// `dropChance` is the probability a completion/interception is dropped (worse catching).
export const CONDITIONS = [
  { id: 'clear', name: '☀️ Clear', fgMaxRange: 55, barSpeedMult: 1.0,  overlay: null,   unlock: 0,  dropChance: 0.0 },
  { id: 'rain',  name: '🌧️ Rain',  fgMaxRange: 50, barSpeedMult: 1.25, overlay: 'rain', unlock: 26, dropChance: 0.3 },
  { id: 'wind',  name: '💨 Wind',  fgMaxRange: 38, barSpeedMult: 1.0,  overlay: 'wind', unlock: 27, dropChance: 0.18 },
  { id: 'snow',  name: '❄️ Snow',  fgMaxRange: 45, barSpeedMult: 1.1,  overlay: 'snow', unlock: 28, dropChance: 0.38 },
  { id: 'fog',   name: '🌫️ Fog',   fgMaxRange: 48, barSpeedMult: 1.15, overlay: 'fog',  unlock: 29, dropChance: 0.25 },
];

export function conditionById(id) {
  return CONDITIONS.find((c) => c.id === id) || CONDITIONS[0];
}

// Conditions available at a given battle-pass level (Clear is always available).
export function unlockedConditions(level) {
  return CONDITIONS.filter((c) => (c.unlock || 0) <= level);
}
