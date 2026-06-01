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
