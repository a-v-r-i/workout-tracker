/**
 * wakelock.js — thin wrapper over the Screen Wake Lock API.
 *
 * Why a wrapper: the lock is dropped by the browser whenever the tab is hidden
 * (screen off, app switched), and it is NOT restored automatically. This module
 * remembers that you asked for it and re-acquires on the way back to visible.
 *
 * Every call is safe on unsupported browsers (iOS Safari < 16.4, Firefox): the
 * functions resolve to a no-op. Check isSupported() before offering a UI toggle.
 *
 *   import * as wakelock from './wakelock.js';
 *   await wakelock.enable();   // during a workout
 *   wakelock.disable();        // when it ends
 */

let sentinel = null;   // the active WakeLockSentinel, if any
let wanted = false;    // did the caller ask for the lock to be held?
let listening = false;

export function isSupported() {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

export function isActive() {
  return !!sentinel && !sentinel.released;
}

async function acquire() {
  if (!isSupported() || isActive()) return isActive();
  try {
    sentinel = await navigator.wakeLock.request('screen');
    sentinel.addEventListener('release', () => {
      // Released by us or by the browser (tab hidden). visibilitychange
      // re-acquires if `wanted` is still true.
      sentinel = null;
    });
    return true;
  } catch (err) {
    // Common causes: not visible, low battery, permissions policy. Not fatal.
    console.warn('[wakelock] request failed', err && err.name, err && err.message);
    sentinel = null;
    return false;
  }
}

function onVisibility() {
  if (wanted && document.visibilityState === 'visible' && !isActive()) {
    acquire();
  }
}

/**
 * Hold the screen awake until disable() is called.
 * @returns {Promise<boolean>} true if the lock is currently held.
 */
export async function enable() {
  wanted = true;
  if (!isSupported()) return false;
  if (!listening) {
    document.addEventListener('visibilitychange', onVisibility);
    listening = true;
  }
  return acquire();
}

/** Release the lock and stop re-acquiring it. */
export function disable() {
  wanted = false;
  if (listening) {
    document.removeEventListener('visibilitychange', onVisibility);
    listening = false;
  }
  const s = sentinel;
  sentinel = null;
  if (s && !s.released) {
    try {
      s.release();
    } catch (err) {
      console.warn('[wakelock] release failed', err);
    }
  }
}
