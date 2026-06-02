import { offenseGoals, newLineToGain, checkWin } from './rules.js';
import { unlockAudio, playCrowdRoar } from './sound.js';
import { gradePress, pressCounts } from './timing.js';
import { emojiSprite } from './sprites.js';
import { aiTimingGrade, aiPassDefenseGrade, callPlay, fourthDownDecision, onsideDecision } from './ai.js';
import { resolveRush } from './rush.js';
import { nearestDefender, resolvePass } from './pass.js';
import { applyDownResult, addScore, flipPossession } from './rules.js';
import { resolveFieldGoal, resolvePunt, resolvePat, resolveOnside } from './kick.js';
import {
  TEAMS, teamById, isUnlocked, unlockLabel, bpProgress,
  updateStats, newlyUnlocked, levelForXp, xpForGame,
  REWARD_TRACK, BALL_SKINS, unlockedBalls, unlockedFields, currentTitle, newRewards, xpMultiplier,
} from './teams.js';
import { setCoachEnabled, initVoice, coachSay, coachLine } from './voice.js';
import { CONDITIONS, conditionById } from './conditions.js';
import { addEntry } from './leaderboard.js';

// Tap/click events used to register a timing press (covers iPad Safari quirks).
const TAP_EVENTS = ['pointerdown', 'touchstart', 'mousedown'];

// Each timing bar gets a fresh randomized sweet spot (see randomSweet).

// Timing-bar sweep speed (percent/frame) by difficulty — EXTREME is frantic.
const BAR_SPEED = { easy: 1.2, medium: 1.4, hard: 1.8, extreme: 2.7 };

// ---- DOM ----
const el = (id) => document.getElementById(id);
const startScreen = el('start-screen');
const gameScreen = el('game-screen');
const winScreen = el('win-screen');
const bpScreen = el('bp-screen');
const lbScreen = el('leaderboard-screen');

// ---- Persistent progress (localStorage) ----
const SAVE_KEY = '1dfb-progress';
function loadProgress() {
  try {
    return { wins: 0, hardWins: 0, highScore: 0, xp: 0, ...JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') };
  } catch {
    return { wins: 0, hardWins: 0, highScore: 0, xp: 0 };
  }
}
function saveProgress(p) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(p)); } catch { /* storage unavailable */ }
}
let progress = loadProgress();

// ---- Leaderboard (localStorage) ----
const LB_KEY = '1dfb-leaderboard';
function loadLeaderboard() {
  try { return JSON.parse(localStorage.getItem(LB_KEY) || '[]'); } catch { return []; }
}
function saveLeaderboard(l) {
  try { localStorage.setItem(LB_KEY, JSON.stringify(l)); } catch { /* storage unavailable */ }
}
let leaderboard = loadLeaderboard();

// ---- Config + state ----
let config = {
  mode: 'ai', difficulty: 'medium', target: 21,
  homeTeam: 'eagles', awayTeam: 'bears', humanSide: 'home', voice: true,
  ball: 'football', field: 'classic', condition: 'clear',
};
let state = null;

// The active field condition (weather) object.
function cond() { return conditionById(config.condition); }

// ---- Coach phrase pools ----
const COACH = {
  throw: ['Hit the green!', 'Lead your receiver!', 'Nice and easy now!'],
  catch: ['Pick it off!', 'Break it up!', 'Eyes on the ball!'],
  rush: ['Find the hole!', 'Hit it hard!', 'Break that tackle!'],
  kick: ['Line it up!', 'Drill it through!', 'Stay smooth!'],
  td: ['Touchdown! Way to go!', 'Six points, baby!', 'In the end zone!'],
  firstDown: ["First down, keep movin'!", 'Move those chains!', 'Fresh set of downs!'],
  intercepted: ['Picked off!', 'Turnover! Defense wins it!', 'He took it away!'],
  turnover: ['Turnover on downs!', 'Defense holds!'],
  overthrow: ['Ohh, into the crowd!', 'Way over his head!', 'Nobody was there!'],
  drop: ['Dropped it!', 'Right through his hands!', "Couldn't hang on!"],
  evade: ['Beat the rush!', 'Step up in the pocket!', 'Get it off!'],
  sack: ['Sacked!', 'They got to him!', 'Down he goes for a loss!'],
  safety: ['Safety! Two points!', 'Tackled in the end zone!', 'That\'s a safety!'],
  fgGood: ["It's good!", 'Right through the uprights!'],
  fgNoGood: ['No good!', 'He missed it!'],
  punt: ['Boot it away!', 'Flip the field!'],
  win: ["That's the ballgame! Well done!", 'Great win out there!'],
  lose: ["Tough one. We'll get 'em next time.", 'Keep your head up.'],
};

