/**
 * store.js — the ONLY module in the app that touches localStorage.
 *
 * Rules for other modules:
 *   - Never read/write localStorage directly. Add a function here instead.
 *   - Every getter returns a fresh, plain, JSON-safe value (safe to mutate).
 *   - Every setter is a synchronous write-through: it updates the in-memory
 *     cache and localStorage before returning.
 *
 * Failure behaviour:
 *   - Corrupt JSON is never silently destroyed. The raw string is copied to
 *     `wt.corrupt.<key>` and the key is reinitialized to its default.
 *   - A failed write (QuotaExceededError and friends) surfaces a toast via the
 *     `wt:toast` window event. app.js listens for it, so store.js stays free of
 *     any import back into the UI layer (no circular imports).
 */

/* ------------------------------------------------------------------ config */

export const SCHEMA_VERSION = 1;
export const APP_VERSION = '1.0.0';

const P = 'wt.';
const K = {
  meta: P + 'meta',
  settings: P + 'settings',
  sessions: P + 'sessions',
  exerciseState: P + 'exerciseState',
  activeSession: P + 'activeSession',
  bodyWeights: P + 'bodyWeights',
};

/** Settings defaults. Primary target is Android Chrome, so sound + vibrate
 *  default on. The settings UI hides the vibrate row where it is unsupported. */
export const DEFAULTS = {
  restTimerSec: 90,
  stretchTransitionSec: 15,
  sound: true,
  vibrate: true,
  visualCue: true,
  noAxialLoading: false,
  weightUnit: 'kg',
  keepScreenOn: true,
};

/**
 * Ordered migrations, keyed by the version they upgrade *to*.
 * A migration receives no arguments and mutates storage through the helpers
 * below. Empty at schemaVersion 1 — add entries as the shape changes:
 *   2: () => { ... }
 */
const MIGRATIONS = {};

/* ------------------------------------------------------- low-level access */

const cache = new Map();

function toast(msg) {
  try {
    window.dispatchEvent(new CustomEvent('wt:toast', { detail: { msg } }));
  } catch {
    /* non-browser context — nothing to notify */
  }
}

function quarantine(key, raw) {
  // key already carries the `wt.` prefix — strip it so we get
  // `wt.corrupt.sessions`, not `wt.corrupt.wt.sessions`.
  const short = key.startsWith(P) ? key.slice(P.length) : key;
  try {
    localStorage.setItem(P + 'corrupt.' + short, raw);
  } catch {
    /* if even the quarantine write fails there is nothing more we can do */
  }
  console.warn('[store] corrupt value for', key, '— quarantined and reset');
}

/** Read + parse a key. On corruption: quarantine the raw string, return fallback. */
function read(key, fallback) {
  if (cache.has(key)) return cache.get(key);
  let raw = null;
  try {
    raw = localStorage.getItem(key);
  } catch (err) {
    console.warn('[store] localStorage unavailable:', err);
    cache.set(key, fallback);
    return fallback;
  }
  if (raw === null) {
    cache.set(key, fallback);
    return fallback;
  }
  try {
    const parsed = JSON.parse(raw);
    // Shape check: an array key must hold an array, an object key an object.
    if (Array.isArray(fallback) && !Array.isArray(parsed)) throw new Error('expected array');
    if (fallback && typeof fallback === 'object' && !Array.isArray(fallback)) {
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('expected object');
      }
    }
    cache.set(key, parsed);
    return parsed;
  } catch {
    quarantine(key, raw);
    write(key, fallback);
    return fallback;
  }
}

/** Serialize + persist. Returns true on success, false (with a toast) on failure. */
function write(key, value) {
  cache.set(key, value);
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    const quota =
      err && (err.name === 'QuotaExceededError' ||
              err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
              err.code === 22);
    toast(quota
      ? 'Storage full — export a backup and clear old sessions.'
      : 'Could not save. Changes may be lost.');
    console.error('[store] write failed for', key, err);
    return false;
  }
}

function clone(v) {
  return v === undefined || v === null ? v : JSON.parse(JSON.stringify(v));
}

