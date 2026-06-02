import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addEntry } from '../src/leaderboard.js';

test('addEntry sorts by score descending', () => {
  let l = [];
  l = addEntry(l, { team: 'A', score: 14, mult: 1 });
  l = addEntry(l, { team: 'B', score: 28, mult: 1 });
  l = addEntry(l, { team: 'C', score: 21, mult: 1 });
  assert.deepEqual(l.map((e) => e.team), ['B', 'C', 'A']);
});

test('ties broken by multiplier (harder mode ranks higher)', () => {
  const l = addEntry([{ team: 'X', score: 21, mult: 1 }], { team: 'Y', score: 21, mult: 3 });
  assert.equal(l[0].team, 'Y');
});

test('caps at max entries, keeping the highest', () => {
  let l = [];
  for (let i = 0; i < 15; i++) l = addEntry(l, { team: 't' + i, score: i, mult: 1 }, 10);
  assert.equal(l.length, 10);
  assert.equal(l[0].score, 14);
  assert.equal(l[9].score, 5);
});
