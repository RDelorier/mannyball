import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TEAMS, xpForGame, levelForXp, bpProgress, unlockLabel,
  isUnlocked, evaluateUnlocks, updateStats, newlyUnlocked, teamById,
} from '../src/teams.js';

const ZERO = { wins: 0, hardWins: 0, highScore: 0, xp: 0 };

test('xpForGame: base + win bonus + score', () => {
  assert.equal(xpForGame({ won: false, score: 0 }), 50);
  assert.equal(xpForGame({ won: true, score: 21 }), 171);
});

test('levelForXp: 250 XP per level, starts at Lv 1', () => {
  assert.equal(levelForXp(0), 1);
  assert.equal(levelForXp(249), 1);
  assert.equal(levelForXp(250), 2);
  assert.equal(levelForXp(500), 3);
});

test('bpProgress reports level, into, needed', () => {
  assert.deepEqual(bpProgress(300), { level: 2, into: 50, needed: 250 });
});

test('four base teams are always unlocked', () => {
  const base = TEAMS.filter((t) => t.unlock.type === 'always');
  assert.equal(base.length, 4);
  for (const t of base) assert.equal(isUnlocked(t, ZERO), true);
});

test('isUnlocked: wins / hardWins / highScore / level conditions', () => {
  assert.equal(isUnlocked(teamById('rams'), ZERO), false);
  assert.equal(isUnlocked(teamById('rams'), { ...ZERO, wins: 1 }), true);
  assert.equal(isUnlocked(teamById('ravens'), { ...ZERO, wins: 3 }), true);
  assert.equal(isUnlocked(teamById('bolts'), { ...ZERO, hardWins: 1 }), true);
  assert.equal(isUnlocked(teamById('cowboys'), { ...ZERO, highScore: 35 }), true);
  assert.equal(isUnlocked(teamById('sharks'), { ...ZERO, xp: 250 }), true);
  assert.equal(isUnlocked(teamById('dragons'), { ...ZERO, xp: 250 }), false);
});

test('unlockLabel describes the requirement', () => {
  assert.equal(unlockLabel(teamById('eagles')), '');
  assert.equal(unlockLabel(teamById('rams')), 'Win 1 game');
  assert.equal(unlockLabel(teamById('ravens')), 'Win 3 games');
  assert.equal(unlockLabel(teamById('bolts')), 'Win a game on Hard');
  assert.equal(unlockLabel(teamById('cowboys')), 'Score 35+ in a win');
  assert.equal(unlockLabel(teamById('dragons')), 'Reach Lv 8');
});

test('evaluateUnlocks returns all satisfied team ids', () => {
  const ids = evaluateUnlocks({ wins: 1, hardWins: 0, highScore: 0, xp: 0 });
  assert.ok(ids.includes('eagles'));
  assert.ok(ids.includes('rams'));
  assert.ok(!ids.includes('ravens'));
});

test('updateStats accumulates a won game', () => {
  const after = updateStats(ZERO, { won: true, hard: true, score: 35 });
  assert.equal(after.wins, 1);
  assert.equal(after.hardWins, 1);
  assert.equal(after.highScore, 35);
  assert.equal(after.xp, 185);
});

test('updateStats: a loss adds participation XP only', () => {
  const after = updateStats(ZERO, { won: false, hard: false, score: 14 });
  assert.equal(after.wins, 0);
  assert.equal(after.highScore, 0);
  assert.equal(after.xp, 50);
});

test('newlyUnlocked lists teams unlocked between snapshots', () => {
  const before = ZERO;
  const after = updateStats(before, { won: true, hard: false, score: 10 });
  assert.deepEqual(newlyUnlocked(before, after), ['rams']);
});
