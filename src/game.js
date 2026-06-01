import { offenseGoals, newLineToGain, checkWin } from './rules.js';
import { unlockAudio, playCrowdRoar } from './sound.js';
import { gradePress } from './timing.js';
import { aiTimingGrade, aiPassDefenseGrade, callPlay, fourthDownDecision, onsideDecision } from './ai.js';
import { resolveRush } from './rush.js';
import { nearestDefender, resolvePass } from './pass.js';
import { applyDownResult, addScore, flipPossession } from './rules.js';
import { resolveFieldGoal, resolvePunt, resolvePat, resolveOnside } from './kick.js';
import {
  TEAMS, teamById, isUnlocked, unlockLabel, bpProgress,
  updateStats, newlyUnlocked, levelForXp, xpForGame,
  REWARD_TRACK, BALL_SKINS, unlockedBalls, unlockedFields, currentTitle, newRewards,
} from './teams.js';
import { setCoachEnabled, initVoice, coachSay, coachLine } from './voice.js';
import { CONDITIONS, conditionById } from './conditions.js';

const SWEET = { center: 50, green: 5, yellow: 20 }; // tight green window

// Timing-bar sweep speed (percent/frame) by difficulty — EXTREME is frantic.
const BAR_SPEED = { easy: 1.2, medium: 1.4, hard: 1.8, extreme: 2.7 };

// ---- DOM ----
const el = (id) => document.getElementById(id);
const startScreen = el('start-screen');
const gameScreen = el('game-screen');
const winScreen = el('win-screen');
const bpScreen = el('bp-screen');

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
  for (const s of [startScreen, gameScreen, winScreen, bpScreen]) s.classList.add('hidden');
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
  el('game-status').textContent =
    `${teamFor(state.possession).name.toUpperCase()} ball · ${ordinal(state.down)} & ${distLabel}`;
  el('ball').style.left = yardToPercent(state.ballOn);
  el('firstdown-line').style.left = yardToPercent(state.lineToGain);
  renderPlayers();
}

// Persistent formation: offense teammates behind the ball, defenders ahead of it,
// each colored by their side. Sits behind the ball and the active play markers.
function renderPlayers() {
  const wrap = el('players');
  wrap.innerHTML = '';
  const d = state.direction;
  const add = (yard, emoji, side) => {
    if (yard < 0 || yard > 100) return;
    const div = document.createElement('div');
    div.className = `player ${side}`;
    div.textContent = emoji;
    div.style.left = yardToPercent(yard);
    wrap.appendChild(div);
  };
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
  const after = updateStats(before, {
    won: humanWon,
    hard: config.mode === 'ai' && (config.difficulty === 'hard' || config.difficulty === 'extreme'),
    score: winnerScore,
  });
  const gained = xpForGame({ won: humanWon, score: humanWon ? winnerScore : 0 });
  const teamUnlocks = newlyUnlocked(before, after).map((id) => {
    const t = teamById(id); return `${t.emoji} ${t.name}`;
  });
  const rewardUnlocks = newRewards(before.xp, after.xp).map((r) => `${r.emoji} ${r.label}`);
  const unlocked = [...teamUnlocks, ...rewardUnlocks];
  const leveledUp = levelForXp(after.xp) > levelForXp(before.xp);
  progress = after;
  saveProgress(progress);

  const wTeam = teamFor(winner);
  const home = teamFor('home'), away = teamFor('away');
  el('win-heading').textContent = humanWon ? 'Well Done!' : 'Game Over';
  el('win-result').textContent =
    `${wTeam.emoji} ${wTeam.name} win — ${home.name} ${state.scoreHome} – ${state.scoreAway} ${away.name}`;
  let xpText = `+${gained} XP`;
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
// Resolves with 'green' | 'yellow' | 'red'. `key` triggers the press ('a','l',' ').
function runTimingBar(key, hint) {
  const bar = el('timing-bar');
  const marker = bar.querySelector('.bar-marker');
  const zone = bar.querySelector('.sweet-zone');
  const track = bar.querySelector('.bar-track');
  bar.querySelector('.timing-hint').textContent = hint;

  // Visible green band matches the actual green grade window.
  zone.style.left = (SWEET.center - SWEET.green) + '%';
  zone.style.width = (SWEET.green * 2) + '%';

  marker.classList.remove('green', 'yellow', 'red');
  track.classList.remove('miss');
  bar.classList.remove('hidden');

  return new Promise((resolve) => {
    let pos = 0, dir = 1, rafId = 0;
    const speed = (BAR_SPEED[config.difficulty] || 1.4) * cond().barSpeedMult; // percent per frame

    function finish(grade) {
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKey);
      marker.classList.add(grade);               // green | yellow | red
      if (grade === 'red') track.classList.add('miss'); // dark-red flash on a really bad press
      setTimeout(() => {
        bar.classList.add('hidden');
        marker.classList.remove('green', 'yellow', 'red');
        track.classList.remove('miss');
        resolve(grade);
      }, 260);
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
  for (const y of yards) {
    const div = document.createElement('div');
    div.className = 'defender rusher';
    div.textContent = '😤';
    div.style.left = yardToPercent(y);
    wrap.appendChild(div);
  }
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
  });
}

// Ball sails up into the crowd.
function overthrow() {
  const ball = el('ball');
  ball.classList.add('overthrow');
  return wait(1000).then(() => ball.classList.remove('overthrow'));
}

async function runDown() {
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

// Populate the start screen (team pickers + battle-pass badge) on load.
showStart();

// Exposed for manual testing in the console.
window.__game = { get state() { return state; }, get progress() { return progress; }, render };
