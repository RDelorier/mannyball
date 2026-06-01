// Field goal: distance is yards-to-goal plus a fixed 17 (snap + end zone).
// Good on green within maxRange, or on yellow within 70% of maxRange.
export function resolveFieldGoal({ ballOn, goalLine, accuracyGrade, maxRange = 55 }) {
  const distance = Math.abs(goalLine - ballOn) + 17;
  let good = false;
  if (accuracyGrade === 'green') good = distance <= maxRange;
  else if (accuracyGrade === 'yellow') good = distance <= maxRange * 0.7;
  return { good, distance };
}

// Punt: power sets distance; clamp between the two goal lines.
export function resolvePunt({ ballOn, direction, powerGrade, leftGoal = 0, rightGoal = 100 }) {
  const dist = powerGrade === 'green' ? 45 : powerGrade === 'yellow' ? 32 : 18;
  const raw = ballOn + direction * dist;
  const newBallOn = Math.max(leftGoal, Math.min(rightGoal, raw));
  return { newBallOn };
}

// Extra point: short kick, good unless missed.
export function resolvePat({ accuracyGrade }) {
  return { good: accuracyGrade !== 'red' };
}

// Onside: kicking team recovers only on a perfectly timed (green) kick.
export function resolveOnside({ recoveryGrade }) {
  return { recoveredByKicker: recoveryGrade === 'green' };
}
