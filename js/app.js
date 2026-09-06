/**
 * app.js — boot + hash router + shared UI helpers.
 *
 * View contract (js/views/*.js):
 *   export function mount(rootEl) {}     // required — render into rootEl (#view)
 *   export function unmount() {}         // optional — clear timers/listeners
 *
 * Views import the helpers below from './../app.js':
 *   showToast(msg, { actionLabel, onAction, duration })
 *   openSheet(contentEl) / closeSheet()
 *   navigate('#/home')
 */

import * as store from './store.js';

/* ------------------------------------------------------------------ routing */

const viewEl = document.getElementById('view');
const tabbarEl = document.getElementById('tabbar');

const ROUTES = {
  home: { path: './views/home.js' },
  workout: {
    path: './views/workout.js',
    // No workout in progress? There is nothing to show. Bounce to Home.
    guard: () => (store.getActiveSession() ? null : '#/home'),
  },
  history: { path: './views/history.js' },
  settings: { path: './views/settings.js' },
};
const DEFAULT_ROUTE = 'home';

let current = { name: null, module: null };
let routing = false;

function routeFromHash() {
  const name = (location.hash || '').replace(/^#\/?/, '').split(/[/?]/)[0];
  return ROUTES[name] ? name : DEFAULT_ROUTE;
}

/** Programmatic navigation. Same-hash calls still re-render. */
export function navigate(hash) {
  const next = hash.startsWith('#') ? hash : '#' + hash;
  if (location.hash === next) render();
  else location.hash = next;
}

function setActiveTab(name) {
  for (const tab of tabbarEl.querySelectorAll('.tab')) {
    if (tab.dataset.route === name) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  }
}

async function render() {
  if (routing) return;
  routing = true;
  try {
    const name = routeFromHash();
    const route = ROUTES[name];

    const redirect = route.guard ? route.guard() : null;
    if (redirect) {
      routing = false;
      navigate(redirect);
      return;
    }

    // Tear the old view down before the DOM disappears from under it.
    if (current.module && typeof current.module.unmount === 'function') {
      try {
        current.module.unmount();
      } catch (err) {
        console.error('[router] unmount failed for', current.name, err);
      }
    }
    closeSheet();
    viewEl.replaceChildren();
    viewEl.scrollTop = 0;
    window.scrollTo(0, 0);

    let mod;
    try {
      mod = await import(route.path);
    } catch (err) {
      console.error('[router] could not load view', name, err);
      viewEl.replaceChildren(
        el('div', { class: 'empty-state' }, [
          el('div', { class: 'empty-state-icon' }, ['⚠️']),
          el('div', { class: 'empty-state-title' }, ['Could not load this screen']),
          el('div', { class: 'empty-state-body' }, ['Close and reopen the app, or restart to pick up an update.']),
        ])
      );
      current = { name, module: null };
      setActiveTab(name);
      return;
    }

    current = { name, module: mod };
    setActiveTab(name);
    document.body.dataset.route = name;
    try {
      mod.mount(viewEl);
    } catch (err) {
      console.error('[router] mount failed for', name, err);
      showToast('Something went wrong drawing this screen.');
    }
  } finally {
    routing = false;
  }
}

window.addEventListener('hashchange', render);

/* -------------------------------------------------------------------- toast */

const toastHost = document.getElementById('toast');

/**
 * Show a transient toast. Pass `duration: 0` for a sticky toast (the SW update
 * prompt uses this). Returns a dismiss() function.
 */
export function showToast(msg, { actionLabel, onAction, duration = 3200 } = {}) {
  const node = el('div', { class: 'toast' }, [el('span', { class: 'toast-msg' }, [msg])]);

  let timer = null;
  const dismiss = () => {
    if (timer) clearTimeout(timer);
    if (!node.isConnected) return;
    node.classList.add('is-leaving');
    node.addEventListener('animationend', () => node.remove(), { once: true });
    setTimeout(() => node.remove(), 400);
  };

  if (actionLabel) {
    const btn = el('button', { class: 'toast-action', type: 'button' }, [actionLabel]);
    btn.addEventListener('click', () => {
      dismiss();
      try {
        onAction?.();
      } catch (err) {
        console.error('[toast] action failed', err);
      }
    });
    node.appendChild(btn);
  }

  toastHost.appendChild(node);
  if (duration > 0) timer = setTimeout(dismiss, duration);
  return dismiss;
}

// store.js reports write failures through this event instead of importing app.js.
window.addEventListener('wt:toast', (e) => showToast(e.detail?.msg || 'Something went wrong.'));

/* --------------------------------------------------------------- sheet */

const sheetRoot = document.getElementById('sheet');
const sheetBody = sheetRoot.querySelector('.sheet-body');
let sheetOpen = false;

/** Open the bottom sheet with `contentEl` inside. Backdrop/grip tap closes. */
export function openSheet(contentEl) {
  sheetBody.replaceChildren(contentEl);
  sheetRoot.hidden = false;
  sheetOpen = true;
  // Next frame, so the transform transition actually runs.
  requestAnimationFrame(() => sheetRoot.classList.add('is-open'));
  return closeSheet;
}

export function closeSheet() {
  if (!sheetOpen) {
    sheetRoot.hidden = true;
    return;
  }
  sheetOpen = false;
  sheetRoot.classList.remove('is-open');
  setTimeout(() => {
    if (sheetOpen) return; // reopened in the meantime
    sheetRoot.hidden = true;
    sheetBody.replaceChildren();
  }, 240);
}

sheetRoot.addEventListener('click', (e) => {
  if (e.target.closest('[data-sheet-close]')) closeSheet();
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && sheetOpen) closeSheet();
});

