/**
 * settings.js — the settings screen.
 *
 * Everything here reads and writes through store.js. Each control writes
 * immediately (no Save button) and re-renders only the piece that changed.
 */

import { el, showToast, openSheet, closeSheet } from '../app.js';
import * as store from '../store.js';
import * as wakelock from '../wakelock.js';

const VIBRATE_SUPPORTED = typeof navigator !== 'undefined' && 'vibrate' in navigator;

let root = null;

/** Re-render in place (used after export/import changes stored state). */
function refresh() {
  if (root) renderInto(root);
}

/* --------------------------------------------------------------- controls */

/** A labelled row with an arbitrary control on the right. */
function settingRow(title, sub, control) {
  return el('div', { class: 'setting-row' }, [
    el('div', { class: 'setting-row-main' }, [
      el('div', { class: 'setting-row-title' }, [title]),
      sub ? el('div', { class: 'setting-row-sub' }, [sub]) : null,
    ]),
    el('div', { class: 'setting-row-end' }, [control]),
  ]);
}

/** − value + stepper bound to one numeric setting. */
function stepper({ value, step, min, max, format, onChange }) {
  const valueEl = el('span', { class: 'stepper-value num' }, [format(value)]);
  const minus = el('button', { type: 'button', 'aria-label': 'Decrease' }, ['−']);
  const plus = el('button', { type: 'button', 'aria-label': 'Increase' }, ['+']);
  let v = value;

  const sync = () => {
    valueEl.textContent = format(v);
    minus.toggleAttribute('disabled', v <= min);
    plus.toggleAttribute('disabled', v >= max);
  };
  const bump = (delta) => {
    const next = Math.min(max, Math.max(min, v + delta));
    if (next === v) return;
    v = next;
    sync();
    onChange(v);
  };
  minus.addEventListener('click', () => bump(-step));
  plus.addEventListener('click', () => bump(step));
  sync();

  return el('div', { class: 'stepper' }, [minus, valueEl, plus]);
}

/** Switch bound to one boolean setting. */
function toggle({ checked, label, onChange }) {
  const input = el('input', { type: 'checkbox', 'aria-label': label });
  input.checked = !!checked;
  input.addEventListener('change', () => onChange(input.checked));
  return el('label', { class: 'toggle' }, [input, el('span', { class: 'toggle-track' })]);
}

/** Two-chip single-select (used for kg / lb). */
function chipGroup({ options, value, onChange }) {
  const wrap = el('div', { class: 'chip-row' }, []);
  const buttons = options.map((opt) => {
    const btn = el(
      'button',
      { class: 'chip', type: 'button', 'aria-pressed': String(opt.value === value) },
      [opt.label]
    );
    btn.addEventListener('click', () => {
      if (btn.getAttribute('aria-pressed') === 'true') return;
      for (const b of buttons) b.setAttribute('aria-pressed', String(b === btn));
      onChange(opt.value);
    });
    return btn;
  });
  wrap.append(...buttons);
  return wrap;
}

/* ------------------------------------------------------------ backup bits */

function lastBackupLabel(meta) {
  if (!meta.lastExportAt) return 'Last backup: never';
  const days = Math.floor((Date.now() - meta.lastExportAt) / 86400000);
  if (days <= 0) return 'Last backup: today';
  if (days === 1) return 'Last backup: yesterday';
  return `Last backup: ${days} days ago`;
}

/** Bottom-sheet confirmation before an import replaces everything. */
function confirmImport(file) {
  const sessionsNow = store.getSessions().length;

  const body = el('div', {}, [
    el('div', { class: 'sheet-title' }, ['Replace all data?']),
    el('p', { class: 'small muted' }, [
      `Importing "${file.name}" replaces every workout, setting and weigh-in on this phone. ` +
        `You currently have ${sessionsNow} saved session${sessionsNow === 1 ? '' : 's'}.`,
    ]),
    el('p', { class: 'small muted' }, [
      'Your current data is exported first as a safety backup, so this is recoverable.',
    ]),
  ]);

  const cancel = el('button', { class: 'btn btn--ghost', type: 'button' }, ['Cancel']);
  const go = el('button', { class: 'btn btn--danger', type: 'button' }, ['Replace']);
  body.appendChild(el('div', { class: 'btn-row', style: 'margin-top:20px' }, [cancel, go]));

  cancel.addEventListener('click', closeSheet);
  go.addEventListener('click', () => {
    go.setAttribute('aria-disabled', 'true');
    go.textContent = 'Importing…';
    store
      .importBackup(file)
      .then(({ sessionsBefore, sessionsAfter }) => {
        closeSheet();
        showToast(`Imported: ${sessionsBefore} → ${sessionsAfter} sessions.`);
        refresh();
      })
      .catch((err) => {
        closeSheet();
        showToast(err?.message || 'Import failed.');
      });
  });

  openSheet(body);
}

/* ------------------------------------------------------------------ render */

