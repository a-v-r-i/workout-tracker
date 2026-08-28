/**
 * timer.js — wall-clock timer engines.
 *
 * Why not setInterval arithmetic: mobile browsers throttle (or freeze outright)
 * timers in a backgrounded tab. A timer that counts down by subtracting 250ms
 * per tick drifts badly, and a rest timer that finishes while the screen is off
 * would never fire at all. So:
 *
 *   - The single source of truth is `endsAt = Date.now() + remainingMs`.
 *   - A 250ms interval only *reads* the clock. It never accumulates.
 *   - On `visibilitychange` → visible we recompute immediately and fire any
 *     onDone / onStepChange that was missed while hidden, exactly once each
 *     (guard flags, not "did the interval happen to run").
 *   - pause() stores the remaining ms; resume() rebuilds endsAt from it.
 *
 * Nothing here touches the DOM except the visibilitychange listener, which is
 * feature-detected so this module can be imported (and tested) in node.
 *
 *   const t = createCountdown({ seconds: 90, onTick: render, onDone: beep });
 *   t.start(); t.addSeconds(30); t.pause(); t.resume(); t.cancel();
 */

const TICK_MS = 250;
const hasDocument = typeof document !== 'undefined';

function now() {
  return Date.now();
}

/** Whole seconds still to go, rounded up so "1" is shown until we truly hit 0. */
function toSec(ms) {
  return Math.max(0, Math.ceil(ms / 1000));
}

/* ------------------------------------------------------------------ shared */

/**
 * Interval + visibilitychange plumbing shared by both engines.
 * `onCheck` is called on every tick and on every return to visibility.
 */
function createClock(onCheck) {
  let intervalId = null;
  let listening = false;

  const onVisible = () => {
    if (document.visibilityState === 'visible') onCheck();
  };

  return {
    run() {
      if (intervalId === null) intervalId = setInterval(onCheck, TICK_MS);
      if (hasDocument && !listening) {
        document.addEventListener('visibilitychange', onVisible);
        listening = true;
      }
    },
    /** Stop ticking but keep listening — a paused timer needs no clock at all. */
    halt() {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    },
    dispose() {
      this.halt();
      if (hasDocument && listening) {
        document.removeEventListener('visibilitychange', onVisible);
        listening = false;
      }
    },
  };
}

function safe(fn, arg) {
  if (typeof fn !== 'function') return;
  try {
    fn(arg);
  } catch (err) {
    console.error('[timer] callback threw', err);
  }
}

/* --------------------------------------------------------------- countdown */

/**
 * A single countdown.
 *
 * @param {object}   opts
 * @param {number}   opts.seconds  duration in seconds
 * @param {function} [opts.onTick] ({ remainingMs, remainingSec, totalMs, pct })
 *                                 pct counts 0 → 100 as the timer empties.
 * @param {function} [opts.onDone] fired exactly once when it reaches zero
 * @returns {{start:Function, pause:Function, resume:Function,
 *            addSeconds:Function, cancel:Function, getRemaining:Function,
 *            state:string}}
 *          `state` is a live getter: idle | running | paused | done | cancelled.
 *          `getRemaining()` returns milliseconds.
 */
export function createCountdown({ seconds = 0, onTick, onDone } = {}) {
  let totalMs = Math.max(0, Math.round(seconds * 1000));
  let remainingMs = totalMs;
  let endsAt = null;
  let state = 'idle';
  let doneFired = false;

  const clock = createClock(check);

  function snapshot(ms) {
    return {
      remainingMs: ms,
      remainingSec: toSec(ms),
      totalMs,
      pct: totalMs > 0 ? Math.min(100, Math.max(0, ((totalMs - ms) / totalMs) * 100)) : 100,
    };
  }

  function currentMs() {
    if (state === 'running') return Math.max(0, endsAt - now());
    return Math.max(0, remainingMs);
  }

  function finish() {
    if (doneFired) return;
    doneFired = true;
    remainingMs = 0;
    endsAt = null;
    state = 'done';
    clock.halt();
    safe(onTick, snapshot(0));
    safe(onDone);
  }

  /** The only place the clock is read. Called by the interval AND on wake. */
  function check() {
    if (state !== 'running') return;
    const ms = Math.max(0, endsAt - now());
    if (ms <= 0) {
      finish();
      return;
    }
    remainingMs = ms;
    safe(onTick, snapshot(ms));
  }

  return {
    get state() {
      return state;
    },

    start() {
      if (state === 'running') return;
      if (state === 'done' || state === 'cancelled') {
        // Restart from the top.
        remainingMs = totalMs;
        doneFired = false;
      }
      if (remainingMs <= 0) {
        state = 'running';
        finish();
        return;
      }
      state = 'running';
      endsAt = now() + remainingMs;
      clock.run();
      safe(onTick, snapshot(remainingMs));
    },

    pause() {
      if (state !== 'running') return;
      remainingMs = Math.max(0, endsAt - now());
      endsAt = null;
      state = 'paused';
      clock.halt();
      safe(onTick, snapshot(remainingMs));
    },

    resume() {
      if (state !== 'paused') return;
      state = 'running';
      endsAt = now() + remainingMs;
      clock.run();
      check();
    },

    /**
     * Extend (or shorten, with a negative n) the countdown. Works while
     * running, paused, or idle. Adding time to an already-finished countdown
     * revives it — that is what the "+30s" button should do if you tap it a
     * beat after the beep.
     */
    addSeconds(n) {
      const delta = Math.round((Number(n) || 0) * 1000);
      if (!delta) return currentMs();
      totalMs = Math.max(0, totalMs + Math.max(0, delta));

      if (state === 'running') {
        endsAt = Math.max(now(), endsAt + delta);
        remainingMs = endsAt - now();
        check();
      } else if (state === 'done' && delta > 0) {
        remainingMs = delta;
        doneFired = false;
        state = 'running';
        endsAt = now() + remainingMs;
        clock.run();
        safe(onTick, snapshot(remainingMs));
      } else if (state !== 'cancelled') {
        remainingMs = Math.max(0, remainingMs + delta);
        safe(onTick, snapshot(remainingMs));
      }
      return currentMs();
    },

    /** Stop for good and release the interval + visibility listener. */
    cancel() {
      state = 'cancelled';
      endsAt = null;
      clock.dispose();
    },

    /** Milliseconds left. Safe to call in any state. */
    getRemaining() {
      return currentMs();
    },
  };
}

