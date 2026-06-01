// Coach voice via the browser's built-in Web Speech API. No assets, no deps.
let enabled = true;
let voice = null;

export function setCoachEnabled(on) {
  enabled = on;
  if (!on && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}

// Pick a coach-like English voice. Voices may load asynchronously, so re-pick
// whenever the browser reports new ones.
export function initVoice() {
  if (!('speechSynthesis' in window)) return;
  const pick = () => {
    const voices = window.speechSynthesis.getVoices();
    voice = voices.find((v) => /en[-_]US/i.test(v.lang) && /(daniel|alex|fred|aaron|male|guy)/i.test(v.name))
      || voices.find((v) => /^en/i.test(v.lang))
      || voices[0] || null;
  };
  pick();
  window.speechSynthesis.onvoiceschanged = pick;
}

// Speak a line in the coach voice. `interrupt` cancels anything still talking.
export function coachSay(text, { interrupt = false } = {}) {
  if (!enabled || !('speechSynthesis' in window)) return;
  if (interrupt) window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if (voice) u.voice = voice;
  u.rate = 1.05;   // punchy
  u.pitch = 0.8;   // lower-pitched, coach-like
  u.volume = 1;
  window.speechSynthesis.speak(u);
}

// Pick a random line from a pool so the coach doesn't repeat himself.
export function coachLine(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
}
