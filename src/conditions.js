// Field/weather conditions. Pure data + lookup, no DOM.
//   fgMaxRange   — max field-goal distance (yards) before it's a near-impossible kick
//   barSpeedMult — multiplier on the timing-bar sweep speed (higher = harder)
//   overlay      — CSS class for the animated weather layer (null = none)
// `dropChance` is the probability a completion/interception is dropped (worse catching).
// Conditions are standard — all available from the start.
export const CONDITIONS = [
  { id: 'clear', name: '☀️ Clear', fgMaxRange: 55, barSpeedMult: 1.0,  overlay: null,   dropChance: 0.0 },
  { id: 'rain',  name: '🌧️ Rain',  fgMaxRange: 50, barSpeedMult: 1.25, overlay: 'rain', dropChance: 0.3 },
  { id: 'wind',  name: '💨 Wind',  fgMaxRange: 38, barSpeedMult: 1.0,  overlay: 'wind', dropChance: 0.18 },
  { id: 'snow',  name: '❄️ Snow',  fgMaxRange: 45, barSpeedMult: 1.1,  overlay: 'snow', dropChance: 0.38 },
  { id: 'fog',   name: '🌫️ Fog',   fgMaxRange: 48, barSpeedMult: 1.15, overlay: 'fog',  dropChance: 0.25 },
  { id: 'storm', name: '🌩️ Thunderstorm', fgMaxRange: 42, barSpeedMult: 1.35, overlay: 'storm',   dropChance: 0.45 },
  { id: 'heat',  name: '🥵 Heat',  fgMaxRange: 53, barSpeedMult: 1.1,  overlay: 'heat',    dropChance: 0.05 },
  { id: 'hail',  name: '🧊 Hail',  fgMaxRange: 40, barSpeedMult: 1.2,  overlay: 'hail',    dropChance: 0.4 },
  { id: 'tornado', name: '🌪️ Tornado', fgMaxRange: 30, barSpeedMult: 1.45, overlay: 'tornado', dropChance: 0.5 },
];

export function conditionById(id) {
  return CONDITIONS.find((c) => c.id === id) || CONDITIONS[0];
}
