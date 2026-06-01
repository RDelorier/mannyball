// Normal-down play call: 35% rush, 65% pass.
export function callPlay(roll) {
  return roll < 0.35 ? 'rush' : 'pass';
}

// 4th-down decision from field position.
export function fourthDownDecision({ ballOn, goalLine, fgMaxRange = 55 }) {
  const distToGoal = Math.abs(goalLine - ballOn);
  if (distToGoal + 17 <= fgMaxRange) return 'fieldgoal';
  if (distToGoal > 60) return 'punt';
  return 'goforit';
}

const DIFFICULTY = {
  easy: { green: 0.4, yellow: 0.7, onside: 0.1 },
  medium: { green: 0.6, yellow: 0.85, onside: 0.2 },
  hard: { green: 0.8, yellow: 0.95, onside: 0.35 },
};

// AI timing grade from difficulty thresholds.
export function aiTimingGrade(difficulty, roll) {
  const d = DIFFICULTY[difficulty] || DIFFICULTY.medium;
  if (roll < d.green) return 'green';
  if (roll < d.yellow) return 'yellow';
  return 'red';
}

// Attempt an onside kick only when trailing, with difficulty-tuned probability.
export function onsideDecision({ scoreDiff, difficulty, roll }) {
  if (scoreDiff >= 0) return false;
  const d = DIFFICULTY[difficulty] || DIFFICULTY.medium;
  return roll < d.onside;
}
