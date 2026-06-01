import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveFieldGoal, resolvePunt, resolvePat, resolveOnside } from '../src/kick.js';

test('short green field goal is good', () => {
  const r = resolveFieldGoal({ ballOn: 80, goalLine: 100, accuracyGrade: 'green' });
  assert.equal(r.good, true);
  assert.equal(r.distance, 37);
});

test('long green field goal beyond max range misses', () => {
  const r = resolveFieldGoal({ ballOn: 30, goalLine: 100, accuracyGrade: 'green' });
  assert.equal(r.good, false);
});

test('yellow field goal is good only at short range', () => {
  assert.equal(resolveFieldGoal({ ballOn: 80, goalLine: 100, accuracyGrade: 'yellow' }).good, true);
  assert.equal(resolveFieldGoal({ ballOn: 60, goalLine: 100, accuracyGrade: 'yellow' }).good, false);
});

test('red field goal always misses', () => {
  assert.equal(resolveFieldGoal({ ballOn: 95, goalLine: 100, accuracyGrade: 'red' }).good, false);
});

test('punt distance scales with power and clamps to the goal', () => {
  assert.equal(resolvePunt({ ballOn: 40, direction: 1, powerGrade: 'green' }).newBallOn, 85);
  assert.equal(resolvePunt({ ballOn: 40, direction: 1, powerGrade: 'yellow' }).newBallOn, 72);
  assert.equal(resolvePunt({ ballOn: 90, direction: 1, powerGrade: 'green' }).newBallOn, 100);
});

test('PAT is good unless missed', () => {
  assert.equal(resolvePat({ accuracyGrade: 'green' }).good, true);
  assert.equal(resolvePat({ accuracyGrade: 'yellow' }).good, true);
  assert.equal(resolvePat({ accuracyGrade: 'red' }).good, false);
});

test('onside is recovered by the kicker only on green', () => {
  assert.equal(resolveOnside({ recoveryGrade: 'green' }).recoveredByKicker, true);
  assert.equal(resolveOnside({ recoveryGrade: 'yellow' }).recoveredByKicker, false);
  assert.equal(resolveOnside({ recoveryGrade: 'red' }).recoveredByKicker, false);
});
