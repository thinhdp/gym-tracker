let ctx = null;

function getCtx() {
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

/**
 * Resume the AudioContext after a user gesture — call this on the tap that
 * starts the rest timer so the ding can play later without interaction.
 */
export function unlockAudio() {
  const c = getCtx();
  if (c?.state === "suspended") c.resume();
}

/**
 * Play a short bell-like ding (two sine harmonics with exponential decay).
 * Synthesised via Web Audio API — no file to load, works offline.
 */
export function playDing() {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume();

  const now = c.currentTime;

  const play = (freq, vol, dur) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(now);
    osc.stop(now + dur);
  };

  play(830, 0.3, 1.0);
  play(1245, 0.15, 0.6);
  play(1660, 0.08, 0.4);
}