// ---- Helpers ----
function yardToPercent(yard) {
  return Math.max(0, Math.min(100, yard)) + '%';
}
function ordinal(n) {
  return ['1st', '2nd', '3rd', '4th'][n - 1] || `${n}th`;
}
function distanceToGain() {
  return Math.abs(state.lineToGain - state.ballOn);
}
function showScreen(screen) {
  for (const s of [startScreen, gameScreen, winScreen, bpScreen, lbScreen]) s.classList.add('hidden');
  screen.classList.remove('hidden');
}
function setMessage(text) {
  el('message').textContent = text;
}
function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

// The team object controlling a given side.
function teamFor(side) {
  return teamById(side === 'home' ? config.homeTeam : config.awayTeam);
}

// Apply the chosen battle-pass cosmetics: ball skin glyph + field theme.
function applyCosmetics() {
  el('ball').textContent = (BALL_SKINS[config.ball] || BALL_SKINS.football).emoji;
  el('field').className = config.field === 'classic' ? '' : `theme-${config.field}`;
  el('weather').className = cond().overlay || '';
}

function freshState() {
  const goals = offenseGoals('home');
  return {
    possession: 'home', direction: goals.direction, goalLine: goals.goalLine,
    ownGoal: goals.ownGoal, ballOn: 25, down: 1,
    lineToGain: newLineToGain(25, goals.direction, goals.goalLine),
    scoreHome: 0, scoreAway: 0,
  };
}

// ---- Start screen ----
function populateTeamSelect(select, selectedId) {
  select.innerHTML = '';
  for (const t of TEAMS) {
    const unlocked = isUnlocked(t, progress);
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = unlocked ? `${t.emoji} ${t.name}` : `🔒 ${t.name} — ${unlockLabel(t)}`;
    opt.disabled = !unlocked;
    if (t.id === selectedId && unlocked) opt.selected = true;
    select.appendChild(opt);
  }
}

function renderBadge() {
  const { level, into, needed } = bpProgress(progress.xp);
  el('bp-level').textContent = `⭐ Lv ${level}`;
  el('bp-fill').style.width = (100 * into / needed) + '%';
}

// Build a <select> from a list of { id, emoji, name } options.
function populateOptionSelect(select, options, selectedId) {
  select.innerHTML = '';
  for (const o of options) {
    const opt = document.createElement('option');
    opt.value = o.id;
    opt.textContent = o.emoji ? `${o.emoji} ${o.name}` : o.name;
    if (o.id === selectedId) opt.selected = true;
    select.appendChild(opt);
  }
}

function showStart() {
  renderBadge();
  el('player-title').textContent = `RANK: ${currentTitle(progress).toUpperCase()}`;
  populateTeamSelect(el('home-team'), config.homeTeam);
  populateTeamSelect(el('away-team'), config.awayTeam);
  populateOptionSelect(el('ball-select'), unlockedBalls(progress), config.ball);
  populateOptionSelect(el('field-select'), unlockedFields(progress), config.field);
  populateOptionSelect(el('condition-select'), CONDITIONS, config.condition);
  showScreen(startScreen);
}

// Battle-pass screen: level/XP summary + the full 20-tier reward track.
function showBattlePass() {
  const { level, into, needed } = bpProgress(progress.xp);
  el('bp-summary').textContent = `⭐ Lv ${level} — ${into} / ${needed} XP`;
  el('bp-screen-fill').style.width = (100 * into / needed) + '%';

  const list = el('bp-tiers');
  list.innerHTML = '';
  for (const r of REWARD_TRACK) {
    const unlocked = level >= r.level;
    const li = document.createElement('li');
    li.className = unlocked ? 'unlocked' : 'locked';
    if (r.level === level) li.classList.add('current');

    const lvl = document.createElement('span');
    lvl.className = 'tier-lvl';
    lvl.textContent = `LV ${r.level}`;
    const reward = document.createElement('span');
    reward.className = 'tier-reward';
    reward.textContent = `${r.emoji} ${r.label}`;
    const status = document.createElement('span');
    status.className = 'tier-status';
    status.textContent = unlocked ? '✅' : '🔒';

    li.append(lvl, reward, status);
    list.appendChild(li);
  }

  showScreen(bpScreen);
}

// Leaderboard screen: top games saved on this device.
function showLeaderboard() {
  const list = el('lb-rows');
  list.innerHTML = '';
  if (!leaderboard.length) {
    const li = document.createElement('li');
    li.className = 'lb-empty';
    li.textContent = 'No games yet — go win one!';
    list.appendChild(li);
  } else {
    leaderboard.forEach((e, i) => {
      const li = document.createElement('li');
      const rank = document.createElement('span');
      rank.className = 'lb-rank';
      rank.textContent = `#${i + 1}`;
      const who = document.createElement('span');
      who.className = 'lb-who';
      who.textContent = `${e.emoji || ''} ${e.team}`;
      const score = document.createElement('span');
      score.className = 'lb-score';
      score.textContent = `${e.score} pts`;
      const mode = document.createElement('span');
      mode.className = 'lb-mode';
      mode.textContent = e.mode === '2p' ? '2P' : (e.difficulty || '').toUpperCase();
      li.append(rank, who, score, mode);
      list.appendChild(li);
    });
  }
  showScreen(lbScreen);
}

