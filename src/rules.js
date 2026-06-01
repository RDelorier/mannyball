// Map a possessing team to its attack direction and goals.
export function offenseGoals(possession) {
  return possession === 'home'
    ? { goalLine: 100, ownGoal: 0, direction: 1 }
    : { goalLine: 0, ownGoal: 100, direction: -1 };
}

// Line to gain: 10 yards toward the goal, capped at the goal (first-and-goal).
export function newLineToGain(ballOn, direction, goalLine) {
  const raw = ballOn + direction * 10;
  return direction > 0 ? Math.min(raw, goalLine) : Math.max(raw, goalLine);
}

// Has the ball reached the line to gain, given attack direction?
export function reachedLine(endYard, lineToGain, direction) {
  return direction > 0 ? endYard >= lineToGain : endYard <= lineToGain;
}

// Flip possession; ball stays at endYard; fresh 1st & 10 for the new offense.
export function flipPossession(state, endYard) {
  const newPossession = state.possession === 'home' ? 'away' : 'home';
  const goals = offenseGoals(newPossession);
  return {
    ...state,
    possession: newPossession,
    direction: goals.direction,
    goalLine: goals.goalLine,
    ownGoal: goals.ownGoal,
    ballOn: endYard,
    down: 1,
    lineToGain: newLineToGain(endYard, goals.direction, goals.goalLine),
  };
}

// Apply a rush/pass down result. Returns { state, events }.
export function applyDownResult(state, result) {
  const events = [];

  if (result.turnover) {
    return { state: flipPossession(state, result.endYard), events: ['turnover'] };
  }

  if (result.touchdown) {
    const scored = addScore(state, state.possession, 6);
    events.push('touchdown');
    return { state: { ...scored, ballOn: result.endYard }, events };
  }

  let next = { ...state, ballOn: result.endYard };

  if (reachedLine(result.endYard, state.lineToGain, state.direction)) {
    next.down = 1;
    next.lineToGain = newLineToGain(result.endYard, state.direction, state.goalLine);
    events.push('firstDown');
    return { state: next, events };
  }

  next.down = state.down + 1;
  if (next.down > 4) {
    events.push('turnoverOnDowns');
    return { state: flipPossession(state, result.endYard), events };
  }
  return { state: next, events };
}

// Add points to a team.
export function addScore(state, team, points) {
  return team === 'home'
    ? { ...state, scoreHome: state.scoreHome + points }
    : { ...state, scoreAway: state.scoreAway + points };
}

// Winner once a team reaches the target, else null.
export function checkWin(state, target) {
  if (state.scoreHome >= target) return 'home';
  if (state.scoreAway >= target) return 'away';
  return null;
}
