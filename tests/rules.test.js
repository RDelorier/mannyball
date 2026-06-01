import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  offenseGoals, newLineToGain, reachedLine, flipPossession,
  applyDownResult, addScore, checkWin,
} from '../src/rules.js';

test('offenseGoals maps possession to direction and goals', () => {
  assert.deepEqual(offenseGoals('home'), { goalLine: 100, ownGoal: 0, direction: 1 });
  assert.deepEqual(offenseGoals('away'), { goalLine: 0, ownGoal: 100, direction: -1 });
});

test('newLineToGain is 10 yards toward the goal, capped at the goal', () => {
  assert.equal(newLineToGain(50, 1, 100), 60);
  assert.equal(newLineToGain(95, 1, 100), 100);
  assert.equal(newLineToGain(50, -1, 0), 40);
});

test('reachedLine respects direction', () => {
  assert.equal(reachedLine(60, 60, 1), true);
  assert.equal(reachedLine(59, 60, 1), false);
  assert.equal(reachedLine(40, 40, -1), true);
});

function homeState(overrides = {}) {
  return {
    possession: 'home', direction: 1, ballOn: 50, down: 1, lineToGain: 60,
    goalLine: 100, ownGoal: 0, scoreHome: 0, scoreAway: 0, ...overrides,
  };
}

test('gaining the line-to-gain resets to first down', () => {
  const { state, events } = applyDownResult(homeState(), { endYard: 62, touchdown: false, turnover: false });
  assert.equal(state.down, 1);
  assert.equal(state.ballOn, 62);
  assert.equal(state.lineToGain, 72);
  assert.ok(events.includes('firstDown'));
});

test('short of the line advances the down', () => {
  const { state, events } = applyDownResult(homeState({ down: 2 }), { endYard: 55, touchdown: false, turnover: false });
  assert.equal(state.down, 3);
  assert.equal(events.includes('firstDown'), false);
});

test('failing on 4th down is a turnover on downs (possession flips)', () => {
  const { state, events } = applyDownResult(homeState({ down: 4 }), { endYard: 55, touchdown: false, turnover: false });
  assert.equal(state.possession, 'away');
  assert.equal(state.direction, -1);
  assert.equal(state.ballOn, 55);
  assert.equal(state.down, 1);
  assert.ok(events.includes('turnoverOnDowns'));
});

test('touchdown adds 6 and emits a touchdown event', () => {
  const { state, events } = applyDownResult(homeState(), { endYard: 100, touchdown: true, turnover: false });
  assert.equal(state.scoreHome, 6);
  assert.ok(events.includes('touchdown'));
});

test('a turnover (interception) flips possession at the spot', () => {
  const { state, events } = applyDownResult(homeState(), { endYard: 70, touchdown: false, turnover: true });
  assert.equal(state.possession, 'away');
  assert.equal(state.ballOn, 70);
  assert.ok(events.includes('turnover'));
});

test('addScore adds to the right team', () => {
  assert.equal(addScore(homeState(), 'home', 3).scoreHome, 3);
  assert.equal(addScore(homeState(), 'away', 3).scoreAway, 3);
});

test('checkWin returns the winner at/over the target', () => {
  assert.equal(checkWin(homeState({ scoreHome: 21 }), 21), 'home');
  assert.equal(checkWin(homeState({ scoreAway: 23 }), 21), 'away');
  assert.equal(checkWin(homeState({ scoreHome: 20 }), 21), null);
});
