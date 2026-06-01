import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TEAMS, xpForGame, levelForXp, bpProgress, unlockLabel,
  isUnlocked, evaluateUnlocks, updateStats, newlyUnlocked, teamById,
  REWARD_TRACK, unlockedBalls, unlockedFields, currentTitle, newRewards,
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

test('retro team pack unlocks at higher battle-pass levels', () => {
  assert.equal(teamById('invaders').unlock.n, 10);
  assert.equal(teamById('ufos').unlock.n, 16);
  // locked until you reach the level, unlocked once you do
  assert.equal(isUnlocked(teamById('invaders'), { ...ZERO, xp: 250 * 8 }), false); // Lv 9
  assert.equal(isUnlocked(teamById('invaders'), { ...ZERO, xp: 250 * 9 }), true);  // Lv 10
  assert.equal(unlockLabel(teamById('ghosts')), 'Reach Lv 14');
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

test('REWARD_TRACK covers levels 1..29 in order', () => {
  assert.equal(REWARD_TRACK.length, 29);
  REWARD_TRACK.forEach((r, i) => assert.equal(r.level, i + 1));
});

test('the new tiers 21-25 unlock at their levels', () => {
  assert.equal(teamById('rex').unlock.n, 22);
  assert.ok(unlockedBalls({ xp: 250 * 20 }).map((b) => b.id).includes('eightball')); // Lv 21
  assert.ok(unlockedFields({ xp: 250 * 22 }).map((f) => f.id).includes('lava'));      // Lv 23
  assert.equal(currentTitle({ xp: 250 * 24 }), 'G.O.A.T.');                            // Lv 25
});

test('unlockedBalls/Fields always include the default and add by level', () => {
  assert.deepEqual(unlockedBalls({ xp: 0 }).map((b) => b.id), ['football']);
  // Lv 3 unlocks the soccer ball (250 * 2 = Lv 3)
  assert.ok(unlockedBalls({ xp: 250 * 2 }).map((b) => b.id).includes('soccer'));
  assert.deepEqual(unlockedFields({ xp: 0 }).map((f) => f.id), ['classic']);
  assert.ok(unlockedFields({ xp: 250 * 4 }).map((f) => f.id).includes('night')); // Lv 5
});

test('currentTitle climbs with level', () => {
  assert.equal(currentTitle({ xp: 0 }), 'Rookie');         // Lv 1
  assert.equal(currentTitle({ xp: 250 * 8 }), 'Pro');      // Lv 9
  assert.equal(currentTitle({ xp: 250 * 19 }), 'Legend');  // Lv 20
});

test('newRewards reports non-team rewards crossed', () => {
  // crossing Lv 2 -> Lv 3 grants the soccer ball (a non-team reward)
  const got = newRewards(250 * 1, 250 * 2).map((r) => r.value);
  assert.deepEqual(got, ['soccer']);
  // a team-only level grants no non-team reward
  assert.deepEqual(newRewards(250 * 0, 250 * 1).map((r) => r.value), []);
});

test('newlyUnlocked lists teams unlocked between snapshots', () => {
  const before = ZERO;
  const after = updateStats(before, { won: true, hard: false, score: 10 });
  assert.deepEqual(newlyUnlocked(before, after), ['rams']);
});
