/**
 * history.js — the long-arc view.
 *
 * Tone rules (see ROUTINES.md): this screen never scolds. No streaks, no
 * "you missed N days", no red for a gap. The only things it celebrates are
 * sessions accumulating, pain trending down, weights trending up, and body
 * weight moving. Everything else is neutral reporting.
 *
 * Sections, top to bottom:
 *   1. Header stats     — this week / this month / total
 *   2. Pain trend       — painLevel per session, last 90 days
 *   3. Body weight      — weigh-ins, last 180 days (ghost hint when empty)
 *   4. Strength         — one exercise at a time, top-set weight over time
 *   5. Session list     — newest first, grouped by month, tap for detail
 */

import { el, openSheet } from '../app.js';
import { getSessions, getBodyWeights, getSettings } from '../store.js';
import { lineChart } from '../charts.js';

document.head.append(
  Object.assign(document.createElement('link'), { rel: 'stylesheet', href: './css/history.css' })
);

/* ------------------------------------------------------- exercise names */

/**
 * data/routines.js is built in parallel and may not exist yet, so the display
 * names load opportunistically. Until (or unless) they arrive we prettify the
 * id: "leg-press" -> "Leg Press". The view re-renders once the map lands.
 */
let EX_NAMES = null;

const namesReady = import('../../data/routines.js')
  .then((mod) => {
    const src = mod && mod.EXERCISES;
    const map = {};
    if (Array.isArray(src)) {
      for (const e of src) if (e && e.id) map[e.id] = e.name || e.title || e.label || prettify(e.id);
    } else if (src && typeof src === 'object') {
      for (const [id, v] of Object.entries(src)) {
        map[id] = typeof v === 'string' ? v : (v && (v.name || v.title || v.label)) || prettify(id);
      }
    }
    EX_NAMES = map;
  })
  .catch(() => {
    EX_NAMES = {};
  });

