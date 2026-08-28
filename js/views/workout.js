/**
 * workout.js — the guided session screen.
 *
 * Shape of the thing:
 *   sticky header (routine · variant · elapsed · Finish)
 *   → one .section-title + card stack per block
 *   → the current card is expanded, the rest collapsed, any card re-openable
 *     (free order: people skip around, and fighting that costs more than it
 *     saves)
 *
 * Rendering strategy: the DOM is built once in mount(), and every mutation
 * re-renders only the affected card via cards.get(uid).render(). Live timers
 * repaint through direct node queries (paintTimer/paintSeq) so a running rest
 * ring is never torn out from under itself, and a full card re-render redraws
 * the timer region from the timer object's own live state.
 *
 * Crash-proofing: setActiveSession() is called after EVERY mutation. Closing
 * the tab mid-set loses at most the un-logged stepper draft.
 */

import { el, showToast, openSheet, closeSheet, navigate } from '../app.js';
import * as store from '../store.js';
import * as wakelock from '../wakelock.js';
import * as cues from '../cues.js';
import { createCountdown, createSequence } from '../timer.js';

// The supervisor wires this into index.html / PRECACHE later; until then the
// view carries its own stylesheet so it is never unstyled.
if (typeof document !== 'undefined' && !document.querySelector('link[href="./css/workout.css"]')) {
  document.head.append(
    Object.assign(document.createElement('link'), { rel: 'stylesheet', href: './css/workout.css' })
  );
}

/* ------------------------------------------------------------------ state */

let rootEl = null;
let session = null;
let settings = null;

let cards = new Map();      // uid -> { item, block, el, render }
let drafts = new Map();     // uid -> stepper/chip state not yet committed
let timers = new Map();     // uid -> { kind, t, snap, side, holdIdx }
let seqRecs = [];           // one record per all-stretch block

let expandedUid = null;
let activeCueUid = null;    // what .pulse should flash: uid, or 'seq:<n>'
let elapsedEl = null;
let elapsedId = null;
let mounted = false;

const LB_PER_KG = 2.2046;

/* ---------------------------------------------------------------- planner */

// planner.js is written by a parallel agent and may not exist yet, so the
// import is lazy and failure-tolerant. Swap falls back to the alternative ids
// the planner already baked into each item.
let plannerPromise = null;
function loadPlanner() {
  if (!plannerPromise) {
    plannerPromise = import('../planner.js').catch((err) => {
      console.warn('[workout] planner.js unavailable', err && err.message);
      return null;
    });
  }
  return plannerPromise;
}

/* ---------------------------------------------------------------- helpers */

function persist() {
  store.setActiveSession(session);
}

function itemByUid(uid) {
  for (const block of session.blocks || []) {
    for (const item of block.items || []) if (item.uid === uid) return item;
  }
  return null;
}

function entryOf(uid) {
  return (session.entries && session.entries[uid]) || null;
}

/** How many sets/holds count as "all of them" for this item. */
function targetSets(item) {
  const n = Math.max(1, Number(item.sets) || 1);
  return item.measure === 'hold' && item.perSide ? n * 2 : n;
}

function statusOf(item) {
  const e = entryOf(item.uid);
  if (!e) return 'todo';
  if (e.skipped) return 'skipped';
  if (e.completed) return 'done';
  if (e.type === 'cardio') return 'done';
  if (Array.isArray(e.sets) && e.sets.length) {
    return e.sets.length >= targetSets(item) ? 'done' : 'partial';
  }
  return 'todo';
}

function isStretchBlock(block) {
  const items = block.items || [];
  return items.length >= 2 && items.every((i) => i.type === 'stretch');
}

/* ---- units -------------------------------------------------------------- */

function displayWeight(kg) {
  if (kg === null || kg === undefined || !isFinite(kg)) return null;
  const v = settings.weightUnit === 'lb' ? kg * LB_PER_KG : kg;
  return Math.round(v * 2) / 2; // nearest 0.5 in whichever unit is shown
}

function unitLabel() {
  return settings.weightUnit === 'lb' ? 'lb' : 'kg';
}

function fmtWeight(kg) {
  const v = displayWeight(kg);
  return v === null ? null : `${v} ${unitLabel()}`;
}

/* ---- time --------------------------------------------------------------- */

