import { test } from 'node:test';
import assert from 'node:assert/strict';
import { callPlay, fourthDownDecision, aiTimingGrade, aiPassDefenseGrade, onsideDecision } from '../src/ai.js';

test('callPlay is 35% rush / 65% pass by roll threshold', () => {
  assert.equal(callPlay(0.0), 'rush');
  assert.equal(callPlay(0.34), 'rush');
  assert.equal(callPlay(0.35), 'pass');
  assert.equal(callPlay(0.9), 'pass');
});

test('fourthDownDecision kicks a field goal when in range', () => {
  assert.equal(fourthDownDecision({ ballOn: 80, goalLine: 100 }), 'fieldgoal');
});

test('fourthDownDecision punts when far from goal', () => {
  assert.equal(fourthDownDecision({ ballOn: 20, goalLine: 100 }), 'punt');
});

test('fourthDownDecision goes for it in mid-range', () => {
  assert.equal(fourthDownDecision({ ballOn: 55, goalLine: 100 }), 'goforit');
});

test('aiTimingGrade thresholds vary by difficulty', () => {
  assert.equal(aiTimingGrade('hard', 0.0), 'green');
  assert.equal(aiTimingGrade('easy', 0.5), 'yellow');
  assert.equal(aiTimingGrade('easy', 0.9), 'red');
});

test('aiPassDefenseGrade intercepts far less often than offense timing', () => {
  // medium: green only below 0.22 (vs 0.6 for offense timing)
  assert.equal(aiPassDefenseGrade('medium', 0.2), 'green');
  assert.equal(aiPassDefenseGrade('medium', 0.3), 'yellow');
  assert.equal(aiPassDefenseGrade('medium', 0.8), 'red');
  // a roll that would intercept on offense timing does NOT here
  assert.equal(aiTimingGrade('medium', 0.5), 'green');
  assert.equal(aiPassDefenseGrade('medium', 0.5), 'yellow');
  // hard picks more than easy, but both well under offense rates
  assert.equal(aiPassDefenseGrade('hard', 0.3), 'green');
  assert.equal(aiPassDefenseGrade('easy', 0.3), 'yellow');
});

test('onsideDecision only when trailing and within probability', () => {
  assert.equal(onsideDecision({ scoreDiff: 5, difficulty: 'hard', roll: 0.0 }), false);
  assert.equal(onsideDecision({ scoreDiff: -5, difficulty: 'hard', roll: 0.3 }), true);
  assert.equal(onsideDecision({ scoreDiff: -5, difficulty: 'easy', roll: 0.3 }), false);
});