function todayISO(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* -------------------------------------------------------------- meta / migrate */

function defaultMeta() {
  return { schemaVersion: SCHEMA_VERSION, installedAt: Date.now(), lastExportAt: null };
}

/**
 * Boot-time schema check. Call once, before any other store call.
 * Initializes meta on first run, then applies every migration whose target
 * version is above the stored one, in ascending order, and writes meta back.
 */
export function migrate() {
  let meta = read(K.meta, null);
  if (!meta || typeof meta !== 'object' || typeof meta.schemaVersion !== 'number') {
    meta = defaultMeta();
    write(K.meta, meta);
    return clone(meta);
  }

  const targets = Object.keys(MIGRATIONS)
    .map(Number)
    .filter((v) => v > meta.schemaVersion && v <= SCHEMA_VERSION)
    .sort((a, b) => a - b);

  for (const v of targets) {
    try {
      MIGRATIONS[v]();
      meta.schemaVersion = v;
    } catch (err) {
      console.error('[store] migration to v' + v + ' failed', err);
      toast('Data upgrade failed. Export a backup before continuing.');
      break;
    }
  }
  if (meta.schemaVersion < SCHEMA_VERSION) meta.schemaVersion = SCHEMA_VERSION;
  write(K.meta, meta);
  return clone(meta);
}

export function getMeta() {
  return clone(read(K.meta, defaultMeta()));
}

function patchMeta(patch) {
  const next = Object.assign(getMeta(), patch);
  write(K.meta, next);
  return next;
}

/* ------------------------------------------------------------------ settings */

/** Stored settings merged over DEFAULTS, so new defaults appear automatically. */
export function getSettings() {
  const stored = read(K.settings, {});
  return Object.assign({}, DEFAULTS, stored && typeof stored === 'object' ? stored : {});
}

/** Shallow-merge a patch into settings. Returns the merged settings. */
export function setSettings(patch) {
  const next = Object.assign({}, read(K.settings, {}), patch || {});
  write(K.settings, next);
  return getSettings();
}

/* ------------------------------------------------------------------ sessions */

/** Completed sessions, oldest first. */
export function getSessions() {
  const list = read(K.sessions, []);
  return Array.isArray(list) ? clone(list) : [];
}

/** Append one completed session. Returns the stored session (with id/endedAt). */
export function appendSession(session) {
  const list = read(K.sessions, []);
  const entry = Object.assign({}, session);
  if (!entry.id) entry.id = 's_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  if (!entry.endedAt) entry.endedAt = Date.now();
  if (!entry.date) entry.date = todayISO(new Date(entry.startedAt || entry.endedAt));
  const next = list.concat([entry]);
  next.sort((a, b) => (a.startedAt || a.endedAt || 0) - (b.startedAt || b.endedAt || 0));
  write(K.sessions, next);
  return clone(entry);
}

/* ------------------------------------------------------------- exerciseState */

/**
 * Per-exercise memory, keyed by exerciseId:
 *   { lastWeight, lastReps, lastSetCount, lastDoneAt, preferredSwap }
 */
export function getExerciseState() {
  const map = read(K.exerciseState, {});
  return clone(map && typeof map === 'object' && !Array.isArray(map) ? map : {});
}

/** Shallow-merge a patch into one exercise's state. Returns that entry. */
export function updateExerciseState(exerciseId, patch) {
  if (!exerciseId) return null;
  const map = read(K.exerciseState, {});
  const base = map && typeof map === 'object' && !Array.isArray(map) ? map : {};
  const entry = Object.assign({}, base[exerciseId], patch || {});
  const next = Object.assign({}, base, { [exerciseId]: entry });
  write(K.exerciseState, next);
  return clone(entry);
}

/* ------------------------------------------------------------ activeSession */

/** The in-progress workout, or null. The #/workout route is guarded on this. */
export function getActiveSession() {
  const s = read(K.activeSession, null);
  return s && typeof s === 'object' ? clone(s) : null;
}

export function setActiveSession(session) {
  if (!session) return clearActiveSession();
  write(K.activeSession, session);
  return clone(session);
}

export function clearActiveSession() {
  cache.set(K.activeSession, null);
  try {
    localStorage.removeItem(K.activeSession);
  } catch (err) {
    console.error('[store] could not clear active session', err);
  }
  return null;
}

/* -------------------------------------------------------------- bodyWeights */

/** [{ date: "YYYY-MM-DD", kg: Number }], oldest first. */
export function getBodyWeights() {
  const list = read(K.bodyWeights, []);
  return Array.isArray(list) ? clone(list) : [];
}

/** Append a weigh-in, replacing any existing entry for the same date. */
export function appendBodyWeight(entry) {
  if (!entry || typeof entry.kg !== 'number' || !isFinite(entry.kg)) return getBodyWeights();
  const date = entry.date || todayISO();
  const next = getBodyWeights().filter((e) => e.date !== date);
  next.push({ date, kg: entry.kg });
  next.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  write(K.bodyWeights, next);
  return clone(next);
}

/* ----------------------------------------------------------- export / import */

export const BACKUP_FORMAT = 'workout-tracker-backup';

function buildBackup() {
  return {
    format: BACKUP_FORMAT,
    schemaVersion: getMeta().schemaVersion || SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    settings: getSettings(),
    sessions: getSessions(),
    exerciseState: getExerciseState(),
    bodyWeights: getBodyWeights(),
  };
}

function downloadJSON(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke late: some Android browsers read the blob after the click returns.
  setTimeout(() => URL.revokeObjectURL(url), 20000);
}

/**
 * Build a backup object and hand it to the browser as a download.
 * Also stamps meta.lastExportAt so Settings can show "Last backup: N days ago".
 * @param {{silent?: boolean, filename?: string}} [opts]
 * @returns {object} the backup payload that was written
 */
export function exportBackup(opts = {}) {
  const payload = buildBackup();
  const name = opts.filename || `backbone-backup-${todayISO()}.json`;
  downloadJSON(payload, name);
  if (!opts.silent) patchMeta({ lastExportAt: Date.now() });
  return payload;
}

function readFileText(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || ''));
    fr.onerror = () => reject(new Error('Could not read that file.'));
    fr.readAsText(file);
  });
}