// ---- Render ----
function render() {
  const home = teamFor('home'), away = teamFor('away');
  el('label-home').textContent = `${home.emoji} ${home.name.toUpperCase()}`;
  el('label-away').textContent = `${away.emoji} ${away.name.toUpperCase()}`;
  el('logo-home').textContent = home.emoji;
  el('logo-away').textContent = away.emoji;
  el('endzone-home').textContent = home.name.toUpperCase();
  el('endzone-away').textContent = away.name.toUpperCase();
  el('score-home').textContent = state.scoreHome;
  el('score-away').textContent = state.scoreAway;
  el('target-line').textContent = `First to ${config.target}`;
  const toGoal = Math.abs(state.goalLine - state.ballOn);
  const dist = distanceToGain();
  const distLabel = dist >= toGoal ? 'Goal' : dist;
  // Make whose ball it is obvious: highlight the team on offense, dim the other.
  const homeBall = state.possession === 'home';
  el('label-home').parentElement.classList.toggle('has-ball', homeBall);
  el('label-away').parentElement.classList.toggle('has-ball', !homeBall);
  let turn;
  if (config.mode === '2p') turn = `🏈 ${teamFor(state.possession).name.toUpperCase()} BALL`;
  else turn = state.possession === config.humanSide ? '🏈 YOUR BALL' : '🛡️ DEFENSE (AI BALL)';
  el('game-status').textContent = `${turn} · ${ordinal(state.down)} & ${distLabel}`;
  el('ball').style.left = yardToPercent(state.ballOn);
  el('firstdown-line').style.left = yardToPercent(state.lineToGain);
  renderPlayers();
}

// Persistent formation: offense teammates behind the ball, defenders ahead of it,
// each colored by their side. Sits behind the ball and the active play markers.
// Read a theme color (e.g. '--home') as a concrete value for canvas shadows.
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#fff';
const CONTACT = { color: 'rgba(0, 0, 0, 0.55)', blur: 3, dy: 6 }; // shared dark drop

// Build (cached) sprites for each actor, with the same shadows the CSS used to
// apply as filters. Place a baked <img> sprite onto the field, glyph feet on the
// (left%, vertical-center) spot — anchorBottom nudges for the bitmap's padding.
function placeActor(wrap, yard, cls, sprite) {
  if (yard < 0 || yard > 100) return;
  const img = document.createElement('img');
  img.className = cls;
  img.src = sprite.url;
  img.style.width = sprite.w + 'px';
  img.style.height = sprite.h + 'px';
  img.style.left = yardToPercent(yard);
  img.style.setProperty('--anchor', sprite.anchorBottom + 'px');
  wrap.appendChild(img);
}

function renderPlayers() {
  const wrap = el('players');
  wrap.innerHTML = '';
  const d = state.direction;
  const sprite = (emoji, side) =>
    emojiSprite(emoji, { size: 24, shadows: [{ color: cssVar(side === 'home' ? '--home' : '--away'), blur: 5 }, CONTACT] });
  const add = (yard, emoji, side) => placeActor(wrap, yard, `player ${side}`, sprite(emoji, side));
  // Offense (with the ball) lines up behind the spot; defense spreads ahead.
  [d * 3, d * 7].forEach((off) => add(state.ballOn - off, '🏃', state.possession));
  [d * 9, d * 16].forEach((off) => add(state.ballOn + off, '🧍', defendingTeam()));
}

// ---- Screen flow ----
function startGame() {
  config.mode = el('mode-select').value;
  config.difficulty = el('difficulty-select').value;
  config.target = Number(el('target-select').value);
  config.homeTeam = el('home-team').value || 'eagles';
  config.awayTeam = el('away-team').value || 'bears';
  config.ball = el('ball-select').value || 'football';
  config.field = el('field-select').value || 'classic';
  config.condition = el('condition-select').value || 'clear';
  config.voice = el('voice-toggle').checked;
  setCoachEnabled(config.voice);
  document.body.classList.toggle('extreme', config.difficulty === 'extreme');
  applyCosmetics();
  unlockAudio();
  initVoice();

  // 1P: 50/50 which side you control. 2P: both sides human.
  config.humanSide = Math.random() < 0.5 ? 'home' : 'away';

  state = freshState();
  setPossession('home', 25);
  showScreen(gameScreen);
  render();

  if (config.mode === 'ai') {
    const t = teamFor(config.humanSide);
    setMessage(`You're the ${t.emoji} ${t.name.toUpperCase()} (${config.humanSide})!`);
    coachSay(`You're on the ${t.name}. Let's win this!`, { interrupt: true });
  } else {
    setMessage('Two-player kickoff!');
    coachSay("Let's play some football!", { interrupt: true });
  }
  setTimeout(runDown, 1600); // let the side announcement read
}

