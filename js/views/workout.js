/**
 * workout.js — STUB. Being replaced by the workout-view agent.
 * View contract: export mount(rootEl), optionally unmount().
 * Note: the #/workout route is guarded — it only mounts when
 * store.getActiveSession() is non-null.
 */

import { el } from '../app.js';

export function mount(rootEl) {
  rootEl.replaceChildren(
    el('div', { class: 'empty-state' }, [
      el('div', { class: 'empty-state-icon' }, ['🏋️']),
      el('div', { class: 'empty-state-title' }, ['Workout']),
      el('div', { class: 'empty-state-body' }, ['Coming soon.']),
    ])
  );
}

export function unmount() {}
