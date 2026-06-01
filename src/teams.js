// Team roster + progression (achievement unlocks + battle pass). Pure: no DOM, no storage.

export const TEAMS = [
  { id: 'eagles',   emoji: '🦅', name: 'Eagles',   unlock: { type: 'always' } },
  { id: 'bears',    emoji: '🐻', name: 'Bears',    unlock: { type: 'always' } },
  { id: 'lions',    emoji: '🦁', name: 'Lions',    unlock: { type: 'always' } },
  { id: 'dolphins', emoji: '🐬', name: 'Dolphins', unlock: { type: 'always' } },
  { id: 'rams',     emoji: '🐏', name: 'Rams',     unlock: { type: 'wins', n: 1 } },
  { id: 'ravens',   emoji: '🐦‍⬛', name: 'Ravens',   unlock: { type: 'wins', n: 3 } },
  { id: 'bolts',    emoji: '⚡', name: 'Bolts',    unlock: { type: 'hardWins', n: 1 } },
  { id: 'cowboys',  emoji: '🤠', name: 'Cowboys',  unlock: { type: 'highScore', n: 35 } },
  { id: 'sharks',   emoji: '🦈', name: 'Sharks',   unlock: { type: 'level', n: 2 } },
  { id: 'robots',   emoji: '🤖', name: 'Robots',   unlock: { type: 'level', n: 4 } },
  { id: 'aliens',   emoji: '👽', name: 'Aliens',   unlock: { type: 'level', n: 6 } },
  { id: 'dragons',  emoji: '🐉', name: 'Dragons',  unlock: { type: 'level', n: 8 } },
];

const XP_PER_LEVEL = 250;

// XP earned for a single finished game.
export function xpForGame({ won, score }) {
  return 50 + (won ? 100 : 0) + (score || 0);
}

// Battle-pass level for a total XP amount (starts at Lv 1).
export function levelForXp(xp) {
  return 1 + Math.floor(Math.max(0, xp) / XP_PER_LEVEL);
}

// Progress within the current level: { level, into, needed }.
export function bpProgress(xp) {
  const safe = Math.max(0, xp);
  return { level: levelForXp(safe), into: safe % XP_PER_LEVEL, needed: XP_PER_LEVEL };
}

// Human-readable unlock requirement for a team ('' if always unlocked).
export function unlockLabel(team) {
  const u = team.unlock;
  switch (u.type) {
    case 'always': return '';
    case 'wins': return `Win ${u.n} game${u.n > 1 ? 's' : ''}`;
    case 'hardWins': return 'Win a game on Hard';
    case 'highScore': return `Score ${u.n}+ in a win`;
    case 'level': return `Reach Lv ${u.n}`;
    default: return '';
  }
}

// Is a team unlocked given progress { wins, hardWins, highScore, xp }?
export function isUnlocked(team, progress) {
  const u = team.unlock;
  switch (u.type) {
    case 'always': return true;
    case 'wins': return (progress.wins || 0) >= u.n;
    case 'hardWins': return (progress.hardWins || 0) >= u.n;
    case 'highScore': return (progress.highScore || 0) >= u.n;
    case 'level': return levelForXp(progress.xp || 0) >= u.n;
    default: return false;
  }
}

// Ids of all unlocked teams for the given progress.
export function evaluateUnlocks(progress) {
  return TEAMS.filter((t) => isUnlocked(t, progress)).map((t) => t.id);
}

// Apply a finished game's outcome to progress. Pure.
// outcome = { won: boolean, hard: boolean, score: number }
export function updateStats(progress, outcome) {
  return {
    wins: (progress.wins || 0) + (outcome.won ? 1 : 0),
    hardWins: (progress.hardWins || 0) + (outcome.won && outcome.hard ? 1 : 0),
    highScore: Math.max(progress.highScore || 0, outcome.won ? outcome.score : 0),
    xp: (progress.xp || 0) + xpForGame({ won: outcome.won, score: outcome.won ? outcome.score : 0 }),
  };
}

// Team ids newly unlocked between two progress snapshots.
export function newlyUnlocked(before, after) {
  const had = new Set(evaluateUnlocks(before));
  return evaluateUnlocks(after).filter((id) => !had.has(id));
}

// Lookup a team by id (falls back to the first team).
export function teamById(id) {
  return TEAMS.find((t) => t.id === id) || TEAMS[0];
}