function endGame(winner) {
  const humanWon = config.mode === '2p' ? true : winner === config.humanSide;
  const winnerScore = winner === 'home' ? state.scoreHome : state.scoreAway;
  const before = progress;
  const mult = xpMultiplier(config.mode, config.difficulty);
  const after = updateStats(before, {
    won: humanWon,
    hard: config.mode === 'ai' && (config.difficulty === 'hard' || config.difficulty === 'extreme'),
    score: winnerScore,
    mult,
  });
  const gained = xpForGame({ won: humanWon, score: humanWon ? winnerScore : 0, mult });
  const teamUnlocks = newlyUnlocked(before, after).map((id) => {
    const t = teamById(id); return `${t.emoji} ${t.name}`;
  });
  const rewardUnlocks = newRewards(before.xp, after.xp).map((r) => `${r.emoji} ${r.label}`);
  const unlocked = [...teamUnlocks, ...rewardUnlocks];
  const leveledUp = levelForXp(after.xp) > levelForXp(before.xp);
  progress = after;
  saveProgress(progress);

  // Record your wins on the local leaderboard.
  if (humanWon) {
    const wt = teamFor(winner);
    leaderboard = addEntry(leaderboard, {
      team: wt.name, emoji: wt.emoji, score: winnerScore,
      difficulty: config.difficulty, mode: config.mode, mult,
    });
    saveLeaderboard(leaderboard);
  }

  const wTeam = teamFor(winner);
  const home = teamFor('home'), away = teamFor('away');
  el('win-heading').textContent = humanWon ? 'Well Done!' : 'Game Over';
  el('win-result').textContent =
    `${wTeam.emoji} ${wTeam.name} win — ${home.name} ${state.scoreHome} – ${state.scoreAway} ${away.name}`;
  let xpText = `+${gained} XP${mult > 1 ? ` (×${mult})` : ''}`;
  if (leveledUp) xpText += ` — Level up! → Lv ${levelForXp(after.xp)}`;
  el('win-xp').textContent = xpText;
  const unlockEl = el('win-unlock');
  if (unlocked.length) {
    unlockEl.textContent = '🔓 Unlocked: ' + unlocked.join(', ') + '!';
    unlockEl.classList.remove('hidden');
  } else {
    unlockEl.classList.add('hidden');
  }

  coachSay(coachLine(humanWon ? COACH.win : COACH.lose), { interrupt: true });
  showScreen(winScreen);
}

// ---- Timing-bar input engine ----
// A fresh sweet spot each run: random position and size, always fully on track.
function randomSweet() {
  const green = 3 + Math.random() * 5;          // green half-width 3..8
  const yellow = green + 6 + Math.random() * 9; // forgiving margin around green
  const center = yellow + Math.random() * (100 - 2 * yellow);
  return { center, green, yellow };
}

