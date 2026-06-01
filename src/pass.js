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

// Resolve a pass.
//   rushGrade 'red'   -> the pass rush gets home = SACK for a 7-yard loss; a sack
//                        at/behind the offense's own goal line is a SAFETY.
//   throwGrade 'red'  -> overthrown into the crowd (incomplete, no defense involved)
// Otherwise the nearest defender's grade decides:
//   green  -> interception (turnover at the target)
//   yellow -> knockdown (incomplete, ball returns to the line of scrimmage)
//   red    -> completion at the target (touchdown if it reaches the goal line)
export function resolvePass({
  startYard, targetYard, goalLine, ownGoal, direction,
  rushGrade, throwGrade, defenseGrade, dropChance = 0, dropRoll = 1,
}) {
  if (rushGrade === 'red') {
    const sackYard = startYard - direction * 7;
    const behindOwnGoal = direction > 0 ? sackYard <= ownGoal : sackYard >= ownGoal;
    if (behindOwnGoal) {
      return { outcome: 'safety', endYard: ownGoal, touchdown: false, turnover: false, safety: true };
    }
    return { outcome: 'sack', endYard: sackYard, touchdown: false, turnover: false };
  }
  if (throwGrade === 'red') {
    return { outcome: 'overthrown', endYard: startYard, touchdown: false, turnover: false };
  }
  // Weather can knock a catch loose (turning a catch/pick into an incompletion).
  const dropped = dropRoll < dropChance;
  if (defenseGrade === 'green') {
    if (dropped) return { outcome: 'incomplete', endYard: startYard, touchdown: false, turnover: false, dropped: true };
    return { outcome: 'interception', endYard: targetYard, touchdown: false, turnover: true };
  }
  if (defenseGrade === 'yellow') {
    return { outcome: 'incomplete', endYard: startYard, touchdown: false, turnover: false };
  }
  if (dropped) return { outcome: 'incomplete', endYard: startYard, touchdown: false, turnover: false, dropped: true };
  const reachedGoal = direction > 0 ? targetYard >= goalLine : targetYard <= goalLine;
  return { outcome: 'completion', endYard: targetYard, touchdown: reachedGoal, turnover: false };
}
