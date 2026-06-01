import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRush } from '../src/rush.js';

const base = { startYard: 50, direction: 1, defenders: [58, 70, 85], goalLine: 100 };

test('red on first defender is tackled at that defender', () => {
  const r = resolveRush({ ...base, grades: ['red', 'green', 'green'] });
  assert.deepEqual(r, { endYard: 58, touchdown: false, tackled: true });
});

test('green through all defenders scores a touchdown', () => {
  const r = resolveRush({ ...base, grades: ['green', 'green', 'green'] });
  assert.equal(r.touchdown, true);
  assert.equal(r.endYard, 100);
  assert.equal(r.tackled, false);
});

test('yellow breaks but stops 2 yards past that defender', () => {
  const r = resolveRush({ ...base, grades: ['green', 'yellow', 'green'] });
  assert.deepEqual(r, { endYard: 72, touchdown: false, tackled: true });
});

test('away direction tackles correctly (decreasing yards)', () => {
  const r = resolveRush({
    startYard: 50, direction: -1, defenders: [42, 30], goalLine: 0,
    grades: ['green', 'red'],
  });
  assert.deepEqual(r, { endYard: 30, touchdown: false, tackled: true });
});