// Resolves with 'green' | 'yellow' | 'red'. `key` triggers the press ('a','l',' ').
function runTimingBar(key, hint) {
  const bar = el('timing-bar');
  const canvas = el('bar-canvas');
  bar.querySelector('.timing-hint').textContent = hint + ' (or tap)';

  // Randomize the sweet spot's position and size for this press (0..100 maps to
  // the 180deg arc). Drawn as a green band on the canvas below.
  const sweet = randomSweet();
  bar.classList.remove('hidden');
  // Freeze the weather overlay while the bar sweeps. Under software rendering
  // (no GPU) the moving precipitation layers repaint on the main thread every
  // frame and starve the needle's rAF loop, making the bar stutter. A still
  // weather layer for the ~2s press window keeps the needle perfectly smooth.
  document.body.classList.add('timing-active');

  // Draw the whole bar on a <canvas> with cheap vector ops each frame, instead
  // of rotating a DOM needle over a masked/filtered arc. The old approach forced
  // the browser to re-rasterize expensive masked content every frame, which
  // skipped badly under software rendering (no GPU). A few canvas strokes are
  // cheap to repaint in software OR on the GPU, so the sweep stays smooth.
  const W = 300, H = 150, CX = 150, CY = 150, R = 124, RING = 30;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(W * dpr)) {
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
  }
  // pos 0..100 -> angle across the TOP semicircle (left -> up -> right).
  const ang = (p) => Math.PI + (p / 100) * Math.PI;

  return new Promise((resolve) => {
    // percent/second (BAR_SPEED was tuned per-frame at ~60fps)
    const perSec = (BAR_SPEED[config.difficulty] || 1.4) * cond().barSpeedMult * 60;
    const crossMs = (100 / perSec) * 1000; // time to sweep the arc once, end to end
    let startTs = null, rafId = 0, pos = 0;

    function draw(needleColor) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.lineCap = 'butt';
      // Neutral arc track + green sweet band (cheap thin-ish strokes).
      ctx.lineWidth = RING;
      ctx.strokeStyle = 'rgba(220, 255, 230, 0.22)';
      ctx.beginPath(); ctx.arc(CX, CY, R, Math.PI, 2 * Math.PI); ctx.stroke();
      ctx.strokeStyle = 'rgba(46, 204, 64, 0.9)';
      ctx.beginPath(); ctx.arc(CX, CY, R, ang(sweet.center - sweet.green), ang(sweet.center + sweet.green)); ctx.stroke();
      // White needle (or grade color once pressed). No shadowBlur — that is a
      // per-pixel blur every frame, the exact cost we're avoiding.
      const a = ang(pos);
      const inner = R - RING / 2 - 6, outer = R + RING / 2 + 2;
      ctx.lineCap = 'round';
      ctx.lineWidth = 4;
      ctx.strokeStyle = needleColor || '#fff';
      ctx.beginPath();
      ctx.moveTo(CX + inner * Math.cos(a), CY + inner * Math.sin(a));
      ctx.lineTo(CX + outer * Math.cos(a), CY + outer * Math.sin(a));
      ctx.stroke();
    }

    // Live needle position: a constant-velocity triangle wave from the clock.
    // Uniform speed is far easier to time than the old cosine pendulum.
    const currentPos = () => {
      if (startTs === null) return 0;
      const c = (performance.now() - startTs) % (2 * crossMs);
      return (c <= crossMs ? c : 2 * crossMs - c) / crossMs * 100;
    };

    function finish(p) {
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKey);
      TAP_EVENTS.forEach((ev) => gameScreen.removeEventListener(ev, onTap));
      pos = p;
      const grade = gradePress(p, sweet);
      const color = grade === 'green' ? '#2ecc40' : grade === 'yellow' ? '#ffd23f' : '#ff3b3b';
      draw(color); // freeze the needle where they pressed, colored by grade
      document.body.classList.remove('timing-active'); // resume weather motion
      setTimeout(() => {
        bar.classList.add('hidden');
        resolve(grade);
      }, 260);
    }

    function frame(ts) {
      if (startTs === null) startTs = ts;
      pos = currentPos();
      draw();
      rafId = requestAnimationFrame(frame);
    }

    // When the bar started accepting input — used to reject leaked/stale presses
    // (ghost mouse events or held-key auto-repeat) from the previous timing bar.
    const openedAt = performance.now();

    function onKey(e) {
      if (e.key.toLowerCase() !== key) return;
      if (!pressCounts({ elapsedMs: performance.now() - openedAt, isRepeat: e.repeat })) return;
      e.preventDefault();
      finish(currentPos());
    }

    // Touch / mouse: tapping anywhere registers the press (mobile-friendly).
    let tapped = false;
    function onTap(e) {
      if (tapped) return;       // guard against pointer+touch+mouse all firing
      if (!pressCounts({ elapsedMs: performance.now() - openedAt })) return; // ignore leaked taps
      tapped = true;
      if (e.cancelable) e.preventDefault();
      finish(currentPos());
    }

    window.addEventListener('keydown', onKey);
    TAP_EVENTS.forEach((ev) => gameScreen.addEventListener(ev, onTap, { passive: false }));
    rafId = requestAnimationFrame(frame);
  });
}

// AI "presses" the bar by producing a grade from difficulty (no animation).
function aiPress() {
  return aiTimingGrade(config.difficulty, Math.random());
}

// ---- Play loop ----

// Which side does a human control? In AI mode only the rolled human side.
function isHuman(team) {
  return config.mode === '2p' || team === config.humanSide;
}

function teamKey(team) {
  return team === 'home' ? 'a' : 'l';
}

function offenseKey() {
  return teamKey(state.possession);
}

function defendingTeam() {
  return state.possession === 'home' ? 'away' : 'home';
}

// Generate defender yard lines between the ball and the goal for a rush.
function rushDefenders() {
  const d = state.direction;
  const first = state.ballOn + d * 6;
  return [first, first + d * 10, first + d * 22]
    .filter((y) => (d > 0 ? y < state.goalLine : y > state.goalLine));
}