/* ------------------------------------------------------------- DOM helper */

/**
 * Tiny element builder shared by the views.
 *   el('button', { class: 'btn', type: 'button', onclick: fn }, ['Start'])
 * Keys starting with `on` become listeners; `dataset` takes an object;
 * everything else is setAttribute. Children may be nodes or strings.
 */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, String(v));
  }
  for (const c of [].concat(children)) {
    if (c === null || c === undefined || c === false) continue;
    node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return node;
}

/* ------------------------------------------------ service worker / updates */

let refreshing = false;

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // Relative path keeps this working under a GitHub Pages subpath.
  navigator.serviceWorker
    .register('./sw.js')
    .then((reg) => {
      const offerUpdate = (worker) => {
        if (!worker) return;
        // Never interrupt a workout: a reload would drop the in-flight timers.
        if (store.getActiveSession()) return;
        showToast('Update ready', {
          actionLabel: 'Restart',
          duration: 0,
          onAction: () => worker.postMessage({ type: 'SKIP_WAITING' }),
        });
      };

      if (reg.waiting) offerUpdate(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        sw?.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(reg.waiting || sw);
        });
      });
    })
    .catch((err) => console.warn('[sw] registration failed', err));

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    location.reload();
  });
}

/* ----------------------------------------------- stale-session auto-finish */

const STALE_AFTER_MS = 2 * 60 * 60 * 1000; // a workout still "open" after 2h was forgotten
const ASSUMED_DURATION_MS = 75 * 60 * 1000; // save it as a 1h15 session

/**
 * If an active session was started more than 2 hours ago, the user forgot to
 * tap Finish. With logged work: save it as a 1h15 session (never ending before
 * the last logged set + 5 min). With nothing logged: discard it quietly.
 * Returns true if it resolved a stale session either way.
 */
function autoFinishStaleSession() {
  const session = store.getActiveSession();
  if (!session || !session.startedAt) return false;
  if (Date.now() - session.startedAt < STALE_AFTER_MS) return false;

  // Ordered entries, same blocks -> items order the workout view uses.
  const entries = [];
  let lastAt = 0;
  for (const block of session.blocks || []) {
    for (const item of block.items || []) {
      const e = (session.entries || {})[item.uid];
      if (!e) continue;
      entries.push(Object.assign({ uid: item.uid, block: block.title || null }, e));
      for (const s of e.sets || []) if (s.at) lastAt = Math.max(lastAt, s.at);
    }
  }

  if (!entries.some((e) => !e.skipped)) {
    store.clearActiveSession();
    showToast('Discarded an empty workout that was left open.');
    return true;
  }

  const endedAt = Math.max(
    session.startedAt + ASSUMED_DURATION_MS,
    lastAt ? lastAt + 5 * 60 * 1000 : 0
  );
  store.appendSession({
    id: session.id,
    date: session.date,
    startedAt: session.startedAt,
    endedAt,
    painLevel: session.painLevel,
    routineId: session.routineId,
    routineName: session.routineName,
    variant: session.variant,
    dayLabel: session.dayLabel,
    entries,
    note: [session.note, '(auto-finished: left open past 2h, saved as 1h15)']
      .filter(Boolean)
      .join(' '),
  });
  store.clearActiveSession();
  showToast('Unfinished workout saved as a 1h 15m session.');
  return true;
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (!autoFinishStaleSession()) return;
  // The session is gone; get the UI off the dead workout screen.
  if (current.name === 'workout') navigate('#/home');
  else render();
});

/* ---------------------------------------------------------------- boot */

function boot() {
  autoFinishStaleSession();
  store.migrate();

  // Ask for durable storage so Android does not evict the workout log.
  try {
    navigator.storage?.persist?.().catch(() => {});
  } catch {
    /* unsupported — localStorage still works, it is just evictable */
  }

  // replaceState (not location.replace) so this does not fire a second
  // hashchange and double-mount the first view.
  if (!location.hash) {
    try {
      history.replaceState(null, '', '#/' + DEFAULT_ROUTE);
    } catch {
      location.hash = '#/' + DEFAULT_ROUTE;
    }
  }
  render();
  registerServiceWorker();
}

boot();