function renderInto(rootEl) {
  const s = store.getSettings();
  const meta = store.getMeta();
  const set = (patch) => store.setSettings(patch);

  const frag = document.createDocumentFragment();

  frag.appendChild(el('h1', {}, ['Settings']));

  /* ---- Timers ---- */
  frag.appendChild(el('div', { class: 'section-title' }, ['Timers']));
  frag.appendChild(
    el('div', { class: 'card' }, [
      settingRow(
        'Rest between sets',
        'Counts down after you log a set.',
        stepper({
          value: s.restTimerSec,
          step: 15,
          min: 15,
          max: 300,
          format: (v) => `${v}s`,
          onChange: (v) => set({ restTimerSec: v }),
        })
      ),
      settingRow(
        'Stretch transition',
        'Pause between held stretches.',
        stepper({
          value: s.stretchTransitionSec,
          step: 5,
          min: 5,
          max: 60,
          format: (v) => `${v}s`,
          onChange: (v) => set({ stretchTransitionSec: v }),
        })
      ),
    ])
  );

  /* ---- Cues ---- */
  frag.appendChild(el('div', { class: 'section-title' }, ['Timer cues']));
  const cues = el('div', { class: 'card' }, [
    settingRow(
      'Sound',
      'Beep when a timer ends.',
      toggle({ checked: s.sound, label: 'Sound', onChange: (v) => set({ sound: v }) })
    ),
  ]);
  if (VIBRATE_SUPPORTED) {
    cues.appendChild(
      settingRow(
        'Vibrate',
        'Buzz when a timer ends.',
        toggle({ checked: s.vibrate, label: 'Vibrate', onChange: (v) => set({ vibrate: v }) })
      )
    );
  }
  cues.appendChild(
    settingRow(
      'Visual cue',
      'Flash the screen when a timer ends.',
      toggle({ checked: s.visualCue, label: 'Visual cue', onChange: (v) => set({ visualCue: v }) })
    )
  );
  frag.appendChild(cues);

  /* ---- Training ---- */
  frag.appendChild(el('div', { class: 'section-title' }, ['Training']));
  frag.appendChild(
    el('div', { class: 'card' }, [
      settingRow(
        'Skip axial loading',
        'Substitutes exercises that compress the spine.',
        toggle({
          checked: s.noAxialLoading,
          label: 'Skip axial loading',
          onChange: (v) => {
            set({ noAxialLoading: v });
            showToast(v ? 'Spine-compressing lifts will be swapped out.' : 'Axial loading allowed again.');
          },
        })
      ),
      settingRow(
        'Weight unit',
        null,
        chipGroup({
          options: [
            { value: 'kg', label: 'kg' },
            { value: 'lb', label: 'lb' },
          ],
          value: s.weightUnit,
          onChange: (v) => set({ weightUnit: v }),
        })
      ),
    ])
  );

  /* ---- Screen ---- */
  frag.appendChild(el('div', { class: 'section-title' }, ['Screen']));
  frag.appendChild(
    el('div', { class: 'card' }, [
      settingRow(
        'Keep screen on',
        wakelock.isSupported()
          ? 'Stops the screen sleeping during a workout.'
          : 'Not supported on this browser.',
        wakelock.isSupported()
          ? toggle({
              checked: s.keepScreenOn,
              label: 'Keep screen on',
              onChange: (v) => {
                set({ keepScreenOn: v });
                if (!v) wakelock.disable();
              },
            })
          : el('span', { class: 'badge' }, ['Unavailable'])
      ),
    ])
  );

  /* ---- Backup ---- */
  frag.appendChild(el('div', { class: 'section-title' }, ['Backup']));

  const fileInput = el('input', {
    class: 'file-input',
    type: 'file',
    accept: 'application/json,.json',
    id: 'import-file',
  });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = ''; // allow re-picking the same file
    if (file) confirmImport(file);
  });

  const exportBtn = el('button', { class: 'btn btn--block', type: 'button' }, ['Export backup']);
  exportBtn.addEventListener('click', () => {
    try {
      store.exportBackup();
      showToast('Backup saved to your downloads.');
      refresh(); // refresh the "last backup" line
    } catch (err) {
      console.error(err);
      showToast('Export failed.');
    }
  });

  const importBtn = el('button', { class: 'btn btn--ghost btn--block', type: 'button' }, ['Import backup']);
  importBtn.addEventListener('click', () => fileInput.click());

  frag.appendChild(
    el('div', { class: 'card stack' }, [
      el('p', { class: 'small muted' }, [
        'Your workouts live only on this phone. Export regularly, and before clearing your browser data.',
      ]),
      exportBtn,
      importBtn,
      fileInput,
      el('div', { class: 'note' }, [lastBackupLabel(meta)]),
    ])
  );

  /* ---- About ---- */
  frag.appendChild(el('div', { class: 'section-title' }, ['About']));
  frag.appendChild(
    el('div', { class: 'card stack' }, [
      el('div', { class: 'row row--between' }, [
        el('span', { class: 'small muted' }, ['Backbone']),
        el('span', { class: 'badge' }, [`v${store.APP_VERSION}`]),
      ]),
      el('div', { class: 'note' }, [
        'Not medical advice. Backbone is a log, not a clinician. Train pain-guided: ' +
          'stay inside a range that does not increase your symptoms, back off when it does, ' +
          'and check anything new or worsening with a physio or doctor.',
      ]),
    ])
  );

  rootEl.replaceChildren(frag);
}

/* ------------------------------------------------------------- lifecycle */

export function mount(rootEl) {
  root = rootEl;
  renderInto(rootEl);
}

export function unmount() {
  root = null;
}