/* ---------------------------------------------------------------- sequence */

/**
 * A chain of timed steps — the stretch routine player.
 *
 * @param {object} opts
 * @param {Array<{label:string, seconds:number, kind?:'hold'|'transition', meta?:any}>} opts.steps
 * @param {function} [opts.onTick]       ({ step, index, total, remainingMs, remainingSec, pct })
 * @param {function} [opts.onStepChange] ({ step, index, total, remainingMs, catchUp })
 *        Fired once when each step begins, including the first on start().
 *        `catchUp: true` marks a step that elapsed entirely while the tab was
 *        hidden — the view uses it to suppress a burst of beeps on wake and
 *        only cue the step it actually landed on.
 * @param {function} [opts.onDone]       fired exactly once after the last step
 * @returns {{start:Function, pause:Function, resume:Function, skipStep:Function,
 *            cancel:Function, getIndex:Function, getRemaining:Function, state:string}}
 */
export function createSequence({ steps = [], onTick, onStepChange, onDone } = {}) {
  const list = (steps || []).map((s) => ({
    label: s.label || '',
    seconds: Math.max(0, Number(s.seconds) || 0),
    kind: s.kind || 'hold',
    meta: s.meta,
  }));

  let index = -1;
  let remainingMs = 0;
  let endsAt = null;
  let state = 'idle';
  let doneFired = false;

  const clock = createClock(check);

  function stepMs(i) {
    return list[i] ? Math.round(list[i].seconds * 1000) : 0;
  }

  function snapshot(ms) {
    const total = stepMs(index) || 1;
    return {
      step: list[index] || null,
      index,
      total: list.length,
      remainingMs: ms,
      remainingSec: toSec(ms),
      pct: Math.min(100, Math.max(0, ((total - ms) / total) * 100)),
    };
  }

  function currentMs() {
    if (state === 'running') return Math.max(0, endsAt - now());
    return Math.max(0, remainingMs);
  }

  function finish() {
    if (doneFired) return;
    doneFired = true;
    state = 'done';
    endsAt = null;
    remainingMs = 0;
    clock.halt();
    safe(onDone);
  }

  function announce(catchUp) {
    safe(onStepChange, {
      step: list[index],
      index,
      total: list.length,
      remainingMs: currentMs(),
      catchUp: !!catchUp,
    });
  }

  /**
   * Walk forward from a step whose endsAt is in the past, carrying the overflow
   * into the next step so a long background gap lands on the *right* step
   * rather than restarting the next one from full.
   */
  function advance(t) {
    while (true) {
      const overflow = Math.max(0, t - endsAt);
      index += 1;
      if (index >= list.length) {
        index = list.length - 1;
        finish();
        return;
      }
      const dur = stepMs(index);
      endsAt = t + dur - overflow;
      if (endsAt > t) {
        remainingMs = endsAt - t;
        announce(false);
        safe(onTick, snapshot(remainingMs));
        return;
      }
      // This whole step elapsed while we were away. Report it, then keep going.
      remainingMs = 0;
      announce(true);
    }
  }

  function check() {
    if (state !== 'running') return;
    const t = now();
    if (t >= endsAt) {
      advance(t);
      return;
    }
    remainingMs = endsAt - t;
    safe(onTick, snapshot(remainingMs));
  }

  return {
    get state() {
      return state;
    },

    start() {
      if (state === 'running' || !list.length) {
        if (!list.length) finish();
        return;
      }
      if (state === 'done' || state === 'cancelled') {
        index = -1;
        doneFired = false;
      }
      state = 'running';
      if (index < 0) {
        index = 0;
        endsAt = now() + stepMs(index);
        remainingMs = stepMs(index);
        clock.run();
        announce(false);
        safe(onTick, snapshot(remainingMs));
        check(); // a zero-length first step should not hang
      } else {
        endsAt = now() + remainingMs;
        clock.run();
        check();
      }
    },

    pause() {
      if (state !== 'running') return;
      remainingMs = Math.max(0, endsAt - now());
      endsAt = null;
      state = 'paused';
      clock.halt();
      safe(onTick, snapshot(remainingMs));
    },

    resume() {
      if (state !== 'paused') return;
      state = 'running';
      endsAt = now() + remainingMs;
      clock.run();
      check();
    },

    /** Cut the current step short and move to the next one immediately. */
    skipStep() {
      if (state === 'done' || state === 'cancelled') return;
      const wasPaused = state === 'paused';
      state = 'running';
      const t = now();
      endsAt = t; // zero overflow — the next step gets its full duration
      clock.run();
      advance(t);
      if (wasPaused && state === 'running') {
        // Preserve the user's paused intent across a skip.
        remainingMs = Math.max(0, endsAt - now());
        endsAt = null;
        state = 'paused';
        clock.halt();
      }
    },

    cancel() {
      state = 'cancelled';
      endsAt = null;
      clock.dispose();
    },

    getIndex() {
      return index;
    },

    getRemaining() {
      return currentMs();
    },
  };
}
