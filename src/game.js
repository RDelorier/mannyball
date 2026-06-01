import { offenseGoals, newLineToGain, checkWin } from './rules.js';
import { unlockAudio, playCrowdRoar } from './sound.js';
import { gradePress } from './timing.js';
import { aiTimingGrade } from './ai.js';

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

// ---- Wiring ----
el('start-btn').addEventListener('click', startGame);
el('replay-btn').addEventListener('click', () => showScreen(startScreen));

// Exposed for later tasks / manual testing in the console.
window.__game = { get state() { return state; }, render, endGame, checkWin: () => checkWin(state, config.target) };