// Render defender markers; highlightIndex marks the controlled (nearest) one.
function renderDefenders(yards, highlightIndex = -1) {
  const wrap = el('defenders');
  wrap.innerHTML = '';
  const base = emojiSprite('🛡️', { size: 32, shadows: [{ color: 'rgba(0, 0, 0, 0.7)', blur: 4 }, CONTACT] });
  const near = emojiSprite('🛡️', { size: 32, shadows: [{ color: cssVar('--amber'), blur: 8 }] });
  yards.forEach((y, i) => {
    const nearest = i === highlightIndex;
    placeActor(wrap, y, nearest ? 'defender nearest' : 'defender', nearest ? near : base);
  });
}

async function playRush() {
  const defenders = rushDefenders();
  renderDefenders(defenders);
  setMessage('RUSH!');
  if (isHuman(state.possession)) coachSay(coachLine(COACH.rush), { interrupt: true });
  const grades = [];
  for (let i = 0; i < defenders.length; i++) {
    const grade = isHuman(state.possession)
      ? await runTimingBar(offenseKey(), 'Break the tackle — hit your key in the green!')
      : aiPress();
    grades.push(grade);
    if (grade === 'red') break; // tackled; remaining defenders irrelevant
  }
  el('defenders').innerHTML = '';
  return resolveRush({
    startYard: state.ballOn, direction: state.direction,
    defenders, grades, goalLine: state.goalLine,
  });
}

// Render pass rushers charging the QB.
function renderRushers(yards) {
  const wrap = el('defenders');
  wrap.innerHTML = '';
  const sprite = emojiSprite('😤', { size: 32, shadows: [{ color: cssVar('--away'), blur: 8 }] });
  for (const y of yards) placeActor(wrap, y, 'defender rusher', sprite);
}

async function playPass() {
  const off = state.possession;
  setMessage('PASS RUSH!');

  // 0) Pass rush — the offense must beat the rush or get sacked (a sack in your
  //    own end zone is a safety).
  const rushers = [state.ballOn + state.direction * 3, state.ballOn + state.direction * 5];
  renderRushers(rushers);
  if (isHuman(off)) coachSay(coachLine(COACH.evade), { interrupt: true });
  const rushGrade = isHuman(off)
    ? await runTimingBar(teamKey(off), 'Beat the rush — hit your key in the green!')
    : aiPress();
  el('defenders').innerHTML = '';
  if (rushGrade === 'red') {
    return resolvePass({
      startYard: state.ballOn, targetYard: state.ballOn,
      goalLine: state.goalLine, ownGoal: state.ownGoal, direction: state.direction, rushGrade,
    });
  }

  // 1) Offense throws (timing). A really bad (red) throw sails into the crowd.
  setMessage('PASS!');
  if (isHuman(off)) coachSay(coachLine(COACH.throw), { interrupt: true });
  const throwGrade = isHuman(off)
    ? await runTimingBar(teamKey(off), 'Throw it — hit your key in the green!')
    : aiPress();

  if (throwGrade === 'red') {
    await overthrow();
    return resolvePass({
      startYard: state.ballOn, targetYard: state.ballOn,
      goalLine: state.goalLine, ownGoal: state.ownGoal, direction: state.direction, rushGrade, throwGrade,
    });
  }

  // 2) Ball flies to the receiver; the nearest defender contests via SPACE.
  const target = state.ballOn + state.direction * 18;
  const clampedTarget = state.direction > 0
    ? Math.min(target, state.goalLine) : Math.max(target, state.goalLine);
  const defenders = [clampedTarget - state.direction * 4, clampedTarget + state.direction * 6];
  const nearIdx = nearestDefender(clampedTarget, defenders);
  renderDefenders([clampedTarget, ...defenders], nearIdx + 1); // +1: index 0 is the receiver

  if (isHuman(defendingTeam())) coachSay(coachLine(COACH.catch), { interrupt: true });
  const defenseGrade = isHuman(defendingTeam())
    ? await runTimingBar(' ', 'Catch it — tap SPACE when the ball arrives!')
    : aiPassDefenseGrade(config.difficulty, Math.random()); // AI intercepts less often

  el('defenders').innerHTML = '';
  return resolvePass({
    startYard: state.ballOn, targetYard: clampedTarget,
    goalLine: state.goalLine, ownGoal: state.ownGoal, direction: state.direction,
    rushGrade, throwGrade, defenseGrade,
    dropChance: cond().dropChance, dropRoll: Math.random(),
  });
}

// Ball sails up into the crowd.
function overthrow() {
  const ball = el('ball');
  ball.classList.add('overthrow');
  return wait(1000).then(() => ball.classList.remove('overthrow'));
}

