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
  // Retro pack — arcade-themed teams unlocked at the higher battle-pass tiers.
  { id: 'invaders', emoji: '👾', name: 'Invaders', unlock: { type: 'level', n: 10 } },
  { id: 'joystick', emoji: '🕹️', name: 'Joysticks', unlock: { type: 'level', n: 12 } },
  { id: 'ghosts',   emoji: '👻', name: 'Ghosts',   unlock: { type: 'level', n: 14 } },
  { id: 'ufos',     emoji: '🛸', name: 'UFOs',     unlock: { type: 'level', n: 16 } },
  { id: 'rex',      emoji: '🦖', name: 'Rex',      unlock: { type: 'level', n: 22 } },
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

// ---- Battle-pass reward track (one reward per level, 1..20) ----
// kinds: 'team' (also in TEAMS), 'ball' (skin), 'field' (theme), 'title' (rank).

export const BALL_SKINS = {
  football: { emoji: '🏈', name: 'Football' },
  soccer:   { emoji: '⚽', name: 'Soccer' },
  softball: { emoji: '🥎', name: 'Softball' },
  fireball: { emoji: '🔥', name: 'Fireball' },
  rugby:    { emoji: '🏉', name: 'Rugby' },
  disco:    { emoji: '🪩', name: 'Disco' },
  eightball: { emoji: '🎱', name: '8-Ball' },
  diamond:  { emoji: '💎', name: 'Diamond' },
};

export const FIELD_THEMES = {
  classic: { name: 'Classic Green' },
  night:   { name: 'Night' },
  sunset:  { name: 'Sunset' },
  ice:     { name: 'Ice' },
  lava:    { name: 'Lava' },
};

export const REWARD_TRACK = [
  { level: 1,  kind: 'title', value: 'Rookie',   emoji: '🎽', label: 'Title: Rookie' },
  { level: 2,  kind: 'team',  value: 'sharks',   emoji: '🦈', label: 'Team: Sharks' },
  { level: 3,  kind: 'ball',  value: 'soccer',   emoji: '⚽', label: 'Ball: Soccer' },
  { level: 4,  kind: 'team',  value: 'robots',   emoji: '🤖', label: 'Team: Robots' },
  { level: 5,  kind: 'field', value: 'night',    emoji: '🌙', label: 'Field: Night' },
  { level: 6,  kind: 'team',  value: 'aliens',   emoji: '👽', label: 'Team: Aliens' },
  { level: 7,  kind: 'ball',  value: 'softball', emoji: '🥎', label: 'Ball: Softball' },
  { level: 8,  kind: 'team',  value: 'dragons',  emoji: '🐉', label: 'Team: Dragons' },
  { level: 9,  kind: 'title', value: 'Pro',      emoji: '🎽', label: 'Title: Pro' },
  { level: 10, kind: 'team',  value: 'invaders', emoji: '👾', label: 'Team: Invaders' },
  { level: 11, kind: 'ball',  value: 'fireball', emoji: '🔥', label: 'Ball: Fireball' },
  { level: 12, kind: 'team',  value: 'joystick', emoji: '🕹️', label: 'Team: Joysticks' },
  { level: 13, kind: 'field', value: 'sunset',   emoji: '🌅', label: 'Field: Sunset' },
  { level: 14, kind: 'team',  value: 'ghosts',   emoji: '👻', label: 'Team: Ghosts' },
  { level: 15, kind: 'ball',  value: 'rugby',    emoji: '🏉', label: 'Ball: Rugby' },
  { level: 16, kind: 'team',  value: 'ufos',     emoji: '🛸', label: 'Team: UFOs' },
  { level: 17, kind: 'title', value: 'All-Star', emoji: '🌟', label: 'Title: All-Star' },
  { level: 18, kind: 'field', value: 'ice',      emoji: '🧊', label: 'Field: Ice' },
  { level: 19, kind: 'ball',  value: 'disco',    emoji: '🪩', label: 'Ball: Disco' },
  { level: 20, kind: 'title', value: 'Legend',   emoji: '🏆', label: 'Title: Legend' },
  { level: 21, kind: 'ball',  value: 'eightball', emoji: '🎱', label: 'Ball: 8-Ball' },
  { level: 22, kind: 'team',  value: 'rex',      emoji: '🦖', label: 'Team: Rex' },
  { level: 23, kind: 'field', value: 'lava',     emoji: '🌋', label: 'Field: Lava' },
  { level: 24, kind: 'ball',  value: 'diamond',  emoji: '💎', label: 'Ball: Diamond' },
  { level: 25, kind: 'title', value: 'G.O.A.T.', emoji: '🐐', label: 'Title: G.O.A.T.' },
  { level: 26, kind: 'condition', value: 'rain', emoji: '🌧️', label: 'Weather: Rain' },
  { level: 27, kind: 'condition', value: 'wind', emoji: '💨', label: 'Weather: Wind' },
  { level: 28, kind: 'condition', value: 'snow', emoji: '❄️', label: 'Weather: Snow' },
  { level: 29, kind: 'condition', value: 'fog',  emoji: '🌫️', label: 'Weather: Fog' },
];

// Unlocked ball skins for the given progress (always includes the default).
export function unlockedBalls(progress) {
  const lvl = levelForXp(progress.xp || 0);
  const ids = ['football', ...REWARD_TRACK.filter((r) => r.kind === 'ball' && lvl >= r.level).map((r) => r.value)];
  return ids.map((id) => ({ id, ...BALL_SKINS[id] }));
}

// Unlocked field themes for the given progress (always includes the default).
export function unlockedFields(progress) {
  const lvl = levelForXp(progress.xp || 0);
  const ids = ['classic', ...REWARD_TRACK.filter((r) => r.kind === 'field' && lvl >= r.level).map((r) => r.value)];
  return ids.map((id) => ({ id, ...FIELD_THEMES[id] }));
}

// Highest rank title unlocked for the given progress (defaults to 'Rookie').
export function currentTitle(progress) {
  const lvl = levelForXp(progress.xp || 0);
  const titles = REWARD_TRACK.filter((r) => r.kind === 'title' && lvl >= r.level);
  return titles.length ? titles[titles.length - 1].value : 'Rookie';
}

// Non-team rewards (balls/fields/titles) unlocked crossing from one XP to another.
export function newRewards(beforeXp, afterXp) {
  const lb = levelForXp(beforeXp || 0), la = levelForXp(afterXp || 0);
  return REWARD_TRACK.filter((r) => r.kind !== 'team' && r.level > lb && r.level <= la);
}
