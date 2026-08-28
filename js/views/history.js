/**
 * history.js — STUB. Being replaced by the history-view agent.
 * View contract: export mount(rootEl), optionally unmount().
 */

import { el } from '../app.js';

export function mount(rootEl) {
  rootEl.replaceChildren(
    el('div', { class: 'empty-state' }, [
      el('div', { class: 'empty-state-icon' }, ['📅']),
      el('div', { class: 'empty-state-title' }, ['History']),
      el('div', { class: 'empty-state-body' }, ['Coming soon.']),
    ])
  );
}

export function unmount() {}
