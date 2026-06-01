import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONDITIONS, conditionById, unlockedConditions } from '../src/conditions.js';

test('conditions unlock by battle-pass level (Clear always free)', () => {
  assert.deepEqual(unlockedConditions(0).map((c) => c.id), ['clear']);
  const at27 = unlockedConditions(27).map((c) => c.id);
  assert.ok(at27.includes('rain') && at27.includes('wind'));
  assert.ok(!at27.includes('fog'));
  assert.equal(unlockedConditions(29).length, CONDITIONS.length);
});

test('conditionById returns the match, or clear as default', () => {
  assert.equal(conditionById('rain').id, 'rain');
  assert.equal(conditionById('nope').id, 'clear');
});

test('clear has no penalties; weather makes things harder', () => {
  const clear = conditionById('clear');
  assert.equal(clear.fgMaxRange, 55);
  assert.equal(clear.barSpeedMult, 1.0);
  assert.equal(clear.overlay, null);
  // wind shortens field goals the most
  assert.ok(conditionById('wind').fgMaxRange < clear.fgMaxRange);
  // rain makes the timing bar faster
  assert.ok(conditionById('rain').barSpeedMult > 1);
});

test('every condition has the required fields', () => {
  for (const c of CONDITIONS) {
    assert.equal(typeof c.id, 'string');
    assert.equal(typeof c.fgMaxRange, 'number');
    assert.equal(typeof c.barSpeedMult, 'number');
    assert.ok('overlay' in c);
  }
});
