import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gradePress } from '../src/timing.js';

const sweet = { center: 50, green: 8, yellow: 18 }; // half-widths

test('dead-center press is green', () => {
  assert.equal(gradePress(50, sweet), 'green');
});

test('within green half-width is green', () => {
  assert.equal(gradePress(57, sweet), 'green');
  assert.equal(gradePress(43, sweet), 'green');
});

test('outside green but within yellow is yellow', () => {
  assert.equal(gradePress(64, sweet), 'yellow');
  assert.equal(gradePress(33, sweet), 'yellow');
});

test('outside yellow is red', () => {
  assert.equal(gradePress(80, sweet), 'red');
  assert.equal(gradePress(10, sweet), 'red');
});
