// Resolve a rush play. The carrier meets each defender in order.
//   green  -> break the tackle, keep going
//   yellow -> break but stop 2 yards past this defender (momentum lost)
//   red    -> tackled at this defender's yard line
// Breaking all defenders reaches the goal line (touchdown).
export function resolveRush({ startYard, direction, defenders, grades, goalLine }) {
  for (let i = 0; i < defenders.length; i++) {
    const def = defenders[i];
    const grade = grades[i];
    if (grade === 'red') {
      return { endYard: def, touchdown: false, tackled: true };
    }
    if (grade === 'yellow') {
      const endYard = def + direction * 2;
      return { endYard, touchdown: false, tackled: true };
    }
    // green: continue to the next defender
  }
  return { endYard: goalLine, touchdown: true, tackled: false };
}
