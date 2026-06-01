// Index of the defender closest to a receiver's yard line (-1 if none).
export function nearestDefender(receiverYard, defenders) {
  if (defenders.length === 0) return -1;
  let best = 0;
  let bestDist = Math.abs(defenders[0] - receiverYard);
  for (let i = 1; i < defenders.length; i++) {
    const d = Math.abs(defenders[i] - receiverYard);
    if (d < bestDist) { best = i; bestDist = d; }
  }
  return best;
}

// Resolve a pass given the nearest defender's timing grade.
//   green  -> interception (turnover at the target)
//   yellow -> knockdown (incomplete, ball returns to the line of scrimmage)
//   red    -> completion at the target (touchdown if it reaches the goal line)
export function resolvePass({ startYard, targetYard, goalLine, direction, defenseGrade }) {
  if (defenseGrade === 'green') {
    return { outcome: 'interception', endYard: targetYard, touchdown: false, turnover: true };
  }
  if (defenseGrade === 'yellow') {
    return { outcome: 'incomplete', endYard: startYard, touchdown: false, turnover: false };
  }
  const reachedGoal = direction > 0 ? targetYard >= goalLine : targetYard <= goalLine;
  return { outcome: 'completion', endYard: targetYard, touchdown: reachedGoal, turnover: false };
}
