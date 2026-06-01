import { offenseGoals, newLineToGain, checkWin } from './rules.js';
import { unlockAudio, playCrowdRoar } from './sound.js';
import { gradePress } from './timing.js';
import { aiTimingGrade } from './ai.js';
import { resolveRush } from './rush.js';
import { nearestDefender, resolvePass } from './pass.js';
import { applyDownResult } from './rules.js';
import { callPlay } from './ai.js';
import { resolveFieldGoal, resolvePunt, resolvePat, resolveOnside } from './kick.js';
import { addScore, flipPossession } from './rules.js';
import { fourthDownDecision, onsideDecision } from './ai.js';

const SWEET = { center: 50, green: 9, yellow: 20 }; // percent-based sweet spot

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
  el('target-line').textContent = `First to ${config.target}`;
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
  // Opening possession: home receives at its own 25.
  setPossession('home', 25);
  render();
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
  zone.style.left = (SWEET.center - SWEET.green) + '%';
  zone.style.width = (SWEET.green * 2) + '%';

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

// Keyboard key a team uses for its timing presses.
function teamKey(team) {
  return team === 'home' ? 'a' : 'l';
}

// The key the offense uses for its own timing presses.
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

// Render defender markers on the field.
function renderDefenders(yards, highlightIndex = -1) {
  const wrap = el('defenders');
  wrap.innerHTML = '';
  yards.forEach((y, i) => {
    const div = document.createElement('div');
    div.className = i === highlightIndex ? 'defender nearest' : 'defender';
    div.textContent = '🛡️';
    div.style.left = yardToPercent(y);
    wrap.appendChild(div);
  });
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
  // The defender nearest the receiver is the one the defending side controls.
  const nearIdx = nearestDefender(clampedTarget, defenders);
  renderDefenders([clampedTarget, ...defenders], nearIdx + 1); // +1: index 0 is the receiver
  setMessage('PASS!');

  // The DEFENDING side contests with that nearest defender, always via SPACE.
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
  if (choice === 'fieldgoal' || choice === 'punt') { await runKick(choice); return; }
  // 'goforit' means run a normal play on 4th down; AI picks rush/pass.
  const play = (choice === 'rush' || choice === 'pass') ? choice : callPlay(Math.random());
  result = play === 'rush' ? await playRush() : await playPass();

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
    if (fourth) return Promise.resolve(fourthDownDecision({ ballOn: state.ballOn, goalLine: state.goalLine }));
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

async function runKick(kind) {
  const kicker = state.possession;
  const key = teamKey(kicker);
  const grade = isHuman(kicker)
    ? await runTimingBar(key, kind === 'fieldgoal' ? 'Kick it through — hit the green!' : 'Punt — power up in the green!')
    : aiPress();

  if (kind === 'fieldgoal') {
    const { good } = resolveFieldGoal({ ballOn: state.ballOn, goalLine: state.goalLine, accuracyGrade: grade });
    if (good) {
      state = addScore(state, kicker, 3);
      render();
      setMessage('Field goal is GOOD! (+3)');
      await wait(900);
      const winner = checkWin(state, config.target);
      if (winner) return endGame(winner);
      return startKickoff(kicker);
    }
    setMessage('Field goal is NO GOOD.');
    await wait(900);
    state = flipPossession(state, state.ballOn);
    render();
    return scheduleNext();
  }

  // punt
  const { newBallOn } = resolvePunt({ ballOn: state.ballOn, direction: state.direction, powerGrade: grade });
  setMessage('Punt away!');
  await wait(700);
  state = flipPossession(state, newBallOn);
  render();
  return scheduleNext();
}

function scheduleNext() { setTimeout(runDown, 500); }

async function runPat() {
  const kicker = state.possession;
  const key = teamKey(kicker);
  setMessage('Extra point attempt…');
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
el('replay-btn').addEventListener('click', () => showScreen(startScreen));

// Exposed for later tasks / manual testing in the console.
window.__game = { get state() { return state; }, render, endGame, checkWin: () => checkWin(state, config.target) };
