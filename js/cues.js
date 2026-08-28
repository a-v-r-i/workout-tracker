/**
 * cues.js — the "your set is over" signal: sound + vibration + a visual flash.
 *
 * Three deliberate choices:
 *
 * 1. WebAudio, never an <audio> element. On Android an <audio> element claims
 *    the media session: the user's music pauses for the beep and often does not
 *    come back. A short oscillator burst mixes over whatever is playing.
 * 2. The AudioContext is created lazily and only after a user gesture, because
 *    autoplay policy starts it `suspended`. home.js fires a
 *    `wt:usergesture` CustomEvent on the first tap; we also watch the first
 *    pointerdown ourselves as a backstop.
 * 3. Settings are read at cue time, not at init time, so toggling sound off in
 *    Settings takes effect on the very next rest timer without a reload.
 *
 *   import * as cues from './cues.js';
 *   cues.init();          // idempotent
 *   cues.cue('rest-done');
 */

import { getSettings } from './store.js';

/** kind → { tones: [{ freq, ms, gain, delay }], vibrate: pattern } */
const CUES = {
  // Rest is over: the one you must notice across a gym. Two bright blips.
  'rest-done': {
    tones: [
      { freq: 880, ms: 120, gain: 0.16, delay: 0 },
      { freq: 1174, ms: 120, gain: 0.16, delay: 170 },
    ],
    vibrate: [60, 40, 60],
  },
  // A hold (plank, stretch) finished. Warmer, single, lower.
  'hold-done': {
    tones: [{ freq: 660, ms: 160, gain: 0.15, delay: 0 }],
    vibrate: [80],
  },
  // Moving to the next stretch. Quiet, mid — informational, not a demand.
  transition: {
    tones: [{ freq: 523, ms: 110, gain: 0.11, delay: 0 }],
    vibrate: [80],
  },
  // 3-2-1 tick. Deliberately the smallest sound in the set.
  countdown: {
    tones: [{ freq: 440, ms: 55, gain: 0.07, delay: 0 }],
    vibrate: null,
  },
};

let ctx = null;
let inited = false;
let gestureBound = false;

function makeContext() {
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  try {
    return new AC();
  } catch (err) {
    console.warn('[cues] AudioContext unavailable', err);
    return null;
  }
}

/**
 * Called on the first user gesture. Creating the context here (rather than at
 * module load) is what keeps it out of the `suspended` state.
 */
function unlock() {
  if (!ctx) ctx = makeContext();
  if (!ctx) {
    detachGesture();
    return;
  }
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {
      /* still locked — the next gesture gets another go */
    });
  }
  if (ctx.state === 'running') detachGesture();
}

function detachGesture() {
  if (!gestureBound || typeof window === 'undefined') return;
  gestureBound = false;
  window.removeEventListener('pointerdown', unlock, true);
  window.removeEventListener('touchstart', unlock, true);
  window.removeEventListener('keydown', unlock, true);
}

/** Idempotent. Safe to call from every view's mount(). */
export function init() {
  if (inited || typeof window === 'undefined') return;
  inited = true;

  // home.js fires this on the first tap so the context is warm before the
  // user ever reaches a timer.
  window.addEventListener('wt:usergesture', unlock);

  if (!gestureBound) {
    gestureBound = true;
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('touchstart', unlock, true);
    window.addEventListener('keydown', unlock, true);
  }
}

function tone({ freq, ms, gain, delay }) {
  if (!ctx || ctx.state !== 'running') return;
  const t0 = ctx.currentTime + delay / 1000;
  const dur = ms / 1000;

  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, t0);

  // Ramp in and out: a raw start/stop on a sine gives an audible click.
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  osc.connect(amp).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
  osc.onended = () => {
    try {
      osc.disconnect();
      amp.disconnect();
    } catch {
      /* already torn down */
    }
  };
}

/**
 * Fire one cue across every channel the user has left switched on.
 * @param {'rest-done'|'hold-done'|'transition'|'countdown'} kind
 */
export function cue(kind) {
  const spec = CUES[kind];
  if (!spec) return;

  let settings;
  try {
    settings = getSettings();
  } catch {
    settings = { sound: true, vibrate: true, visualCue: true };
  }

  if (settings.sound) {
    if (!ctx) unlock(); // first cue of a session that skipped the gesture hook
    try {
      spec.tones.forEach(tone);
    } catch (err) {
      console.warn('[cues] tone failed', err);
    }
  }

  if (settings.vibrate && spec.vibrate && typeof navigator !== 'undefined') {
    try {
      navigator.vibrate?.(spec.vibrate);
    } catch {
      /* unsupported or blocked — the other channels still fired */
    }
  }

  if (settings.visualCue && typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('wt:visualcue', { detail: { kind } }));
    } catch {
      /* no CustomEvent — nothing to flash */
    }
  }
}

/** Exposed for tests / diagnostics. */
export function audioState() {
  return ctx ? ctx.state : 'none';
}