// Occasionally the weather rolls in/out mid-game. Returns true if it changed.
function maybeChangeWeather() {
  const options = CONDITIONS;
  if (options.length < 2) return false;
  if (Math.random() > 0.15) return false;       // ~15% chance per down
  const pick = options[Math.floor(Math.random() * options.length)];
  if (pick.id === config.condition) return false;
  config.condition = pick.id;
  applyCosmetics();
  setMessage(`Weather change: ${pick.name}!`);
  coachSay(`Weather's turning — ${pick.name.replace(/^\S+\s/, '')}!`, { interrupt: true });
  return true;
}

async function runDown() {
  if (maybeChangeWeather()) await wait(1300);
  const fourth = state.down === 4;
  const choice = await choosePlay(fourth);
  let result;
  if (choice === 'fieldgoal' || choice === 'punt') { await runKick(choice); return; }
  // 'goforit' means run a normal play on 4th down; AI picks rush/pass.
  const play = (choice === 'rush' || choice === 'pass') ? choice : callPlay(Math.random());
  result = play === 'rush' ? await playRush() : await playPass();

  if (result.outcome === 'safety') { await handleSafety(); return; }

  const spot = state.ballOn; // snapshot before applying, for the yardage message
  const { state: next, events } = applyDownResult(state, result);
  state = next;
  render();
  await announce(events, result, spot);

  const winner = checkWin(state, config.target);
  if (winner) { endGame(winner); return; }
  if (events.includes('touchdown')) { await runPat(); return; } // touchdown -> extra point
  setTimeout(runDown, 600);
}

// Offense picks a play. Humans click; AI decides.
function choosePlay(fourth) {
  if (!isHuman(state.possession)) {
    if (fourth) return Promise.resolve(fourthDownDecision({ ballOn: state.ballOn, goalLine: state.goalLine, fgMaxRange: cond().fgMaxRange }));
    return Promise.resolve(callPlay(Math.random()));
  }
  return new Promise((resolve) => {
    const menu = el('playcall');
    menu.classList.remove('hidden');
    menu.querySelectorAll('.fourth-only').forEach((b) => b.classList.toggle('hidden', !fourth));
    function onClick(e) {
      const play = e.target.dataset.play;
      if (!play) return;
      menu.classList.add('hidden');
      menu.removeEventListener('click', onClick);
      resolve(play);
    }
    menu.addEventListener('click', onClick);
  });
}

async function announce(events, result, spot) {
  if (events.includes('touchdown')) {
    setMessage('TOUCHDOWN! 🏈'); playCrowdRoar(); coachSay(coachLine(COACH.td), { interrupt: true });
  } else if (events.includes('turnover')) {
    setMessage('INTERCEPTED!'); coachSay(coachLine(COACH.intercepted), { interrupt: true });
  } else if (events.includes('turnoverOnDowns')) {
    setMessage('Turnover on downs!'); coachSay(coachLine(COACH.turnover), { interrupt: true });
  } else if (events.includes('firstDown')) {
    setMessage('First down!'); coachSay(coachLine(COACH.firstDown), { interrupt: true });
  } else if (result && result.outcome === 'overthrown') {
    setMessage('Overthrown into the crowd!'); coachSay(coachLine(COACH.overthrow), { interrupt: true });
  } else if (result && result.outcome === 'sack') {
    setMessage('SACKED! Loss of yards.'); coachSay(coachLine(COACH.sack), { interrupt: true });
  } else if (result && result.dropped) {
    setMessage('Dropped! 🌧️'); coachSay(coachLine(COACH.drop), { interrupt: true });
  } else if (result && result.outcome === 'incomplete') {
    setMessage('Incomplete.');
  } else {
    setMessage(`Gain of ${Math.abs(result.endYard - spot)} yds`);
  }
  await wait(900);
}

async function runKick(kind) {
  const kicker = state.possession;
  const key = teamKey(kicker);
  if (isHuman(kicker)) coachSay(coachLine(COACH.kick), { interrupt: true });
  const grade = isHuman(kicker)
    ? await runTimingBar(key, kind === 'fieldgoal' ? 'Kick it through — hit the green!' : 'Punt — power up in the green!')
    : aiPress();

  if (kind === 'fieldgoal') {
    const { good } = resolveFieldGoal({ ballOn: state.ballOn, goalLine: state.goalLine, accuracyGrade: grade, maxRange: cond().fgMaxRange });
    if (good) {
      state = addScore(state, kicker, 3);
      render();
      setMessage('Field goal is GOOD! (+3)');
      coachSay(coachLine(COACH.fgGood), { interrupt: true });
      await wait(900);
      const winner = checkWin(state, config.target);
      if (winner) return endGame(winner);
      return startKickoff(kicker);
    }
    setMessage('Field goal is NO GOOD.');
    coachSay(coachLine(COACH.fgNoGood), { interrupt: true });
    await wait(900);
    state = flipPossession(state, state.ballOn);
    render();
    return scheduleNext();
  }

  // punt
  const { newBallOn } = resolvePunt({ ballOn: state.ballOn, direction: state.direction, powerGrade: grade });
  setMessage('Punt away!');
  coachSay(coachLine(COACH.punt), { interrupt: true });
  await wait(700);
  state = flipPossession(state, newBallOn);
  render();
  return scheduleNext();
}

