/**
 * home.js — the start screen.
 *
 * Reading order, top to bottom:
 *   greeting → resume banner (if a workout is in flight) → pain check-in →
 *   suggestion → session picker → log body weight → sessions this week.
 *
 * The pain check-in gates the picker: one tap is the whole ask, and it is what
 * lets the planner suggest the right shape of session. The suggestion is always
 * a suggestion — the Regular / Pain day toggle is right there.
 *
 * Tone rules for anything written here: no streaks, no "don't break the chain",
 * no red numbers. A missed week is not a failure state, and a pain day that
 * ends in five minutes of stretching is a completed session.
 */

import { el, showToast, openSheet, closeSheet, navigate } from '../app.js';
import {
  getSettings,
  getSessions,
  getExerciseState,
  getActiveSession,
  setActiveSession,
  clearActiveSession,
  getBodyWeights,
  appendBodyWeight,
  todayISO,
} from '../store.js';
import { suggestVariant, getRoutines, resolveWorkout } from '../planner.js';

// The supervisor wires the <link> tags; a view owns its own stylesheet so it
// works standalone and cannot be forgotten.
document.head.append(
  Object.assign(document.createElement('link'), { rel: 'stylesheet', href: './css/home.css' })
);

const KG_PER_LB = 0.45359237;

/* --------------------------------------------------------------- view state */

let state = {
  painLevel: null,
  variant: 'regular', // user-visible choice; pre-set from the suggestion
  variantTouched: false, // once true, re-tapping a pain chip stops overriding it
  gestureSent: false,
};

let root = null;
let shakeTimer = null;

/* -------------------------------------------------------------- small utils */

function fmtDate(d = new Date()) {
  try {
    return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  } catch {
    return todayISO(d);
  }
}