function prettify(id) {
  return String(id || '')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function exName(id) {
  return (EX_NAMES && EX_NAMES[id]) || prettify(id);
}

/* ------------------------------------------------------------ date helpers */

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/** "YYYY-MM-DD" -> local-midnight Date (never UTC, so no off-by-one day). */
function parseISO(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

function isoOf(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function daysAgoISO(n) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return isoOf(d);
}

/** ISO week: Monday-start. Returns the Monday of the week containing `d`. */
function weekStartISO(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return isoOf(x);
}

/* ---------------------------------------------------------- unit helpers */

function fmtWeight(kg, unit) {
  if (typeof kg !== 'number' || !isFinite(kg)) return '';
  if (unit === 'lb') return (kg * 2.2046).toFixed(1) + ' lb';
  const r = Math.round(kg * 10) / 10;
  return (Number.isInteger(r) ? String(r) : r.toFixed(1)) + ' kg';
}

function toDisplayWeight(kg, unit) {
  return unit === 'lb' ? kg * 2.2046 : kg;
}

function unitLabel(unit) {
  return unit === 'lb' ? 'lb' : 'kg';
}

/* -------------------------------------------------------- session helpers */

function durationMin(s) {
  if (!s || !s.startedAt || !s.endedAt) return null;
  const mins = Math.round((s.endedAt - s.startedAt) / 60000);
  return mins > 0 ? mins : null;
}

function setCount(s) {
  let n = 0;
  for (const e of s.entries || []) {
    if (e && !e.skipped && Array.isArray(e.sets)) n += e.sets.length;
  }
  return n;
}

function cardioMin(s) {
  let n = 0;
  for (const e of s.entries || []) {
    if (e && e.type === 'cardio' && !e.skipped && typeof e.durationMin === 'number') n += e.durationMin;
  }
  return n;
}

/** 0-3 calm, 4-6 amber, 7-10 warm red. Never used as a warning, only a label. */
function painTone(p) {
  if (typeof p !== 'number') return 'none';
  return p <= 3 ? 'good' : p <= 6 ? 'mid' : 'high';
}

/* --------------------------------------------------------------- lifecycle */

let mountedRoot = null;
/** Remembered in memory only — a fresh app launch starts from the top again. */
let pickedExerciseId = null;

export function mount(rootEl) {
  mountedRoot = rootEl;
  render(rootEl);
  namesReady.then(() => {
    if (mountedRoot === rootEl) render(rootEl);
  });
}

export function unmount() {
  mountedRoot = null;
}

/* ------------------------------------------------------------------ render */

function render(rootEl) {
  const sessions = getSessions();
  const settings = getSettings();
  const unit = settings.weightUnit === 'lb' ? 'lb' : 'kg';

  if (!sessions.length) {
    rootEl.replaceChildren(
      el('div', { class: 'empty-state' }, [
        el('div', { class: 'empty-state-icon' }, ['🌱']),
        el('div', { class: 'empty-state-title' }, ['Your history will grow here.']),
        el('div', { class: 'empty-state-body' }, ["Whenever you're ready."]),
      ])
    );
    return;
  }

  rootEl.replaceChildren(
    statsSection(sessions),
    painSection(sessions),
    bodyWeightSection(unit),
    strengthSection(sessions, unit),
    ...sessionListSections(sessions)
  );
}

/* ---------------------------------------------------- 1. header stats row */

function statsSection(sessions) {
  const weekFrom = weekStartISO();
  const monthPrefix = isoOf(new Date()).slice(0, 7);

  const week = sessions.filter((s) => s.date >= weekFrom).length;
  const month = sessions.filter((s) => String(s.date || '').startsWith(monthPrefix)).length;
  const total = sessions.length;

  const stat = (n, label) =>
    el('div', { class: 'hist-stat' }, [
      el('div', { class: 'hist-stat-num num' }, [String(n)]),
      el('div', { class: 'hist-stat-label' }, [label]),
    ]);

  return el('div', { class: 'card hist-stats' }, [
    stat(week, 'this week'),
    el('div', { class: 'hist-stat-sep', 'aria-hidden': 'true' }),
    stat(month, 'this month'),
    el('div', { class: 'hist-stat-sep', 'aria-hidden': 'true' }),
    stat(total, total === 1 ? 'session total' : 'sessions total'),
  ]);
}

/* --------------------------------------------------------- 2. pain trend */

function painSection(sessions) {
  const from = daysAgoISO(89);
  const points = sessions
    .filter((s) => typeof s.painLevel === 'number' && s.date >= from)
    .map((s) => ({ x: parseISO(s.date)?.getTime(), y: s.painLevel }))
    .filter((p) => isFinite(p.x));

  return el('section', { class: 'hist-section' }, [
    el('div', { class: 'section-title' }, ['Pain trend']),
    el('div', { class: 'card' }, [
      el('div', { class: 'hist-sub' }, ['Lower is better — look at the arc, not the dots.']),
      lineChart({
        points,
        height: 150,
        yMin: 0,
        yMax: 10,
        color: 'var(--pain)',
        ariaLabel: 'Pain level per session over the last 90 days',
        formatY: (v) => String(Math.round(v)),
        emptyMessage: "Not enough data yet — that's fine.",
      }),
    ]),
  ]);
}

/* -------------------------------------------------------- 3. body weight */

function bodyWeightSection(unit) {
  const from = daysAgoISO(179);
  const rows = getBodyWeights().filter((w) => w && typeof w.kg === 'number' && w.date >= from);

  const body = rows.length
    ? lineChart({
        points: rows
          .map((w) => ({ x: parseISO(w.date)?.getTime(), y: toDisplayWeight(w.kg, unit) }))
          .filter((p) => isFinite(p.x)),
        height: 150,
        yLabel: unitLabel(unit),
        color: 'var(--accent)',
        ariaLabel: 'Body weight over the last 180 days',
      })
    : el('div', { class: 'hist-ghost' }, ['Log your weight from Home to see the trend here.']);

  return el('section', { class: 'hist-section' }, [
    el('div', { class: 'section-title' }, ['Body weight']),
    el('div', { class: 'card' }, [body]),
  ]);
}

/* ------------------------------------------------ 4. strength progression */

/**
 * Build { exerciseId -> { points, lastUsed } } from every strength/core entry
 * that recorded at least one weighted set. One point per session: the top set.
 */
function strengthSeries(sessions) {
  const map = new Map();
  for (const s of sessions) {
    const ts = parseISO(s.date)?.getTime();
    if (!isFinite(ts)) continue;
    for (const e of s.entries || []) {
      if (!e || e.skipped) continue;
      if (e.type !== 'strength' && e.type !== 'core') continue;
      if (!Array.isArray(e.sets) || !e.sets.length) continue;
      let top = null;
      for (const set of e.sets) {
        if (set && typeof set.weight === 'number' && isFinite(set.weight)) {
          top = top === null ? set.weight : Math.max(top, set.weight);
        }
      }
      if (top === null) continue;
      let rec = map.get(e.exerciseId);
      if (!rec) map.set(e.exerciseId, (rec = { points: [], lastUsed: 0 }));
      rec.points.push({ x: ts, y: top });
      rec.lastUsed = Math.max(rec.lastUsed, ts);
    }
  }
  return map;
}

function strengthSection(sessions, unit) {
  const series = strengthSeries(sessions);
  const ids = [...series.keys()].sort((a, b) => series.get(b).lastUsed - series.get(a).lastUsed);

  const wrap = el('section', { class: 'hist-section' }, [
    el('div', { class: 'section-title' }, ['Strength']),
  ]);

  if (!ids.length) {
    wrap.appendChild(
      el('div', { class: 'card' }, [
        el('div', { class: 'hist-ghost' }, ['Log a few weighted sets and the progression shows up here.']),
      ])
    );
    return wrap;
  }

  if (!pickedExerciseId || !series.has(pickedExerciseId)) pickedExerciseId = ids[0];

  const chartHost = el('div', { class: 'hist-chart-host' });
  const picker = el('div', { class: 'hist-picker' });

  const drawChart = () => {
    const rec = series.get(pickedExerciseId);
    const points = rec.points.map((p) => ({ x: p.x, y: toDisplayWeight(p.y, unit) }));
    chartHost.replaceChildren(
      el('div', { class: 'hist-sub' }, ['Top set each session — ' + exName(pickedExerciseId) + '.']),
      lineChart({
        points,
        height: 150,
        yLabel: unitLabel(unit),
        color: 'var(--accent)',
        ariaLabel: 'Top set weight over time for ' + exName(pickedExerciseId),
      })
    );
  };

  for (const id of ids) {
    const chip = el(
      'button',
      {
        type: 'button',
        class: 'chip hist-chip',
        'aria-pressed': id === pickedExerciseId ? 'true' : 'false',
        onclick: () => {
          pickedExerciseId = id;
          for (const c of picker.querySelectorAll('.hist-chip')) {
            c.setAttribute('aria-pressed', c === chip ? 'true' : 'false');
          }
          drawChart();
        },
      },
      [exName(id)]
    );
    picker.appendChild(chip);
  }

  drawChart();
  wrap.appendChild(el('div', { class: 'card' }, [picker, chartHost]));
  return wrap;
}

/* ------------------------------------------------------- 5. session list */

function sessionListSections(sessions) {
  const newest = sessions.slice().reverse();
  const out = [];
  let currentKey = null;
  let currentCard = null;

  for (const s of newest) {
    const d = parseISO(s.date);
    const key = s.date ? String(s.date).slice(0, 7) : 'unknown';
    if (key !== currentKey) {
      currentKey = key;
      const title = d ? `${MONTHS[d.getMonth()]} ${d.getFullYear()}` : 'Earlier';
      currentCard = el('div', { class: 'card card--flush' });
      out.push(el('section', { class: 'hist-section' }, [
        el('div', { class: 'section-title' }, [title]),
        currentCard,
      ]));
    }
    currentCard.appendChild(sessionRow(s, d));
  }
  return out;
}

function sessionRow(s, d) {
  const mins = durationMin(s);
  const sets = setCount(s);
  const cardio = cardioMin(s);

  const subParts = [];
  if (mins) subParts.push(mins + ' min');
  if (sets) subParts.push(sets + (sets === 1 ? ' set' : ' sets'));
  if (!sets && cardio) subParts.push(cardio + ' min cardio');

  const badges = [];
  if (s.variant === 'pain') badges.push(el('span', { class: 'badge badge--pain' }, ['Pain day']));
  if (s.dayLabel) badges.push(el('span', { class: 'badge' }, ['Day ' + s.dayLabel]));

  return el(
    'button',
    { type: 'button', class: 'list-row hist-row', onclick: () => openDetail(s) },
    [
      el('div', { class: 'hist-row-date num' }, [d ? `${DAYS[d.getDay()]} ${d.getDate()}` : '—']),
      el('div', { class: 'list-row-main' }, [
        el('div', { class: 'list-row-title hist-row-title' }, [
          el('span', {}, [s.routineName || 'Session']),
          ...badges,
        ]),
        subParts.length ? el('div', { class: 'list-row-sub' }, [subParts.join(' · ')]) : null,
      ]),
      el('div', { class: 'list-row-end' }, [painDot(s.painLevel)]),
    ]
  );
}

function painDot(p) {
  if (typeof p !== 'number') return el('span', { class: 'hist-pain hist-pain--none' }, ['–']);
  return el(
    'span',
    { class: 'hist-pain hist-pain--' + painTone(p), title: 'Pain ' + p + ' of 10' },
    [el('span', { class: 'hist-pain-dot', 'aria-hidden': 'true' }), el('span', { class: 'num' }, [String(p)])]
  );
}

/* ------------------------------------------------------------ detail sheet */

function openDetail(s) {
  const unit = getSettings().weightUnit === 'lb' ? 'lb' : 'kg';
  const d = parseISO(s.date);
  const mins = durationMin(s);

  const meta = [];
  if (s.variant === 'pain') meta.push(el('span', { class: 'badge badge--pain' }, ['Pain day']));
  if (s.dayLabel) meta.push(el('span', { class: 'badge' }, ['Day ' + s.dayLabel]));
  if (typeof s.painLevel === 'number') {
    meta.push(el('span', { class: 'badge' }, ['Pain ' + s.painLevel + '/10']));
  }
  if (mins) meta.push(el('span', { class: 'badge' }, [mins + ' min']));

  const body = el('div', { class: 'hist-detail' }, [
    el('div', { class: 'sheet-title' }, [s.routineName || 'Session']),
    el('div', { class: 'hist-detail-date' }, [
      d ? `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : s.date || '',
    ]),
    meta.length ? el('div', { class: 'hist-detail-meta' }, meta) : null,
    ...entryLines(s, unit),
  ]);

  if (s.note) {
    body.appendChild(
      el('div', { class: 'hist-note' }, [
        el('div', { class: 'hist-note-label' }, ['Note']),
        el('div', {}, [s.note]),
      ])
    );
  }

  body.appendChild(
    el('button', { type: 'button', class: 'btn btn--ghost btn--block hist-close', 'data-sheet-close': true }, ['Close'])
  );

  openSheet(body);
}

/**
 * One node per logged entry, in the order the user did them. Stretch and
 * warm-up items collapse into a single summary line each, at the position of
 * their first occurrence — nine separate stretch rows would bury the session.
 */
function entryLines(s, unit) {
  const entries = (s.entries || []).filter(Boolean);
  const groups = { stretch: { done: 0, skipped: 0 }, warmup: { done: 0, skipped: 0 } };
  for (const e of entries) {
    const g = groups[e.type];
    if (!g) continue;
    if (e.skipped) g.skipped += 1;
    else if (e.completed !== false) g.done += 1;
  }

  const emitted = { stretch: false, warmup: false };
  const out = [];

  for (const e of entries) {
    if (e.type === 'stretch' || e.type === 'warmup') {
      if (emitted[e.type]) continue;
      emitted[e.type] = true;
      const g = groups[e.type];
      const label = e.type === 'stretch' ? 'Stretch sequence' : 'Movement prep';
      const bits = [];
      if (g.done) bits.push(g.done + ' done');
      if (g.skipped) bits.push(g.skipped + ' skipped');
      out.push(entryNode(label, [bits.join(' · ') || 'skipped'], !g.done));
      continue;
    }

    const name = exName(e.exerciseId);
    // ↺ rather than ↷: the latter renders as a near-invisible hook at 13px in
    // the system UI font, and ↺ has no emoji presentation variant to fight.
    const swap = e.swappedFrom ? '↺ swapped from ' + exName(e.swappedFrom) : null;

    if (e.skipped) {
      out.push(entryNode(name, ['skipped'], true, swap));
      continue;
    }

    if (e.type === 'cardio') {
      const bits = [];
      if (typeof e.durationMin === 'number') bits.push(e.durationMin + ' min');
      if (e.intensity) bits.push(String(e.intensity));
      if (typeof e.kcal === 'number') bits.push(e.kcal + ' kcal');
      out.push(entryNode(name, [bits.join(' · ') || 'done'], false, swap));
      continue;
    }

    out.push(entryNode(name, setLines(e.sets, unit), false, swap));
  }

  return out;
}

/**
 * Collapse a set list to as few lines as possible:
 *   identical sets  -> "3 × 60 kg × 10"  /  "3 × 30s"
 *   mixed sets      -> one line each
 */
function setLines(sets, unit) {
  const list = Array.isArray(sets) ? sets.filter(Boolean) : [];
  if (!list.length) return ['done'];

  const holds = list.filter((x) => typeof x.holdSec === 'number');
  if (holds.length === list.length) {
    const same = holds.every((x) => x.holdSec === holds[0].holdSec);
    return same ? [`${holds.length} × ${holds[0].holdSec}s`] : holds.map((x) => `${x.holdSec}s`);
  }

  const describe = (x) => {
    const w = typeof x.weight === 'number' ? fmtWeight(x.weight, unit) : null;
    const r = typeof x.reps === 'number' ? x.reps : null;
    if (w && r !== null) return `${w} × ${r}`;
    if (w) return w;
    if (r !== null) return `${r} reps`;
    return 'done';
  };

  const first = describe(list[0]);
  if (list.every((x) => describe(x) === first)) return [`${list.length} × ${first}`];
  return list.map(describe);
}

/**
 * `swapText` is kept out of the numeric font: the rounded numeral face renders
 * the arrow glyph badly, and a swap note is prose, not a readout.
 */
function entryNode(title, subLines, dim, swapText) {
  return el('div', { class: 'hist-entry' + (dim ? ' is-dim' : '') }, [
    el('div', { class: 'hist-entry-title' }, [title]),
    swapText ? el('div', { class: 'hist-entry-swap' }, [swapText]) : null,
    ...subLines.filter(Boolean).map((t) => el('div', { class: 'hist-entry-sub num' }, [t])),
  ]);
}
