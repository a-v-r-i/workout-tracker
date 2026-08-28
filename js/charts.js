/**
 * charts.js — tiny inline-SVG charting. No libraries, no canvas, no deps.
 *
 * Everything is drawn into a fixed viewBox and scaled to 100% width, so the
 * charts stay crisp at any phone size without a resize listener.
 *
 * Colors come from the CSS custom properties in css/style.css. They are applied
 * through inline `style` (not presentation attributes) because `var()` is only
 * reliably resolved in a style declaration.
 *
 * Exports:
 *   lineChart(opts)  -> SVGElement, OR an HTMLDivElement.empty-state when
 *                       `points` is empty. Callers that care can test with
 *                       `node instanceof SVGElement` / `node.tagName === 'svg'`.
 *   sparkline(opts)  -> SVGElement (or a tiny empty <svg> for no points)
 */

const NS = 'http://www.w3.org/2000/svg';

/** viewBox width every chart is authored against. */
const VBW = 320;

/** Tiny createElementNS wrapper: svg('circle', { cx: 4, r: 2 }). */
function svg(tag, attrs = {}, style = null) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    node.setAttribute(k, String(v));
  }
  if (style) Object.assign(node.style, style);
  return node;
}

/* ------------------------------------------------------------------ helpers */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "12 Aug" — short enough to fit four ticks across 320 units. */
function defaultFormatX(ts) {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Trims pointless decimals: 60 -> "60", 62.5 -> "62.5", 62.46 -> "62.5". */
function defaultFormatY(v) {
  if (!isFinite(v)) return '';
  const rounded = Math.round(v * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** Keep only finite {x, y} pairs, sorted by x. Never mutates the input. */
function clean(points) {
  return (Array.isArray(points) ? points : [])
    .filter((p) => p && isFinite(p.x) && isFinite(p.y))
    .map((p) => ({ x: Number(p.x), y: Number(p.y) }))
    .sort((a, b) => a.x - b.x);
}

/**
 * Pick up to `max` evenly spread indices from a list of length n.
 * Always includes the first and last so the axis spans the real range.
 */
function tickIndices(n, max = 4) {
  if (n <= max) return Array.from({ length: n }, (_, i) => i);
  const out = [];
  for (let i = 0; i < max; i++) out.push(Math.round((i * (n - 1)) / (max - 1)));
  return [...new Set(out)];
}

function emptyState(msg) {
  const wrap = document.createElement('div');
  wrap.className = 'empty-state';
  const body = document.createElement('div');
  body.className = 'empty-state-body';
  body.textContent = msg || "Not enough data yet — that's fine.";
  wrap.appendChild(body);
  return wrap;
}

/* ---------------------------------------------------------------- lineChart */

/**
 * @param {object}   o
 * @param {{x:number,y:number}[]} o.points   x = epoch ms, y = value
 * @param {number}  [o.height=160]           height in viewBox units
 * @param {?number} [o.yMin=null]            hard lower bound (pain: 0)
 * @param {?number} [o.yMax=null]            hard upper bound (pain: 10)
 * @param {number}  [o.yDomainPad=0.12]      fraction of range added above/below
 *                                           when a bound is not pinned
 * @param {string}  [o.yLabel=""]            unit suffix drawn under the y-axis
 * @param {string}  [o.color="var(--accent)"]
 * @param {string}  [o.emptyMessage]
 * @param {function}[o.formatX]              (epochMs) => string
 * @param {function}[o.formatY]              (value)   => string
 * @param {string}  [o.ariaLabel]
 * @returns {SVGElement|HTMLDivElement} an <svg>, or .empty-state for 0 points
 */
export function lineChart({
  points,
  height = 160,
  yMin = null,
  yMax = null,
  yDomainPad = 0.12,
  yLabel = '',
  color = 'var(--accent)',
  emptyMessage = null,
  formatX = defaultFormatX,
  formatY = defaultFormatY,
  ariaLabel = '',
} = {}) {
  const pts = clean(points);
  if (!pts.length) return emptyState(emptyMessage);

  // Room for the y labels on the left and one line of x labels underneath.
  // A unit caption needs its own line above the plot, or it lands on top of
  // the max gridline label.
  const padL = 34;
  const padR = 8;
  const padT = yLabel ? 22 : 10;
  const padB = 20;
  const w = VBW - padL - padR;
  const h = height - padT - padB;

  /* ---- y domain */
  const ys = pts.map((p) => p.y);
  let lo = yMin === null || yMin === undefined ? Math.min(...ys) : yMin;
  let hi = yMax === null || yMax === undefined ? Math.max(...ys) : yMax;
  if (lo === hi) {
    // A flat series (or a single point) still deserves a readable band.
    const bump = Math.max(Math.abs(lo) * 0.1, 1);
    if (yMin === null || yMin === undefined) lo -= bump;
    if (yMax === null || yMax === undefined) hi += bump;
    if (lo === hi) hi = lo + 1;
  } else {
    const pad = (hi - lo) * yDomainPad;
    if (yMin === null || yMin === undefined) lo -= pad;
    if (yMax === null || yMax === undefined) hi += pad;
  }

  /* ---- x domain */
  const xs = pts.map((p) => p.x);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const single = pts.length === 1 || x1 === x0;

  const sx = (x) => (single ? padL + w / 2 : padL + ((x - x0) / (x1 - x0)) * w);
  const sy = (y) => padT + h - ((y - lo) / (hi - lo)) * h;

  const root = svg('svg', {
    viewBox: `0 0 ${VBW} ${height}`,
    preserveAspectRatio: 'xMidYMid meet',
    role: 'img',
    'aria-label': ariaLabel || 'Trend chart',
    class: 'chart',
  }, { width: '100%', height: 'auto', display: 'block', overflow: 'visible' });

  /* ---- gridlines + y labels (min / mid / max) */
  const gridVals = [lo, (lo + hi) / 2, hi];
  for (const v of gridVals) {
    const y = sy(v);
    root.appendChild(
      svg('line', { x1: padL, x2: padL + w, y1: y, y2: y, 'stroke-width': 1 },
        { stroke: 'var(--border)' })
    );
    const t = svg('text', {
      x: padL - 6,
      y,
      'text-anchor': 'end',
      'dominant-baseline': 'middle',
      'font-size': 10,
    }, { fill: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' });
    t.textContent = formatY(v);
    root.appendChild(t);
  }

  if (yLabel) {
    const t = svg('text', { x: padL - 6, y: 9, 'text-anchor': 'end', 'font-size': 9 },
      { fill: 'var(--text-tertiary)' });
    t.textContent = yLabel;
    root.appendChild(t);
  }

  /* ---- the line itself */
  if (!single && pts.length > 1) {
    root.appendChild(
      svg('polyline', {
        points: pts.map((p) => `${sx(p.x).toFixed(2)},${sy(p.y).toFixed(2)}`).join(' '),
        fill: 'none',
        'stroke-width': 2,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      }, { stroke: color })
    );
  }

  /* ---- dots */
  for (const p of pts) {
    root.appendChild(
      svg('circle', { cx: sx(p.x).toFixed(2), cy: sy(p.y).toFixed(2), r: single ? 4 : 2.6 },
        { fill: color })
    );
  }

  /* ---- x axis */
  if (single) {
    // One reading: label it inline, since a two-point axis would be misleading.
    const p = pts[0];
    const label = svg('text', {
      x: sx(p.x),
      y: Math.max(padT + 10, sy(p.y) - 9),
      'text-anchor': 'middle',
      'font-size': 11,
    }, { fill: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' });
    label.textContent = formatY(p.y);
    root.appendChild(label);

    const t = svg('text', { x: sx(p.x), y: height - 5, 'text-anchor': 'middle', 'font-size': 10 },
      { fill: 'var(--text-tertiary)' });
    t.textContent = formatX(p.x);
    root.appendChild(t);
  } else {
    const idx = tickIndices(pts.length, 4);
    for (const i of idx) {
      const p = pts[i];
      const x = sx(p.x);
      const anchor = i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle';
      const t = svg('text', {
        x: anchor === 'start' ? padL : anchor === 'end' ? padL + w : x,
        y: height - 5,
        'text-anchor': anchor,
        'font-size': 10,
      }, { fill: 'var(--text-tertiary)' });
      t.textContent = formatX(p.x);
      root.appendChild(t);
    }
  }

  return root;
}

/* ---------------------------------------------------------------- sparkline */

/**
 * Axis-free micro-line, for inline use next to a label.
 * @param {{points:{x:number,y:number}[], width?:number, height?:number, color?:string}} o
 * @returns {SVGElement}
 */
export function sparkline({ points, width = 72, height = 24, color = 'var(--accent)' } = {}) {
  const pts = clean(points);
  const root = svg('svg', {
    viewBox: `0 0 ${width} ${height}`,
    width,
    height,
    'aria-hidden': 'true',
    class: 'sparkline',
  }, { display: 'block', overflow: 'visible' });
  if (!pts.length) return root;

  const pad = 3;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  let lo = Math.min(...ys);
  let hi = Math.max(...ys);
  if (lo === hi) { lo -= 1; hi += 1; }

  const sx = (x) => (x1 === x0 ? pad + w / 2 : pad + ((x - x0) / (x1 - x0)) * w);
  const sy = (y) => pad + h - ((y - lo) / (hi - lo)) * h;

  if (pts.length > 1) {
    root.appendChild(
      svg('polyline', {
        points: pts.map((p) => `${sx(p.x).toFixed(2)},${sy(p.y).toFixed(2)}`).join(' '),
        fill: 'none',
        'stroke-width': 1.6,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      }, { stroke: color })
    );
  }
  const last = pts[pts.length - 1];
  root.appendChild(svg('circle', { cx: sx(last.x).toFixed(2), cy: sy(last.y).toFixed(2), r: 2 }, { fill: color }));
  return root;
}