function scheduleNext() { setTimeout(runDown, 500); }

// Safety: the defense scores 2; the conceding team then free-kicks, so the
// scoring team takes over near its own 35.
async function handleSafety() {
  const scoringTeam = defendingTeam(); // the defense gets the points
  state = addScore(state, scoringTeam, 2);
  render();
  setMessage('SAFETY! +2 to the defense');
  playCrowdRoar();
  coachSay(coachLine(COACH.safety), { interrupt: true });
  await wait(1100);
  const winner = checkWin(state, config.target);
  if (winner) return endGame(winner);
  setPossession(scoringTeam, scoringTeam === 'home' ? 35 : 65);
  render();
  scheduleNext();
}

async function runPat() {
  const kicker = state.possession;
  const key = teamKey(kicker);
  setMessage('Extra point attempt…');
  if (isHuman(kicker)) coachSay(coachLine(COACH.kick), { interrupt: true });
  const grade = isHuman(kicker)
    ? await runTimingBar(key, 'Extra point — hit the green!')
    : aiPress();
  const { good } = resolvePat({ accuracyGrade: grade });
  if (good) { state = addScore(state, kicker, 1); setMessage('Extra point GOOD! (+1)'); }
  else setMessage('Extra point missed!');
  render();
  await wait(900);
  const winner = checkWin(state, config.target);
  if (winner) return endGame(winner);
  return startKickoff(kicker);
}

// The scoring team (kicker) kicks off to the other team.
async function startKickoff(kicker) {
  const receiver = kicker === 'home' ? 'away' : 'home';
  const choice = await chooseKickoff(kicker);

  if (choice === 'onside') {
    const key = teamKey(kicker);
    setMessage('Onside kick!');
    const grade = isHuman(kicker)
      ? await runTimingBar(key, 'Recover it — nail the green!')
      : aiPress();
    const { recoveredByKicker } = resolveOnside({ recoveryGrade: grade });
    const recoverYard = midfieldish(kicker);
    if (recoveredByKicker) {
      setMessage('Onside kick RECOVERED!');
      setPossession(kicker, recoverYard);
    } else {
      setMessage('Onside kick recovered by the receiving team.');
      setPossession(receiver, recoverYard);
    }
  } else {
    // Regular kickoff: receiver takes over at their own 25.
    setPossession(receiver, ownStart(receiver));
  }
  render();
  await wait(900);
  scheduleNext();
}

// Human kicker picks regular/onside; AI uses onsideDecision.
function chooseKickoff(kicker) {
  if (!isHuman(kicker)) {
    const scoreDiff = (kicker === 'home' ? state.scoreHome - state.scoreAway : state.scoreAway - state.scoreHome);
    const onside = onsideDecision({ scoreDiff, difficulty: config.difficulty, roll: Math.random() });
    return Promise.resolve(onside ? 'onside' : 'regular');
  }
  return new Promise((resolve) => {
    const menu = el('kickoff-choice');
    menu.classList.remove('hidden');
    function onClick(e) {
      const kick = e.target.dataset.kick;
      if (!kick) return;
      menu.classList.add('hidden');
      menu.removeEventListener('click', onClick);
      resolve(kick);
    }
    menu.addEventListener('click', onClick);
  });
}

// Set possession to `team` with the ball at `yard`, fresh 1st & 10.
function setPossession(team, yard) {
  const goals = offenseGoals(team);
  state = {
    ...state, possession: team, direction: goals.direction,
    goalLine: goals.goalLine, ownGoal: goals.ownGoal, ballOn: yard, down: 1,
    lineToGain: newLineToGain(yard, goals.direction, goals.goalLine),
  };
}

function ownStart(team) { return team === 'home' ? 25 : 75; }     // own 25-yard line
function midfieldish(kicker) { return kicker === 'home' ? 55 : 45; } // onside recovery spot near midfield

// ---- Wiring ----
el('start-btn').addEventListener('click', startGame);
el('replay-btn').addEventListener('click', startGame);
el('back-btn').addEventListener('click', showStart);
el('bp-open-btn').addEventListener('click', showBattlePass);
el('bp-back-btn').addEventListener('click', showStart);
el('bp-badge').addEventListener('click', showBattlePass);
el('lb-open-btn').addEventListener('click', showLeaderboard);
el('lb-back-btn').addEventListener('click', showStart);

// Populate the start screen (team pickers + battle-pass badge) on load.
showStart();

// Exposed for manual testing in the console.
window.__game = { get state() { return state; }, get progress() { return progress; }, render };
