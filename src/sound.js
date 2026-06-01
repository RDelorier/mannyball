// Synthesized crowd roar. No audio files; everything is generated at runtime.
let ctx = null;

// Must be called from a user gesture (e.g. clicking Start) to satisfy autoplay.
export function unlockAudio() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Play a ~2s crowd roar: filtered white noise that swells and fades.
export function playCrowdRoar() {
  if (!ctx) return; // audio not unlocked yet
  const now = ctx.currentTime;
  const duration = 2.0;

  // White-noise buffer.
  const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  // Band-pass gives the noise a "crowd" timbre rather than flat hiss.
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 900;
  filter.Q.value = 0.7;

  // Swell up then fade for the roar shape.
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.6, now + 0.4);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start(now);
  source.stop(now + duration);
}
