// Field/weather conditions. Pure data + lookup, no DOM.
//   fgMaxRange   — max field-goal distance (yards) before it's a near-impossible kick
//   barSpeedMult — multiplier on the timing-bar sweep speed (higher = harder)
//   overlay      — CSS class for the animated weather layer (null = none)
export const CONDITIONS = [
  { id: 'clear', name: '☀️ Clear', fgMaxRange: 55, barSpeedMult: 1.0,  overlay: null },
  { id: 'rain',  name: '🌧️ Rain',  fgMaxRange: 50, barSpeedMult: 1.25, overlay: 'rain' },
  { id: 'snow',  name: '❄️ Snow',  fgMaxRange: 45, barSpeedMult: 1.1,  overlay: 'snow' },
  { id: 'wind',  name: '💨 Wind',  fgMaxRange: 38, barSpeedMult: 1.0,  overlay: 'wind' },
  { id: 'fog',   name: '🌫️ Fog',   fgMaxRange: 48, barSpeedMult: 1.15, overlay: 'fog' },
];

export function conditionById(id) {
  return CONDITIONS.find((c) => c.id === id) || CONDITIONS[0];
}