function mmss(sec) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function elapsedText(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

function titleize(id) {
  return String(id || '')
    .replace(/[-_]+/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

/* ---- small builders ----------------------------------------------------- */

function stepper(value, onDelta, opts = {}) {
  return el('div', { class: 'stepper' }, [
    el(
      'button',
      { type: 'button', 'aria-label': opts.decLabel || 'Decrease', disabled: opts.decDisabled || null,
        onclick: () => onDelta(-1) },
      ['−']
    ),
    el('span', { class: 'stepper-value num' }, [String(value)]),
    el(
      'button',
      { type: 'button', 'aria-label': opts.incLabel || 'Increase', disabled: opts.incDisabled || null,
        onclick: () => onDelta(1) },
      ['+']
    ),
  ]);
}

/** pctLeft counts 100 → 0, so the ring drains as time runs out. */
function ringEl(valueText, labelText, pctLeft) {
  return el('div', { class: 'progress-ring', 'data-ring': '', style: `--ring-pct:${pctLeft}` }, [
    el('div', { class: 'progress-ring-value', 'data-timer-value': '' }, [valueText]),
    el('div', { class: 'progress-ring-label' }, [labelText]),
  ]);
}

function labelledField(label, control) {
  return el('div', { class: 'wo-adjust-field' }, [
    el('span', { class: 'wo-adjust-label' }, [label]),
    control,
  ]);
}

/* ---------------------------------------------------------------- header */

function buildHeader() {
  elapsedEl = el('div', { class: 'wo-elapsed' }, [elapsedText(Date.now() - (session.startedAt || Date.now()))]);

  return el('header', { class: 'wo-header' }, [
    el('div', { class: 'wo-header-main' }, [
      el('div', { class: 'wo-header-title' }, [
        el('span', { class: 'wo-header-name' }, [session.routineName || 'Workout']),
        session.dayLabel ? el('span', { class: 'badge' }, ['Day ' + session.dayLabel]) : null,
        session.variant === 'pain' ? el('span', { class: 'badge badge--pain' }, ['Pain day']) : null,
      ]),
      elapsedEl,
    ]),
    el('button', { class: 'btn btn--sm', type: 'button', onclick: openFinishSheet }, ['Finish']),
  ]);
}

function tickElapsed() {
  if (elapsedEl && elapsedEl.isConnected) {
    elapsedEl.textContent = elapsedText(Date.now() - (session.startedAt || Date.now()));
  }
}

/* ------------------------------------------------------------ expand/scroll */

function toggleCard(uid) {
  const prev = expandedUid;
  expandedUid = prev === uid ? null : uid;
  if (prev && prev !== uid) renderCard(prev);
  renderCard(uid);
  if (expandedUid === uid) {
    const rec = cards.get(uid);
    rec?.el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
}

/** After finishing an exercise, open the next one that still needs doing. */
function advanceFrom(uid) {
  const order = [...cards.keys()];
  const start = order.indexOf(uid);
  for (let i = start + 1; i < order.length; i++) {
    const next = cards.get(order[i]);
    const s = statusOf(next.item);
    if (s === 'todo' || s === 'partial') {
      const prev = expandedUid;
      expandedUid = order[i];
      if (prev) renderCard(prev);
      renderCard(order[i]);
      next.el.scrollIntoView({ block: 'start', behavior: 'smooth' });
      return;
    }
  }
  // Nothing left to open — collapse and let the header's Finish button lead.
  if (expandedUid) {
    const prev = expandedUid;
    expandedUid = null;
    renderCard(prev);
  }
}

function renderCard(uid) {
  const rec = cards.get(uid);
  if (rec) rec.render();
}

/* ------------------------------------------------------------------ timers */

function stopTimer(uid) {
  const rec = timers.get(uid);
  if (rec) {
    try {
      rec.t.cancel();
    } catch {
      /* already gone */
    }
    timers.delete(uid);
  }
  if (activeCueUid === uid) activeCueUid = null;
}

/** Cheap repaint of a running timer — no card rebuild, no scroll jump. */
function paintTimer(uid) {
  const rec = timers.get(uid);
  const card = cards.get(uid);
  if (!rec || !card || !card.el.isConnected) return;
  const snap = rec.snap;
  if (!snap) return;
  const value = card.el.querySelector('[data-timer-value]');
  const ring = card.el.querySelector('[data-ring]');
  if (value) value.textContent = mmss(snap.remainingSec);
  if (ring) ring.style.setProperty('--ring-pct', String(100 - snap.pct));
}

function startCountdownFor(uid, kind, seconds, onDone, extra = {}) {
  stopTimer(uid);
  const secs = Math.max(0, Number(seconds) || 0);
  if (!secs) {
    onDone();
    return;
  }
  const rec = Object.assign({ kind, t: null, snap: null }, extra);
  rec.t = createCountdown({
    seconds: secs,
    onTick: (snap) => {
      rec.snap = snap;
      paintTimer(uid);
    },
    onDone: () => {
      rec.snap = { remainingMs: 0, remainingSec: 0, pct: 100 };
      onDone();
    },
  });
  timers.set(uid, rec);
  activeCueUid = uid;
  rec.t.start();
}

/**
 * The shared timer panel (rest, hold, cardio). Reads live state off the timer
 * object so a card re-render mid-countdown redraws it exactly where it was.
 */
function timerPanel(uid, { label, doneLabel, onDismiss, extraAction }) {
  const rec = timers.get(uid);
  if (!rec) return null;
  const state = rec.t.state;
  if (state === 'cancelled') return null;

  const snap = rec.snap || { remainingSec: Math.ceil(rec.t.getRemaining() / 1000), pct: 0 };
  const isDone = state === 'done';
  const paused = state === 'paused';

  const actions = [];
  if (!isDone) {
    actions.push(
      el(
        'button',
        { class: 'btn btn--ghost btn--sm', type: 'button',
          onclick: () => {
            if (paused) rec.t.resume();
            else rec.t.pause();
            renderCard(uid);
          } },
        [paused ? 'Resume' : 'Pause']
      )
    );
  }
  if (extraAction) actions.push(extraAction(rec));
  actions.push(
    el(
      'button',
      { class: 'btn btn--ghost btn--sm', type: 'button', onclick: () => onDismiss(rec) },
      [isDone ? 'Dismiss' : label === 'Rest' ? 'Skip rest' : 'Stop']
    )
  );

  return el('div', { class: 'wo-timer' }, [
    ringEl(mmss(snap.remainingSec), isDone ? doneLabel : paused ? 'Paused' : label, 100 - snap.pct),
    el('div', { class: 'wo-timer-actions' }, actions),
  ]);
}

/* ---------------------------------------------------------------- warm-up */

function doseText(item) {
  const bits = [];
  if (item.measure === 'hold' || (item.holdSec && !item.reps)) {
    if (item.holdSec) bits.push(`${item.holdSec}s`);
  } else if (item.reps) {
    bits.push(`×${item.reps}`);
  }
  if (item.perSide) bits.push('per side');
  return bits.join(' ');
}

function renderWarmupBody(item) {
  const done = statusOf(item) === 'done';
  // No dose line here: the collapsed meta line already carries "×8 per side",
  // and repeating it two rows apart just reads as a bug.
  const nodes = [];
  if (item.cues) nodes.push(el('div', { class: 'wo-cues' }, [item.cues]));

  nodes.push(
    el('div', { class: 'wo-actions' }, [
      done
        ? el('button', { class: 'btn btn--ghost btn--block', type: 'button',
            onclick: () => { delete session.entries[item.uid]; persist(); renderCard(item.uid); } },
            ['Undo'])
        : el('button', { class: 'btn btn--block', type: 'button',
            onclick: () => {
              session.entries[item.uid] = {
                exerciseId: item.exerciseId, name: item.name,
                swappedFrom: item.swappedFrom || null,
                type: 'warmup', completed: true, skipped: false,
              };
              persist();
              renderCard(item.uid);
              advanceFrom(item.uid);
            } },
            ['Done ✓']),
    ])
  );
  return nodes;
}

/* --------------------------------------------------- strength / core (reps) */

function repsDraft(item) {
  if (!drafts.has(item.uid)) {
    const logged = entryOf(item.uid)?.sets || [];
    const last = logged[logged.length - 1];
    drafts.set(item.uid, {
      weight: last ? last.weight : item.weight ?? null,
      reps: last ? last.reps : Number(item.reps) || 10,
    });
  }
  return drafts.get(item.uid);
}

function logSet(item) {
  const d = repsDraft(item);
  const prev = entryOf(item.uid);
  const sets = (prev && Array.isArray(prev.sets) ? prev.sets : []).concat([
    { weight: d.weight, reps: d.reps, at: Date.now() },
  ]);
  session.entries[item.uid] = {
    exerciseId: item.exerciseId,
    name: item.name,
    swappedFrom: item.swappedFrom || null,
    type: item.type,
    sets,
    skipped: false,
  };
  persist();

  // Live memory, so a crash mid-session still improves tomorrow's prefill.
  store.updateExerciseState(item.exerciseId, {
    lastWeight: d.weight,
    lastReps: d.reps,
    lastSetCount: sets.length,
    lastDoneAt: Date.now(),
  });

  const finished = sets.length >= targetSets(item);
  if (!finished) startRest(item.uid);
  else stopTimer(item.uid);
  renderCard(item.uid);
  if (finished) advanceFrom(item.uid);
}

function startRest(uid) {
  startCountdownFor(uid, 'rest', settings.restTimerSec, () => {
    cues.cue('rest-done');
    renderCard(uid);
  });
  renderCard(uid);
}

function setRowText(item, weightKg, reps) {
  const w = fmtWeight(weightKg);
  return w ? `${w} × ${reps}` : `${reps} reps`;
}

function renderRepsBody(item) {
  const nodes = [];
  if (item.notice) nodes.push(el('div', { class: 'wo-notice' }, [item.notice]));
  if (item.cues) nodes.push(el('div', { class: 'wo-cues' }, [item.cues]));

  const entry = entryOf(item.uid);
  const logged = entry && Array.isArray(entry.sets) ? entry.sets : [];
  const d = repsDraft(item);
  const rows = [];
  const total = Math.max(targetSets(item), logged.length + (logged.length >= targetSets(item) ? 0 : 1));

  for (let i = 0; i < total; i++) {
    const isLogged = i < logged.length;
    const isNext = i === logged.length;
    const s = isLogged ? logged[i] : null;
    rows.push(
      el(
        'div',
        { class: 'wo-set-row ' + (isLogged ? 'is-logged' : isNext ? 'is-next' : 'is-pending') },
        [
          el('span', { class: 'wo-set-num' }, ['Set ' + (i + 1)]),
          el('span', { class: 'wo-set-val' }, [
            isLogged ? setRowText(item, s.weight, s.reps) : setRowText(item, d.weight, d.reps),
          ]),
          isLogged && i === logged.length - 1
            ? el('button', { class: 'wo-set-undo', type: 'button', onclick: () => undoSet(item) }, ['Undo'])
            : isLogged
            ? el('span', { class: 'wo-set-tick' }, ['✓'])
            : null,
        ]
      )
    );
  }
  nodes.push(el('div', { class: 'wo-setlist' }, rows));

  // Steppers adjust the NEXT unlogged set only — logged sets are history.
  const fields = [];
  if (d.weight !== null && d.weight !== undefined) {
    const step = Number(item.weightStep) || 2.5;
    fields.push(
      labelledField(
        'Weight',
        stepper(fmtWeight(d.weight), (dir) => {
          d.weight = Math.max(0, Math.round((d.weight + dir * step) * 100) / 100);
          renderCard(item.uid);
        }, { decDisabled: d.weight <= 0, decLabel: 'Less weight', incLabel: 'More weight' })
      )
    );
  }
  fields.push(
    labelledField(
      'Reps',
      stepper(d.reps, (dir) => {
        d.reps = Math.max(1, d.reps + dir);
        renderCard(item.uid);
      }, { decDisabled: d.reps <= 1, decLabel: 'Fewer reps', incLabel: 'More reps' })
    )
  );
  nodes.push(el('div', { class: 'wo-adjust' }, fields));

  const complete = logged.length >= targetSets(item);
  nodes.push(
    el('div', { class: 'wo-actions' }, [
      el('button', { class: 'btn', type: 'button', onclick: () => logSet(item) }, [
        complete ? 'Log extra set ✓' : 'Log set ✓',
      ]),
    ])
  );

  const panel = timerPanel(item.uid, {
    label: 'Rest',
    doneLabel: 'Rest done',
    onDismiss: () => {
      stopTimer(item.uid);
      renderCard(item.uid);
    },
    extraAction: (rec) =>
      el('button', { class: 'btn btn--ghost btn--sm', type: 'button',
        onclick: () => { rec.t.addSeconds(30); paintTimer(item.uid); renderCard(item.uid); } },
        ['+30s']),
  });
  if (panel) nodes.push(panel);

  return nodes;
}

function undoSet(item) {
  const entry = entryOf(item.uid);
  if (!entry || !Array.isArray(entry.sets) || !entry.sets.length) return;
  entry.sets = entry.sets.slice(0, -1);
  if (!entry.sets.length) delete session.entries[item.uid];
  else session.entries[item.uid] = entry;
  persist();
  stopTimer(item.uid);
  renderCard(item.uid);
}

/* --------------------------------------------------- hold (core / stretch) */

function sideForHold(item, idx) {
  if (!item.perSide) return null;
  return idx % 2 === 0 ? 'Left' : 'Right';
}

function startHold(item) {
  const idx = (entryOf(item.uid)?.sets || []).length;
  const secs = Number(item.holdSec) || 30;
  startCountdownFor(
    item.uid,
    'hold',
    secs,
    () => {
      cues.cue('hold-done');
      const prev = entryOf(item.uid);
      const sets = (prev && Array.isArray(prev.sets) ? prev.sets : []).concat([
        Object.assign({ holdSec: secs, at: Date.now() }, item.perSide ? { side: sideForHold(item, idx) } : {}),
      ]);
      session.entries[item.uid] = {
        exerciseId: item.exerciseId,
        name: item.name,
        swappedFrom: item.swappedFrom || null,
        type: item.type,
        sets,
        skipped: false,
      };
      persist();
      store.updateExerciseState(item.exerciseId, {
        lastSetCount: sets.length,
        lastDoneAt: Date.now(),
      });
      stopTimer(item.uid);
      renderCard(item.uid);
      if (sets.length >= targetSets(item)) advanceFrom(item.uid);
    },
    { holdIdx: idx }
  );
  renderCard(item.uid);
}

function renderHoldBody(item) {
  const nodes = [];
  if (item.notice) nodes.push(el('div', { class: 'wo-notice' }, [item.notice]));
  if (item.cues) nodes.push(el('div', { class: 'wo-cues' }, [item.cues]));

  const logged = entryOf(item.uid)?.sets || [];
  const total = Math.max(targetSets(item), logged.length);
  const rows = [];
  for (let i = 0; i < total; i++) {
    const isLogged = i < logged.length;
    const isNext = i === logged.length;
    const side = sideForHold(item, i);
    rows.push(
      el('div', { class: 'wo-set-row ' + (isLogged ? 'is-logged' : isNext ? 'is-next' : 'is-pending') }, [
        el('span', { class: 'wo-set-num' }, [side || 'Hold ' + (i + 1)]),
        el('span', { class: 'wo-set-val' }, [
          `${isLogged ? logged[i].holdSec : Number(item.holdSec) || 30}s`,
        ]),
        isLogged
          ? i === logged.length - 1
            ? el('button', { class: 'wo-set-undo', type: 'button', onclick: () => undoSet(item) }, ['Undo'])
            : el('span', { class: 'wo-set-tick' }, ['✓'])
          : null,
      ])
    );
  }
  nodes.push(el('div', { class: 'wo-setlist' }, rows));

  const running = timers.has(item.uid);
  if (!running) {
    const nextSide = sideForHold(item, logged.length);
    nodes.push(
      el('div', { class: 'wo-actions' }, [
        el('button', { class: 'btn', type: 'button', onclick: () => startHold(item) }, [
          logged.length >= targetSets(item)
            ? 'Extra hold ▶'
            : nextSide
            ? `Start ${nextSide.toLowerCase()} ▶`
            : 'Start hold ▶',
        ]),
      ])
    );
  }

  const panel = timerPanel(item.uid, {
    label: sideForHold(item, logged.length) || 'Hold',
    doneLabel: 'Hold done',
    onDismiss: () => {
      stopTimer(item.uid);
      renderCard(item.uid);
    },
  });
  if (panel) nodes.push(panel);

  return nodes;
}

/* ----------------------------------------------------------------- cardio */

const INTENSITY_LABELS = { easy: 'Easy', moderate: 'Moderate', intervals: 'Intervals', hard: 'Hard' };

function cardioDraft(item) {
  if (!drafts.has(item.uid)) {
    const e = entryOf(item.uid);
    drafts.set(item.uid, {
      durationMin: (e && e.durationMin) || Number(item.durationMin) || 20,
      intensity: (e && e.intensity) || (item.intensities && item.intensities[0]) || null,
      kcal: e && typeof e.kcal === 'number' ? e.kcal : null,
    });
  }
  return drafts.get(item.uid);
}

function renderCardioBody(item) {
  const nodes = [];
  if (item.notice) nodes.push(el('div', { class: 'wo-notice' }, [item.notice]));
  if (item.cues) nodes.push(el('div', { class: 'wo-cues' }, [item.cues]));

  const d = cardioDraft(item);

  nodes.push(
    el('div', { class: 'wo-adjust' }, [
      labelledField(
        'Duration',
        stepper(`${d.durationMin} min`, (dir) => {
          d.durationMin = Math.max(5, d.durationMin + dir * 5);
          renderCard(item.uid);
        }, { decDisabled: d.durationMin <= 5, decLabel: 'Less time', incLabel: 'More time' })
      ),
    ])
  );

  const options = item.intensities && item.intensities.length
    ? item.intensities
    : ['easy', 'moderate', 'intervals', 'hard'];
  nodes.push(
    el('div', { class: 'wo-field' }, [
      el('span', { class: 'wo-field-label' }, ['Intensity']),
      el(
        'div',
        { class: 'chip-row' },
        options.map((opt) =>
          el('button', { class: 'chip', type: 'button', 'aria-pressed': d.intensity === opt ? 'true' : 'false',
            onclick: () => { d.intensity = d.intensity === opt ? null : opt; renderCard(item.uid); } },
            [INTENSITY_LABELS[opt] || titleize(opt)])
        )
      ),
    ])
  );

  const kcalInput = el('input', {
    class: 'wo-input', type: 'number', inputmode: 'numeric', min: '0', step: '10',
    placeholder: 'Calories (optional)',
  });
  if (d.kcal !== null && d.kcal !== undefined) kcalInput.value = String(d.kcal);
  kcalInput.addEventListener('input', () => {
    const v = parseInt(kcalInput.value, 10);
    d.kcal = Number.isFinite(v) && v >= 0 ? v : null;
  });
  nodes.push(el('div', { class: 'wo-field' }, [el('span', { class: 'wo-field-label' }, ['Calories']), kcalInput]));

  const running = timers.has(item.uid);
  const done = statusOf(item) === 'done';

  const actions = [];
  if (!running) {
    actions.push(
      el('button', { class: 'btn btn--ghost', type: 'button',
        onclick: () => {
          // Purely for company — the wall clock keeps it honest in the
          // background, and finishing early or late is still just "Done".
          startCountdownFor(item.uid, 'cardio', d.durationMin * 60, () => {
            cues.cue('hold-done');
            renderCard(item.uid);
          });
          renderCard(item.uid);
        } },
        ['Start timer ▶'])
    );
  }
  actions.push(
    done
      ? el('button', { class: 'btn btn--ghost', type: 'button',
          onclick: () => { delete session.entries[item.uid]; persist(); renderCard(item.uid); } },
          ['Undo'])
      : el('button', { class: 'btn', type: 'button',
          onclick: () => {
            session.entries[item.uid] = {
              exerciseId: item.exerciseId, name: item.name,
              swappedFrom: item.swappedFrom || null,
              type: 'cardio',
              durationMin: d.durationMin,
              intensity: d.intensity,
              kcal: d.kcal,
              skipped: false,
            };
            persist();
            stopTimer(item.uid);
            renderCard(item.uid);
            advanceFrom(item.uid);
          } },
          ['Done ✓'])
  );
  nodes.push(el('div', { class: 'wo-actions' }, actions));

  const panel = timerPanel(item.uid, {
    label: 'Cardio',
    doneLabel: 'Time’s up',
    onDismiss: () => { stopTimer(item.uid); renderCard(item.uid); },
    extraAction: (rec) =>
      el('button', { class: 'btn btn--ghost btn--sm', type: 'button',
        onclick: () => { rec.t.addSeconds(300); paintTimer(item.uid); renderCard(item.uid); } },
        ['+5 min']),
  });
  if (panel) nodes.push(panel);

  return nodes;
}

/* ------------------------------------------------------------------- cards */

function metaLine(item) {
  const status = statusOf(item);
  const entry = entryOf(item.uid);
  if (status === 'skipped') return 'Skipped';

  if (item.type === 'warmup') return doseText(item) || 'Movement prep';

  if (item.type === 'cardio') {
    if (status === 'done' && entry) {
      const bits = [`${entry.durationMin} min`];
      if (entry.intensity) bits.push(INTENSITY_LABELS[entry.intensity] || titleize(entry.intensity));
      if (entry.kcal) bits.push(`${entry.kcal} kcal`);
      return bits.join(' · ');
    }
    return `${Number(item.durationMin) || 20} min`;
  }

  const logged = (entry && entry.sets) || [];
  if (logged.length) return `${logged.length}/${targetSets(item)} logged`;

  if (item.measure === 'hold' || item.type === 'stretch') {
    return `${item.sets && item.sets > 1 ? item.sets + ' × ' : ''}${Number(item.holdSec) || 30}s${
      item.perSide ? ' per side' : ''
    }`;
  }
  const w = fmtWeight(item.weight);
  return `${item.sets || 3} × ${item.reps || 10}${w ? ' · ' + w : ''}`;
}

function bodyFor(item) {
  if (item.type === 'warmup') return renderWarmupBody(item);
  if (item.type === 'cardio') return renderCardioBody(item);
  if (item.measure === 'hold' || item.type === 'stretch') return renderHoldBody(item);
  return renderRepsBody(item);
}

function buildCard(item, block) {
  const cardEl = el('section', { class: 'card wo-card', dataset: { uid: item.uid } });
  const headEl = el('button', { class: 'wo-card-head', type: 'button', onclick: () => toggleCard(item.uid) });
  const moreEl = el('button', {
    class: 'wo-more', type: 'button', 'aria-label': 'More options',
    onclick: () => openMoreSheet(item.uid),
  }, ['⋯']);
  const bodyEl = el('div', { class: 'wo-card-body' });
  cardEl.append(el('div', { class: 'wo-card-bar' }, [headEl, moreEl]), bodyEl);

  function render() {
    const status = statusOf(item);
    const open = expandedUid === item.uid;
    cardEl.classList.toggle('is-done', status === 'done');
    cardEl.classList.toggle('is-skipped', status === 'skipped');
    cardEl.dataset.open = open ? 'true' : 'false';

    headEl.setAttribute('aria-expanded', open ? 'true' : 'false');
    headEl.replaceChildren(
      el('span', { class: 'wo-card-check' }, [status === 'done' ? '✓' : status === 'skipped' ? '–' : '']),
      el('span', { class: 'wo-card-main' }, [
        el('span', { class: 'wo-card-name' }, [item.name || titleize(item.exerciseId)]),
        el('span', { class: 'wo-card-meta' }, [metaLine(item)]),
      ]),
      el('span', { class: 'wo-card-end' }, [
        item.swappedFrom ? el('span', { class: 'badge' }, ['Swapped']) : null,
        item.axialLoading ? el('span', { class: 'badge badge--pain' }, ['Axial']) : null,
        el('span', { class: 'wo-chev', 'aria-hidden': 'true' }, ['▾']),
      ])
    );

    bodyEl.replaceChildren(...(open ? bodyFor(item) : []));
  }

  return { item, block, el: cardEl, render };
}

/* ------------------------------------------------- stretch sequence player */

/**
 * A stretch measured in reps (cat-camel ×8) still gets a timed slot in the
 * player, but calling it "30s" hides the actual instruction. Show the dose it
 * was written with.
 */
function stretchDose(item) {
  if (item.measure === 'reps' && item.reps) return `×${item.reps}`;
  return `${Number(item.holdSec) || 30}s`;
}

function buildSequenceSteps(block) {
  const steps = [];
  const transSec = Math.max(0, Number(settings.stretchTransitionSec) || 0);
  (block.items || []).forEach((item, itemIndex) => {
    const sides = item.perSide ? ['Left side', 'Right side'] : [null];
    sides.forEach((side) => {
      if (steps.length && transSec > 0) {
        steps.push({
          label: 'Switch',
          seconds: transSec,
          kind: 'transition',
          meta: { uid: item.uid, side, itemIndex },
        });
      }
      steps.push({
        label: item.name || titleize(item.exerciseId),
        seconds: Number(item.holdSec) || 30,
        kind: 'hold',
        meta: { uid: item.uid, side, itemIndex },
      });
    });
  });
  return steps;
}

/** Write the stretch entries for every item whose last hold is behind us. */
function markSeqProgress(rec, uptoIndex) {
  let changed = false;
  (rec.block.items || []).forEach((item) => {
    let last = -1;
    rec.steps.forEach((s, i) => {
      if (s.kind === 'hold' && s.meta.uid === item.uid) last = i;
    });
    if (last >= 0 && last < uptoIndex && !session.entries[item.uid]) {
      session.entries[item.uid] = {
        exerciseId: item.exerciseId,
        name: item.name,
        swappedFrom: item.swappedFrom || null,
        type: 'stretch',
        completed: true,
        skipped: false,
      };
      changed = true;
    }
  });
  if (changed) persist();
}

function paintSeq(rec) {
  if (!rec.cardEl.isConnected || !rec.snap) return;
  const value = rec.cardEl.querySelector('[data-timer-value]');
  const ring = rec.cardEl.querySelector('[data-ring]');
  if (value) value.textContent = mmss(rec.snap.remainingSec);
  if (ring) ring.style.setProperty('--ring-pct', String(100 - rec.snap.pct));
}

function nextHoldAfter(rec, index) {
  for (let i = index + 1; i < rec.steps.length; i++) if (rec.steps[i].kind === 'hold') return rec.steps[i];
  return null;
}

function startSequence(rec) {
  if (rec.player) {
    try {
      rec.player.cancel();
    } catch {
      /* noop */
    }
  }
  rec.done = false;
  rec.player = createSequence({
    steps: rec.steps,
    onTick: (snap) => {
      rec.snap = snap;
      if (snap.remainingSec === 3 && !rec.countdownFired) {
        rec.countdownFired = true;
        cues.cue('countdown');
      }
      paintSeq(rec);
    },
    onStepChange: ({ index, catchUp }) => {
      rec.index = index;
      rec.countdownFired = false;
      markSeqProgress(rec, index);
      // catchUp steps elapsed while the tab was hidden — beeping once per
      // skipped step on wake would be a machine-gun. Only the landing step cues.
      if (index > 0 && !catchUp) cues.cue('transition');
      renderSeq(rec);
    },
    onDone: () => {
      rec.done = true;
      markSeqProgress(rec, rec.steps.length);
      cues.cue('hold-done');
      renderSeq(rec);
    },
  });
  activeCueUid = 'seq:' + rec.seqIndex;
  rec.player.start();
  renderSeq(rec);
}

function renderSeq(rec) {
  const nodes = [];
  const total = rec.steps.filter((s) => s.kind === 'hold').length;
  const items = rec.block.items || [];

  if (!rec.player || rec.done) {
    const totalSec = rec.steps.reduce((a, s) => a + s.seconds, 0);
    nodes.push(
      el('div', { class: 'wo-seq-step' }, [rec.done ? 'Complete' : 'Guided stretch routine']),
      el('div', { class: 'wo-seq-name' }, [
        rec.done ? 'Nicely done ✓' : `${items.length} stretches`,
      ]),
      el('div', { class: 'wo-seq-cues' }, [
        rec.done
          ? 'All logged. You can run it again if you want more.'
          : `About ${Math.round(totalSec / 60)} min, ${total} holds. It advances on its own — just follow along.`,
      ]),
      el('div', { class: 'wo-seq-actions' }, [
        el('button', { class: rec.done ? 'btn btn--ghost' : 'btn', type: 'button', onclick: () => startSequence(rec) }, [
          rec.done ? 'Run it again' : 'Start stretches ▶',
        ]),
      ])
    );
  } else {
    const step = rec.steps[rec.index] || rec.steps[0];
    const snap = rec.snap || { remainingSec: step.seconds, pct: 0 };
    const holdNumber = rec.steps.slice(0, rec.index + 1).filter((s) => s.kind === 'hold').length;
    const upcoming = nextHoldAfter(rec, rec.index);
    const paused = rec.player.state === 'paused';

    nodes.push(
      ringEl(mmss(snap.remainingSec), step.kind === 'transition' ? 'Switch' : paused ? 'Paused' : 'Hold', 100 - snap.pct),
      el('div', { class: 'wo-seq-step' }, [`Stretch ${Math.max(1, holdNumber)} of ${total}`]),
      el('div', { class: 'wo-seq-name' }, [
        step.kind === 'transition' ? 'Get into position' : step.label,
        step.kind === 'hold' && step.meta.side
          ? el('span', { class: 'wo-seq-side' }, [' · ' + step.meta.side])
          : null,
      ])
    );

    const cur = items.find((i) => i.uid === step.meta.uid);
    if (cur && cur.measure === 'reps' && cur.reps) {
      nodes.push(el('div', { class: 'wo-seq-dose num' }, [`${cur.reps} slow reps, at your own pace`]));
    }
    if (cur && cur.cues) nodes.push(el('div', { class: 'wo-seq-cues' }, [cur.cues]));
    nodes.push(
      el('div', { class: 'wo-seq-next' }, [upcoming ? 'Next: ' + upcoming.label : 'Last one — finish strong.'])
    );

    nodes.push(
      el('div', { class: 'wo-seq-actions' }, [
        el('button', { class: 'btn btn--ghost', type: 'button',
          onclick: () => {
            if (paused) rec.player.resume();
            else rec.player.pause();
            renderSeq(rec);
          } },
          [paused ? 'Resume' : 'Pause']),
        el('button', { class: 'btn btn--ghost', type: 'button',
          onclick: () => {
            // Skipping onto a 15s "switch" step is not what anyone means by
            // "skip this stretch", so hop the transition too.
            rec.player.skipStep();
            if (rec.steps[rec.player.getIndex()]?.kind === 'transition') rec.player.skipStep();
          } },
          ['Skip stretch']),
      ])
    );
  }

  // Always show the running order so people can see where they are.
  nodes.push(
    el(
      'div',
      { class: 'wo-seq-list' },
      items.map((item) => {
        let lastIdx = -1;
        rec.steps.forEach((s, i) => {
          if (s.kind === 'hold' && s.meta.uid === item.uid) lastIdx = i;
        });
        const isDone = !!session.entries[item.uid];
        const isCurrent = rec.player && !rec.done && rec.steps[rec.index]?.meta.uid === item.uid;
        return el('div', { class: 'wo-seq-item' + (isCurrent ? ' is-current' : isDone ? ' is-done' : '') }, [
          el('span', { class: 'wo-seq-item-mark' }, [isDone ? '✓' : isCurrent ? '▸' : '']),
          el('span', {}, [
            (item.name || titleize(item.exerciseId)) +
              (item.perSide ? ' · both sides' : '') +
              ' · ' +
              stretchDose(item),
          ]),
        ]);
      })
    )
  );

  rec.cardEl.replaceChildren(...nodes);
}

/* ------------------------------------------------------------------ sheets */

function openMoreSheet(uid) {
  const item = itemByUid(uid);
  if (!item) return;
  const skipped = statusOf(item) === 'skipped';

  openSheet(
    el('div', {}, [
      el('div', { class: 'sheet-title' }, [item.name || titleize(item.exerciseId)]),
      el('div', { class: 'card card--flush' }, [
        el('button', { class: 'list-row', type: 'button',
          onclick: () => { closeSheet(); openSwapSheet(uid); } },
          [
            el('div', { class: 'list-row-main' }, [
              el('div', { class: 'list-row-title' }, ['Swap exercise']),
              el('div', { class: 'list-row-sub' }, ['Pick a back-safe alternative']),
            ]),
            el('div', { class: 'list-row-end' }, ['›']),
          ]),
        el('button', { class: 'list-row', type: 'button',
          onclick: () => { closeSheet(); toggleSkip(uid); } },
          [
            el('div', { class: 'list-row-main' }, [
              el('div', { class: 'list-row-title' }, [skipped ? 'Put it back' : 'Skip this one']),
              el('div', { class: 'list-row-sub' }, [
                skipped ? 'Back into the session' : 'No explanation needed',
              ]),
            ]),
          ]),
      ]),
    ])
  );
}

function toggleSkip(uid) {
  const item = itemByUid(uid);
  if (!item) return;
  if (statusOf(item) === 'skipped') {
    delete session.entries[uid];
    persist();
    renderCard(uid);
    showToast('Back in.');
    return;
  }
  stopTimer(uid);
  session.entries[uid] = {
    exerciseId: item.exerciseId,
    name: item.name,
    swappedFrom: item.swappedFrom || null,
    type: item.type,
    skipped: true,
  };
  persist();
  renderCard(uid);
  showToast('Skipped — no problem.');
  advanceFrom(uid);
}

async function alternativesFor(item) {
  const origId = item.swappedFrom || item.exerciseId;
  const mod = await loadPlanner();
  const out = [];
  const seen = new Set([item.exerciseId]);

  if (mod && typeof mod.getAlternatives === 'function') {
    // Query both the current exercise and the original, so a swapped card can
    // always find its way back home.
    for (const id of new Set([item.exerciseId, origId])) {
      try {
        for (const alt of mod.getAlternatives(id, { settings }) || []) {
          if (alt && alt.id && !seen.has(alt.id)) {
            seen.add(alt.id);
            out.push(alt);
          }
        }
      } catch (err) {
        console.warn('[workout] getAlternatives failed for', id, err);
      }
    }
  }

  if (!out.length) {
    // Fallback: the ids the planner already resolved onto the item.
    for (const id of item.alternatives || []) {
      if (!seen.has(id)) {
        seen.add(id);
        out.push({ id, name: titleize(id), type: item.type });
      }
    }
    if (item.swappedFrom && !seen.has(origId)) out.push({ id: origId, name: titleize(origId), type: item.type });
  }
  return out;
}

async function openSwapSheet(uid) {
  const item = itemByUid(uid);
  if (!item) return;
  const alts = await alternativesFor(item);

  const remember = el('input', { type: 'checkbox' });
  const rememberRow = el('label', { class: 'wo-swap-check' }, [
    remember,
    el('span', {}, ['Remember this choice for next time']),
  ]);

  const list = alts.length
    ? el(
        'div',
        { class: 'card card--flush wo-swap-list' },
        alts.map((alt) =>
          el('button', { class: 'list-row', type: 'button',
            onclick: () => { closeSheet(); applySwap(uid, alt, remember.checked); } },
            [
              el('div', { class: 'list-row-main' }, [
                el('div', { class: 'list-row-title' }, [alt.name || titleize(alt.id)]),
                el('div', { class: 'list-row-sub' }, [
                  [titleize(alt.type || item.type), alt.axialLoading ? 'axial load' : null]
                    .filter(Boolean)
                    .join(' · '),
                ]),
              ]),
              el('div', { class: 'list-row-end' }, ['›']),
            ])
        )
      )
    : el('div', { class: 'empty-state' }, [
        el('div', { class: 'empty-state-title' }, ['No alternatives listed']),
        el('div', { class: 'empty-state-body' }, ['Skip it instead, or just do what feels right.']),
      ]);

  openSheet(
    el('div', {}, [
      el('div', { class: 'sheet-title' }, ['Swap ' + (item.name || titleize(item.exerciseId))]),
      list,
      alts.length ? rememberRow : null,
      el('button', { class: 'btn btn--ghost btn--block', type: 'button', 'data-sheet-close': '' }, ['Cancel']),
    ])
  );
}

function applySwap(uid, alt, remember) {
  const item = itemByUid(uid);
  if (!item) return;
  const origId = item.swappedFrom || item.exerciseId;
  const memory = store.getExerciseState()[alt.id] || {};

  const pick = (...vals) => {
    for (const v of vals) if (v !== undefined && v !== null) return v;
    return null;
  };
  // planner.getAlternatives returns { id, ...exerciseDef }, and the numbers
  // live under `defaults`, not on the def itself. Read both so a swap does not
  // silently carry the previous exercise's working weight across.
  const defs = alt.defaults || {};
  const from = (key) => (key in defs ? defs[key] : key in alt ? alt[key] : undefined);

  item.exerciseId = alt.id;
  item.swappedFrom = alt.id === origId ? null : origId;
  item.name = alt.name || titleize(alt.id);
  item.type = alt.type || item.type;
  item.measure = alt.measure || item.measure;
  item.perSide = alt.perSide === undefined ? item.perSide : !!alt.perSide;
  item.sets = pick(from('sets'), item.sets);
  // Per-exercise memory beats the generic default: this is what you lifted
  // last time you actually did this movement.
  item.reps = pick(memory.lastReps, from('reps'), item.reps);
  // `weight: null` means bodyweight and must survive, so this one checks for
  // presence rather than truthiness.
  const defWeight = from('weight');
  item.weight =
    memory.lastWeight !== undefined
      ? memory.lastWeight
      : defWeight !== undefined
      ? defWeight
      : item.weight;
  item.holdSec = pick(from('holdSec'), item.holdSec);
  item.durationMin = pick(from('durationMin'), item.durationMin);
  item.intensities = pick(from('intensities'), item.intensities);
  item.weightStep = pick(alt.weightStep, item.weightStep);
  item.axialLoading = alt.axialLoading === undefined ? false : !!alt.axialLoading;
  item.cues = pick(alt.cues, '');
  item.alternatives = pick(alt.alternatives, item.alternatives);
  item.notice = pick(alt.notice, null);

  // Progress belongs to the old movement, not this one.
  delete session.entries[uid];
  drafts.delete(uid);
  stopTimer(uid);
  persist();

  if (remember && origId && origId !== alt.id) {
    store.updateExerciseState(origId, { preferredSwap: alt.id });
  }

  renderCard(uid);
  showToast(remember ? `Swapped — we'll remember ${item.name}.` : 'Swapped to ' + item.name + '.');
}

/* ------------------------------------------------------------ finish flow */

function summarize() {
  let sets = 0;
  let done = 0;
  let skipped = 0;
  for (const block of session.blocks || []) {
    for (const item of block.items || []) {
      const e = entryOf(item.uid);
      if (!e) continue;
      if (e.skipped) {
        skipped++;
        continue;
      }
      done++;
      if (Array.isArray(e.sets)) sets += e.sets.length;
    }
  }
  return { sets, done, skipped, durationMs: Date.now() - (session.startedAt || Date.now()) };
}

function orderedEntries() {
  const out = [];
  for (const block of session.blocks || []) {
    for (const item of block.items || []) {
      const e = entryOf(item.uid);
      if (!e) continue;
      out.push(Object.assign({ uid: item.uid, block: block.title || null }, e));
    }
  }
  return out;
}

function finishSession(note) {
  session.note = note;
  store.appendSession({
    id: session.id,
    date: session.date,
    startedAt: session.startedAt,
    endedAt: Date.now(),
    painLevel: session.painLevel,
    routineId: session.routineId,
    routineName: session.routineName,
    variant: session.variant,
    dayLabel: session.dayLabel,
    entries: orderedEntries(),
    note,
  });
  store.clearActiveSession();
  closeSheet();
  teardown(); // release the wake lock and timers before the route swaps
  navigate('#/history');
  showToast('Nice work — logged.');
}

function openFinishSheet() {
  const s = summarize();

  const note = el('textarea', {
    class: 'wo-input', rows: '3', placeholder: 'Anything worth remembering? (optional)',
  });
  note.value = session.note || '';
  note.addEventListener('change', () => {
    session.note = note.value.trim();
    persist();
  });

  const cell = (value, label) =>
    el('div', { class: 'wo-summary-cell' }, [
      el('div', { class: 'wo-summary-value' }, [String(value)]),
      el('div', { class: 'wo-summary-label' }, [label]),
    ]);

  const discard = el('button', { class: 'wo-discard', type: 'button' }, ['Discard workout']);
  let armed = false;
  discard.addEventListener('click', () => {
    if (!armed) {
      armed = true;
      discard.textContent = 'Tap again to discard — this cannot be undone';
      discard.style.color = 'var(--danger)';
      setTimeout(() => {
        if (!discard.isConnected) return;
        armed = false;
        discard.textContent = 'Discard workout';
        discard.style.color = '';
      }, 4000);
      return;
    }
    store.clearActiveSession();
    closeSheet();
    teardown();
    navigate('#/home');
    showToast('Workout discarded.');
  });

  openSheet(
    el('div', {}, [
      el('div', { class: 'sheet-title' }, [s.done || s.sets ? 'Finish up?' : 'Call it here?']),
      el('div', { class: 'wo-summary' }, [
        cell(s.sets, 'sets'),
        cell(s.done, 'done'),
        cell(s.skipped, 'skipped'),
        cell(elapsedText(s.durationMs), 'time'),
      ]),
      el('p', { class: 'note' }, [
        s.done || s.sets
          ? 'This gets logged to your history and feeds the trend on the History screen.'
          : 'Nothing logged yet — that is fine. Showing up is the data point.',
      ]),
      el('div', { class: 'wo-field' }, [el('span', { class: 'wo-field-label' }, ['Note']), note]),
      el('div', { class: 'btn-row' }, [
        el('button', { class: 'btn btn--ghost', type: 'button', 'data-sheet-close': '' }, ['Keep going']),
        el('button', { class: 'btn', type: 'button', onclick: () => finishSession(note.value.trim()) }, [
          'Finish session',
        ]),
      ]),
      discard,
    ])
  );
}

/* ------------------------------------------------------------------- cues */

function cueTargetEl() {
  if (!activeCueUid) return null;
  if (activeCueUid.startsWith('seq:')) {
    const rec = seqRecs[Number(activeCueUid.slice(4))];
    return rec && rec.cardEl.isConnected ? rec.cardEl : null;
  }
  const card = cards.get(activeCueUid);
  if (!card || !card.el.isConnected) return null;
  return card.el.querySelector('.wo-timer') || card.el;
}

function onVisualCue() {
  const target = cueTargetEl();
  if (!target) return;
  // Remove + reflow + re-add, so a second cue inside the animation still fires.
  target.classList.remove('pulse');
  void target.offsetWidth;
  target.classList.add('pulse');
  target.addEventListener('animationend', () => target.classList.remove('pulse'), { once: true });
}

function onVisibility() {
  if (document.visibilityState === 'visible') tickElapsed();
}

/* ------------------------------------------------------------ mount/unmount */

export function mount(root) {
  rootEl = root;
  session = store.getActiveSession();
  settings = store.getSettings();
  cards = new Map();
  drafts = new Map();
  timers = new Map();
  seqRecs = [];
  expandedUid = null;
  activeCueUid = null;
  mounted = true;

  if (!session) {
    // The router guards this route, but a session cleared in another tab would
    // land here. Say something calm rather than throwing.
    root.replaceChildren(
      el('div', { class: 'empty-state' }, [
        el('div', { class: 'empty-state-icon' }, ['\u{1F3CB}️']),
        el('div', { class: 'empty-state-title' }, ['No workout in progress']),
        el('div', { class: 'empty-state-body' }, ['Start one from Home whenever you are ready.']),
        el('button', { class: 'btn', type: 'button', onclick: () => navigate('#/home') }, ['Go to Home']),
      ])
    );
    return;
  }
  if (!session.entries || typeof session.entries !== 'object') session.entries = {};

  cues.init();
  if (settings.keepScreenOn) {
    wakelock.enable().catch(() => {
      /* denied or unsupported — the workout still works */
    });
  }

  const frag = document.createDocumentFragment();
  frag.append(buildHeader());

  const blocks = Array.isArray(session.blocks) ? session.blocks : [];
  blocks.forEach((block, blockIndex) => {
    const items = Array.isArray(block.items) ? block.items : [];
    if (!items.length) return;
    if (block.title) frag.append(el('h2', { class: 'section-title' }, [block.title]));

    if (isStretchBlock(block)) {
      // A whole block of stretches becomes one guided player, not eight cards.
      const cardEl = el('section', { class: 'card wo-seq' });
      const rec = {
        seqIndex: seqRecs.length,
        block,
        blockIndex,
        cardEl,
        steps: buildSequenceSteps(block),
        player: null,
        index: 0,
        snap: null,
        done: items.every((i) => !!session.entries[i.uid]),
        countdownFired: false,
      };
      seqRecs.push(rec);
      frag.append(cardEl);
      renderSeq(rec);
      return;
    }

    for (const item of items) {
      const card = buildCard(item, block);
      cards.set(item.uid, card);
      frag.append(card.el);
    }
  });

  if (!blocks.length) {
    frag.append(
      el('div', { class: 'empty-state' }, [
        el('div', { class: 'empty-state-title' }, ['Nothing planned here']),
        el('div', { class: 'empty-state-body' }, ['Finish the session whenever you like — it still counts.']),
      ])
    );
  }

  // Open the first thing that still needs doing. Reload mid-workout lands you
  // back exactly where you were, with logged sets intact and timers idle.
  for (const [uid, card] of cards) {
    const s = statusOf(card.item);
    if (s === 'todo' || s === 'partial') {
      expandedUid = uid;
      break;
    }
  }
  for (const card of cards.values()) card.render();

  root.replaceChildren(frag);

  elapsedId = setInterval(tickElapsed, 1000);
  window.addEventListener('wt:visualcue', onVisualCue);
  document.addEventListener('visibilitychange', onVisibility);
}

function teardown() {
  if (!mounted) return;
  mounted = false;

  for (const rec of timers.values()) {
    try {
      rec.t.cancel();
    } catch {
      /* noop */
    }
  }
  timers.clear();

  for (const rec of seqRecs) {
    try {
      rec.player?.cancel();
    } catch {
      /* noop */
    }
  }
  seqRecs = [];

  if (elapsedId) {
    clearInterval(elapsedId);
    elapsedId = null;
  }
  window.removeEventListener('wt:visualcue', onVisualCue);
  document.removeEventListener('visibilitychange', onVisibility);
  wakelock.disable();

  cards = new Map();
  drafts = new Map();
  elapsedEl = null;
  rootEl = null;
  activeCueUid = null;
}

export function unmount() {
  teardown();
}