/**
 * Replace ALL app data with the contents of a backup file.
 * The caller is responsible for confirming with the user first; this function
 * does not ask. Before replacing, it auto-exports the current data as a safety
 * backup (named backbone-pre-import-…json) so a mistaken import is recoverable.
 *
 * @param {File} file
 * @returns {Promise<{sessionsBefore: number, sessionsAfter: number}>}
 */
export function importBackup(file) {
  return readFileText(file).then((text) => {
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('That file is not valid JSON.');
    }
    if (!data || typeof data !== 'object' || data.format !== BACKUP_FORMAT) {
      throw new Error('Not a Backbone backup file.');
    }
    if (typeof data.schemaVersion === 'number' && data.schemaVersion > SCHEMA_VERSION) {
      throw new Error('That backup was made by a newer version of Backbone.');
    }

    const sessionsBefore = getSessions().length;

    // Safety net: dump what we are about to overwrite.
    try {
      exportBackup({ silent: true, filename: `backbone-pre-import-${todayISO()}.json` });
    } catch (err) {
      console.warn('[store] safety backup failed', err);
    }

    const sessions = Array.isArray(data.sessions) ? data.sessions : [];
    const exerciseState =
      data.exerciseState && typeof data.exerciseState === 'object' && !Array.isArray(data.exerciseState)
        ? data.exerciseState
        : {};
    const bodyWeights = Array.isArray(data.bodyWeights) ? data.bodyWeights : [];
    const settings = data.settings && typeof data.settings === 'object' ? data.settings : {};

    write(K.settings, Object.assign({}, DEFAULTS, settings));
    write(K.sessions, sessions);
    write(K.exerciseState, exerciseState);
    write(K.bodyWeights, bodyWeights);
    clearActiveSession();
    patchMeta({
      schemaVersion: SCHEMA_VERSION,
      lastImportAt: Date.now(),
    });
    migrate();

    return { sessionsBefore, sessionsAfter: sessions.length };
  });
}

/* ------------------------------------------------------------------ helpers */

/** Exposed for views that need a local YYYY-MM-DD without re-implementing it. */
export { todayISO };