function fmtClock(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Monday-start week, as a YYYY-MM-DD string we can compare against session.date. */
function weekStartISO() {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return todayISO(d);
}

function newSessionId() {
  return 's_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** The A/B alternation only makes sense against the last session that had one. */
function lastDayLabelFrom(sessions) {
  for (let i = sessions.length - 1; i >= 0; i--) {
    if (sessions[i] && sessions[i].dayLabel) return sessions[i].dayLabel;
  }
  return null;
}

function painTone(level) {
  if (level <= 3) return 'low';
  if (level <= 6) return 'mid';
  return 'high';
}

/** The first deliberate tap is our chance to unlock audio on Android/iOS. */
function announceUserGesture() {
  if (state.gestureSent) return;
  state.gestureSent = true;
  try {
    window.dispatchEvent(new CustomEvent('wt:usergesture'));
  } catch {
    /* non-browser context */
  }
}

/* -------------------------------------------------------------- sections */

function greeting() {
  return el('header', { class: 'home-head' }, [
    el('h1', {}, ['Backbone']),
    el('div', { class: 'home-date small muted' }, [fmtDate()]),
  ]);
}

function resumeBanner(active) {
  if (!active) return null;

  const discard = () => {
    const panel = el('div', {}, [
      el('div', { class: 'sheet-title' }, ['Discard this workout?']),
      el('p', { class: 'muted small' }, [
        'Anything logged in it goes away. Resuming keeps every set you already entered.',
      ]),
      el('div', { class: 'btn-row', style: 'margin-top:16px' }, [
        el('button', { class: 'btn btn--ghost', type: 'button', onclick: closeSheet }, ['Keep it']),
        el(
          'button',
          {
            class: 'btn btn--danger',
            type: 'button',
            onclick: () => {
              clearActiveSession();
              closeSheet();
              showToast('Workout discarded.');
              render();
            },
          },
          ['Discard']
        ),
      ]),
    ]);
    openSheet(panel);
  };

  return el('div', { class: 'card card--accent home-resume' }, [
    el('div', { class: 'card-title' }, [`Resume workout from ${fmtClock(active.startedAt)}?`]),
    el('div', { class: 'card-sub' }, [
      active.routineName + (active.dayLabel ? ` · Day ${active.dayLabel}` : ''),
    ]),
    el('div', { class: 'btn-row', style: 'margin-top:14px' }, [
      el(
        'button',
        { class: 'btn', type: 'button', onclick: () => navigate('#/workout') },
        ['Resume']
      ),
      el('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: discard }, [
        'Discard',
      ]),
    ]),
  ]);
}

function painCheckIn() {
  const chips = [];
  for (let i = 0; i <= 10; i++) {
    const selected = state.painLevel === i;
    chips.push(
      el(
        'button',
        {
          class: `chip pain-chip pain-chip--${painTone(i)}`,
          type: 'button',
          'aria-pressed': selected ? 'true' : 'false',
          'aria-label': `Pain ${i} out of 10`,
          onclick: () => {
            announceUserGesture();
            state.painLevel = i;
            if (!state.variantTouched) state.variant = suggestVariant(i).variant;
            render();
          },
        },
        [String(i)]
      )
    );
  }

  return el('section', { class: 'home-pain' }, [
    el('div', { class: 'section-title' }, ["How's the back today?"]),
    el('div', { class: 'chip-row pain-row' }, chips),
    el('div', { class: 'pain-scale note' }, [
      el('span', {}, ['0 · none']),
      el('span', {}, ['10 · severe']),
    ]),
  ]);
}

function suggestionCard() {
  if (state.painLevel === null) return null;
  const s = suggestVariant(state.painLevel);

  const toggle = (value, label) =>
    el(
      'button',
      {
        class: 'chip' + (value === 'pain' ? ' chip--pain' : ''),
        type: 'button',
        'aria-pressed': state.variant === value ? 'true' : 'false',
        onclick: () => {
          state.variant = value;
          state.variantTouched = true;
          render();
        },
      },
      [label]
    );

  return el(
    'div',
    { class: 'card ' + (s.variant === 'pain' ? 'card--pain' : 'card--accent') },
    [
      el('p', { class: 'home-suggestion' }, [s.message]),
      el('div', { class: 'chip-row' }, [toggle('regular', 'Regular'), toggle('pain', 'Pain day')]),
      s.stretchOnly
        ? el('div', { class: 'note', style: 'margin-top:10px' }, [
            'Stretch Full or Stretch Short below is plenty today. Anything more is a bonus, not a target.',
          ])
        : null,
    ]
  );
}

function startSession(routineId) {
  if (state.painLevel === null) {
    const row = root && root.querySelector('.pain-row');
    if (row) {
      row.classList.remove('is-nudging');
      // Reflow so the animation restarts on a repeat tap.
      void row.offsetWidth;
      row.classList.add('is-nudging');
      if (shakeTimer) clearTimeout(shakeTimer);
      shakeTimer = setTimeout(() => row.classList.remove('is-nudging'), 700);
      row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    showToast("One tap first: how's the back?");
    return;
  }

  const sessions = getSessions();
  const workout = resolveWorkout(routineId, state.variant, {
    exerciseState: getExerciseState(),
    settings: getSettings(),
    lastDayLabel: lastDayLabelFrom(sessions),
    cardioFocusCount: sessions.filter((s) => s.routineId === 'cardio-focus').length,
  });

  if (!workout) {
    showToast('Could not build that session.');
    return;
  }

  setActiveSession({
    id: newSessionId(),
    startedAt: Date.now(),
    date: todayISO(),
    painLevel: state.painLevel,
    routineId: workout.routineId,
    routineName: workout.routineName,
    variant: workout.variant,
    dayLabel: workout.dayLabel,
    blocks: workout.blocks,
    entries: {},
    note: '',
  });

  navigate('#/workout');
}

function sessionPicker(active) {
  const routines = getRoutines();
  const stretchOnly = state.painLevel !== null && suggestVariant(state.painLevel).stretchOnly;

  const rowFor = (r) => {
    const suggested = stretchOnly && r.kind === 'stretch';
    return el(
      'button',
      {
        class: 'list-row routine-row',
        type: 'button',
        disabled: active ? true : null,
        onclick: () => startSession(r.id),
      },
      [
        el('div', { class: 'list-row-main' }, [
          el('div', { class: 'list-row-title' }, [r.name]),
          el('div', { class: 'list-row-sub' }, [r.description]),
        ]),
        el('div', { class: 'list-row-end' }, [
          suggested ? el('span', { class: 'badge badge--accent' }, ['Suggested']) : null,
          el('span', { class: 'badge' }, [`${r.estMinutes} min`]),
        ]),
      ]
    );
  };

  const gym = routines.filter((r) => r.kind === 'gym');
  const stretch = routines.filter((r) => r.kind === 'stretch');

  return el('section', {}, [
    el('div', { class: 'section-title' }, ['Start a session']),
    active
      ? el('p', { class: 'note', style: 'margin-bottom:12px' }, [
          'Finish or discard the workout above to start a new one.',
        ])
      : null,
    el('div', { class: 'card card--flush' }, gym.map(rowFor)),
    el('div', { class: 'section-title' }, ['Stretch only']),
    el('div', { class: 'card card--flush' }, stretch.map(rowFor)),
  ]);
}

/* ------------------------------------------------------------- body weight */

function openBodyWeightSheet() {
  const settings = getSettings();
  const unit = settings.weightUnit === 'lb' ? 'lb' : 'kg';
  const last = getBodyWeights().slice(-1)[0]; // list is oldest first
  const lastShown = last ? (unit === 'lb' ? last.kg / KG_PER_LB : last.kg) : null;

  const input = el('input', {
    class: 'weight-input num',
    type: 'number',
    inputmode: 'decimal',
    step: '0.1',
    min: '20',
    max: '400',
    placeholder: lastShown ? lastShown.toFixed(1) : unit === 'lb' ? '180.0' : '82.0',
    'aria-label': `Body weight in ${unit}`,
  });

  const save = () => {
    const raw = parseFloat(input.value);
    if (!isFinite(raw) || raw <= 0) {
      showToast('Enter a number first.');
      input.focus();
      return;
    }
    const kg = unit === 'lb' ? raw * KG_PER_LB : raw;
    if (kg < 20 || kg > 400) {
      showToast('That does not look right. Check the number?');
      return;
    }
    appendBodyWeight({ date: todayISO(), kg: Math.round(kg * 10) / 10 });
    closeSheet();
    showToast(`Logged ${raw.toFixed(1)} ${unit}.`);
    render();
  };

  const panel = el('div', {}, [
    el('div', { class: 'sheet-title' }, ['Log body weight']),
    el('p', { class: 'note' }, [
      last
        ? `Last entry: ${(unit === 'lb' ? last.kg / KG_PER_LB : last.kg).toFixed(1)} ${unit} on ${last.date}.`
        : 'One number, whenever you feel like it. The History screen draws the trend.',
    ]),
    el('div', { class: 'weight-field' }, [input, el('span', { class: 'weight-unit' }, [unit])]),
    el('div', { class: 'btn-row', style: 'margin-top:16px' }, [
      el('button', { class: 'btn btn--ghost', type: 'button', onclick: closeSheet }, ['Cancel']),
      el('button', { class: 'btn', type: 'button', onclick: save }, ['Save']),
    ]),
  ]);

  openSheet(panel);
  // Autofocus only after the sheet has slid in, or Android scrolls it half-open.
  setTimeout(() => input.focus(), 260);
}

/* ------------------------------------------------------------------ footer */

function weekFooter(sessions) {
  const start = weekStartISO();
  const n = sessions.filter((s) => (s.date || '') >= start).length;
  const text =
    n === 0 ? 'Nothing logged this week yet.' : `${n} session${n === 1 ? '' : 's'} this week.`;
  return el('div', { class: 'home-foot note center' }, [text]);
}

/* ------------------------------------------------------------------ render */

function render() {
  if (!root) return;
  const active = getActiveSession();
  const sessions = getSessions();

  root.replaceChildren(
    el('div', { class: 'home stack' }, [
      greeting(),
      resumeBanner(active),
      painCheckIn(),
      suggestionCard(),
      sessionPicker(active),
      el(
        'button',
        { class: 'btn btn--ghost btn--block btn--sm', type: 'button', onclick: openBodyWeightSheet },
        ['+ Log body weight']
      ),
      weekFooter(sessions),
    ])
  );
}

/* ------------------------------------------------------------- view contract */

export function mount(rootEl) {
  root = rootEl;
  state = { painLevel: null, variant: 'regular', variantTouched: false, gestureSent: false };
  render();
}

export function unmount() {
  if (shakeTimer) clearTimeout(shakeTimer);
  shakeTimer = null;
  root = null;
}
