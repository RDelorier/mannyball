import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nearestDefender, resolvePass } from '../src/pass.js';

test('nearestDefender returns the index of the closest defender', () => {
  assert.equal(nearestDefender(70, [58, 72, 85]), 1);
  assert.equal(nearestDefender(50, []), -1);
});

const base = { startYard: 50, targetYard: 75, goalLine: 100, direction: 1 };

test('green defense intercepts (turnover at the target)', () => {
  const r = resolvePass({ ...base, defenseGrade: 'green' });
  assert.deepEqual(r, { outcome: 'interception', endYard: 75, touchdown: false, turnover: true });
});

test('yellow defense knocks it down (incomplete, no gain)', () => {
  const r = resolvePass({ ...base, defenseGrade: 'yellow' });
  assert.deepEqual(r, { outcome: 'incomplete', endYard: 50, touchdown: false, turnover: false });
});

test('red defense allows a completion at the target', () => {
  const r = resolvePass({ ...base, defenseGrade: 'red' });
  assert.deepEqual(r, { outcome: 'completion', endYard: 75, touchdown: false, turnover: false });
});

test('completion in the end zone is a touchdown', () => {
  const r = resolvePass({ ...base, targetYard: 100, defenseGrade: 'red' });
  assert.equal(r.outcome, 'completion');
  assert.equal(r.touchdown, true);
});

test('a really bad throw (red) sails into the crowd', () => {
  const r = resolvePass({ startYard: 50, targetYard: 75, goalLine: 100, direction: 1, throwGrade: 'red', defenseGrade: 'green' });
  assert.deepEqual(r, { outcome: 'overthrown', endYard: 50, touchdown: false, turnover: false });
});

test('a good throw still resolves on the defense grade', () => {
  const r = resolvePass({ startYard: 50, targetYard: 75, goalLine: 100, direction: 1, throwGrade: 'green', defenseGrade: 'red' });
  assert.equal(r.outcome, 'completion');
});

test('a blown block (red rush) is a sack for a 7-yard loss', () => {
  const r = resolvePass({ startYard: 50, targetYard: 70, goalLine: 100, ownGoal: 0, direction: 1, rushGrade: 'red' });
  assert.deepEqual(r, { outcome: 'sack', endYard: 43, touchdown: false, turnover: false });
});

test('a sack in your own end zone is a safety', () => {
  const r = resolvePass({ startYard: 5, targetYard: 25, goalLine: 100, ownGoal: 0, direction: 1, rushGrade: 'red' });
  assert.equal(r.outcome, 'safety');
  assert.equal(r.safety, true);
  assert.equal(r.endYard, 0);
});

test('away-direction sack moves the ball the other way', () => {
  const r = resolvePass({ startYard: 50, targetYard: 30, goalLine: 0, ownGoal: 100, direction: -1, rushGrade: 'red' });
  assert.deepEqual(r, { outcome: 'sack', endYard: 57, touchdown: false, turnover: false });
});

test('beating the rush proceeds to the throw/defense', () => {
  const r = resolvePass({ startYard: 50, targetYard: 70, goalLine: 100, ownGoal: 0, direction: 1, rushGrade: 'green', throwGrade: 'green', defenseGrade: 'red' });
  assert.equal(r.outcome, 'completion');
});
