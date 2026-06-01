import { offenseGoals, newLineToGain, checkWin } from './rules.js';
import { unlockAudio, playCrowdRoar } from './sound.js';
import { gradePress } from './timing.js';
import { aiTimingGrade } from './ai.js';
import { resolveRush } from './rush.js';
import { nearestDefender, resolvePass } from './pass.js';
import { applyDownResult } from './rules.js';
import { callPlay } from './ai.js';

const FIELD_LEN = 100; // yard 0..100 maps across #gridiron width
const SWEET = { center: 50, green: 9, yellow: 20 }; // percent-based sweet spot
let activeTiming = null; // { key, resolve } while a bar is live

// ---- DOM ----
const el = (id) => document.getElementById(id);
const startScreen = el('start-screen');
const gameScreen = el('game-screen');
const winScreen = el('win-screen');

// ---- Config + state ----
let config = { mode: 'ai', difficulty: 'medium', target: 21 };
let state = null;

function freshState() {
  const goals = offenseGoals('home');
  return {
    possession: 'home', direction: goals.direction, goalLine: goals.goalLine,
    ownGoal: goals.ownGoal, ballOn: 25, down: 1,
    lineToGain: newLineToGain(25, goals.direction, goals.goalLine),
    scoreHome: 0, scoreAway: 0,
  };
}

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
  for (const s of [startScreen, gameScreen, winScreen]) s.classList.add('hidden');
  screen.classList.remove('hidden');
}

function setMessage(text) {
  el('message').textContent = text;
}

// ---- Render ----
function render() {
  el('score-home').textContent = state.scoreHome;
  el('score-away').textContent = state.scoreAway;
  const toGoal = Math.abs(state.goalLine - state.ballOn);
  const dist = distanceToGain();
  const distLabel = dist >= toGoal ? 'Goal' : dist;
  el('game-status').textContent =
    `${state.possession.toUpperCase()} ball · ${ordinal(state.down)} & ${distLabel}`;
  el('ball').style.left = yardToPercent(state.ballOn);
  el('firstdown-line').style.left = yardToPercent(state.lineToGain);
}

// ---- Screen flow ----
function startGame() {
  config.mode = el('mode-select').value;
  config.difficulty = el('difficulty-select').value;
  config.target = Number(el('target-select').value);
  unlockAudio();
  state = freshState();
  showScreen(gameScreen);
  render();
  setMessage('');
  runDown();
}

function endGame(winner) {
  el('win-text').textContent = `${winner.toUpperCase()} WINS!`;
  showScreen(winScreen);
}

// Run an animated timing bar. Resolves with 'green' | 'yellow' | 'red'.
// `key` is the keyboard key that triggers the press (e.g. 'a', 'l', ' ').
function runTimingBar(key, hint) {
  const bar = el('timing-bar');
  const marker = bar.querySelector('.bar-marker');
  const zone = bar.querySelector('.sweet-zone');
  bar.querySelector('.timing-hint').textContent = hint;

  // Position the green zone from the SWEET config (percent across the track).
  zone.style.left = (SWEET.center - SWEET.yellow) + '%';
  zone.style.width = (SWEET.yellow * 2) + '%';

  bar.classList.remove('hidden');

  return new Promise((resolve) => {
    let pos = 0;
    let dir = 1;
    let rafId = 0;
    const speed = 1.4; // percent per frame

    function finish(grade) {
      cancelAnimationFrame(rafId);
      bar.classList.add('hidden');
      window.removeEventListener('keydown', onKey);
      activeTiming = null;
      resolve(grade);
    }

    function onKey(e) {
      if (e.key.toLowerCase() !== key) return;
      e.preventDefault();
      finish(gradePress(pos, SWEET));
    }

    function frame() {
      pos += dir * speed;
      if (pos >= 100) { pos = 100; dir = -1; }
      if (pos <= 0) { pos = 0; dir = 1; }
      marker.style.left = pos + '%';
      rafId = requestAnimationFrame(frame);
    }

    activeTiming = { key, resolve: finish };
    window.addEventListener('keydown', onKey);
    rafId = requestAnimationFrame(frame);
  });
}

// AI "presses" the bar by producing a grade from difficulty (no animation).
function aiPress() {
  return aiTimingGrade(config.difficulty, Math.random());
}

// ---- Play loop ----

// Which side does a human control? In AI mode only 'home' is human.
function isHuman(team) {
  return config.mode === '2p' || team === 'home';
}

// The key the offense uses for its own timing presses.
function offenseKey() {
  return state.possession === 'home' ? 'a' : 'l';
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

// Render defender markers on the field.
function renderDefenders(yards) {
  const wrap = el('defenders');
  wrap.innerHTML = '';
  for (const y of yards) {
    const div = document.createElement('div');
    div.className = 'defender';
    div.textContent = '🛡️';
    div.style.left = yardToPercent(y);
    wrap.appendChild(div);
  }
}

async function playRush() {
  const defenders = rushDefenders();
  renderDefenders(defenders);
  setMessage('RUSH!');
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

async function playPass() {
  // Receiver is downfield; defenders cover nearby yard lines.
  const target = state.ballOn + state.direction * 18;
  const clampedTarget = state.direction > 0
    ? Math.min(target, state.goalLine) : Math.max(target, state.goalLine);
  const defenders = [clampedTarget - state.direction * 4, clampedTarget + state.direction * 6];
  renderDefenders([clampedTarget, ...defenders]);
  setMessage('PASS!');

  // The DEFENDING side contests with the nearest defender, always via SPACE.
  nearestDefender(clampedTarget, defenders);
  const defenseGrade = isHuman(defendingTeam())
    ? await runTimingBar(' ', 'Catch it — tap SPACE when the ball arrives!')
    : aiPress();

  el('defenders').innerHTML = '';
  return resolvePass({
    startYard: state.ballOn, targetYard: clampedTarget,
    goalLine: state.goalLine, direction: state.direction, defenseGrade,
  });
}

async function runDown() {
  const fourth = state.down === 4;
  const choice = await choosePlay(fourth);
  let result;
  if (choice === 'rush') result = await playRush();
  else if (choice === 'pass') result = await playPass();
  else { await runKick(choice); return; } // fieldgoal/punt handled in the next task

  const spot = state.ballOn; // snapshot before applying, for the yardage message
  const { state: next, events } = applyDownResult(state, result);
  state = next;
  render();
  await announce(events, result, spot);

  const winner = checkWin(state, config.target);
  if (winner) { endGame(winner); return; }
  if (events.includes('touchdown')) { await runPat(); return; } // PAT in the next task
  setTimeout(runDown, 600);
}

// Offense picks a play. Humans click; AI decides.
function choosePlay(fourth) {
  if (!isHuman(state.possession)) {
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
  if (events.includes('touchdown')) { setMessage('TOUCHDOWN! 🏈'); playCrowdRoar(); }
  else if (events.includes('turnover')) setMessage('INTERCEPTED!');
  else if (events.includes('turnoverOnDowns')) setMessage('Turnover on downs!');
  else if (events.includes('firstDown')) setMessage('First down!');
  else if (result && result.outcome === 'incomplete') setMessage('Incomplete.');
  else setMessage(`Gain of ${Math.abs(result.endYard - spot)} yds`);
  await wait(900);
}

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

// Temporary stubs — replaced by real kicking (FG/punt/PAT) in the next task.
async function runKick() { setMessage('(kick — next task)'); await wait(600); setTimeout(runDown, 300); }
async function runPat() { setMessage('(PAT — next task)'); await wait(600); setTimeout(runDown, 300); }

// ---- Wiring ----
el('start-btn').addEventListener('click', startGame);
el('replay-btn').addEventListener('click', () => showScreen(startScreen));

// Exposed for later tasks / manual testing in the console.
window.__game = { get state() { return state; }, render, endGame, checkWin: () => checkWin(state, config.target) };
