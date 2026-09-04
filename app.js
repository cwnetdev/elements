/* app.js — views, search, filtering, detail sheet. */

const $ = sel => document.querySelector(sel);
const el = (tag, props = {}, kids = []) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null) continue;
    if (k === 'class') n.className = v;
    else if (k === 'style') n.setAttribute('style', v);
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  for (const kid of [].concat(kids)) if (kid) n.appendChild(kid);
  return n;
};

/* ---------- persistence (degrades quietly if storage is unavailable) ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem('pt.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('pt.' + k, JSON.stringify(v)); } catch { /* private mode */ } }
};

/* ---------- state ---------- */
const state = {
  view: store.get('view', 'table'),
  query: '',
  paint: store.get('paint', 'category'),
  sortKey: store.get('sortKey', 'mass'),
  sortDir: store.get('sortDir', 1),
  rulerKey: store.get('rulerKey', 'mass'),
  rulerZoom: 1,
  plotX: store.get('plotX', 'z'),
  plotY: store.get('plotY', 'mass'),
  temp: store.get('temp', 298),
  zoomTable: store.get('zoomTable', false),
  filters: { cats: new Set(store.get('f.cats', [])), classes: new Set(store.get('f.classes', [])), blocks: new Set(store.get('f.blocks', [])) },
  selected: null,
  bondBase: store.get('bondBase', 11)
};

const NUMERIC = {
  z: { label: 'Atomic number', unit: '', dp: 0 },
  mass: { label: 'Atomic mass', unit: 'u', dp: 3 },
  en: { label: 'Electronegativity', unit: '', dp: 2 },
  melt: { label: 'Melting point', unit: 'K', dp: 0 },
  boil: { label: 'Boiling point', unit: 'K', dp: 0 },
  density: { label: 'Density', unit: 'g/cm³', dp: 3 },
  year: { label: 'Year identified', unit: '', dp: 0 },
  group: { label: 'Group', unit: '', dp: 0 },
  period: { label: 'Period', unit: '', dp: 0 }
};

const fmt = (v, dp = 3) => v == null ? '—' : (Math.abs(v) >= 1000 || dp === 0 ? Math.round(v).toLocaleString() : v.toFixed(dp).replace(/\.?0+$/, ''));
const fmtYear = y => y == null ? '—' : y < 0 ? `${Math.abs(y).toLocaleString()} BCE` : String(y);

/* ---------- search ---------- */
const FIELD_WORDS = { mass: 'mass', weight: 'mass', z: 'z', number: 'z', en: 'en', electronegativity: 'en', mp: 'melt', melt: 'melt', melting: 'melt', bp: 'boil', boil: 'boil', boiling: 'boil', density: 'density', year: 'year', group: 'group', period: 'period' };
const CLASS_WORDS = {
  metal: e => e.metallic === 'metal', metals: e => e.metallic === 'metal',
  nonmetal: e => e.metallic === 'nonmetal', nonmetals: e => e.metallic === 'nonmetal',
  metalloid: e => e.metallic === 'metalloid', metalloids: e => e.metallic === 'metalloid',
  radioactive: e => e.radioactive, synthetic: e => e.synthetic, natural: e => !e.synthetic,
  gas: e => phaseAt(e, state.temp) === 'gas', liquid: e => phaseAt(e, state.temp) === 'liquid', solid: e => phaseAt(e, state.temp) === 'solid',
  alkali: e => e.category === 'alkali', halogen: e => e.category === 'halogen', halogens: e => e.category === 'halogen',
  noble: e => e.category === 'noble', transition: e => e.category === 'transition',
  lanthanide: e => e.category === 'lanthanide', actinide: e => e.category === 'actinide',
  alloy: e => e.metallic === 'metal', alloys: e => e.metallic === 'metal'
};

function parseQuery(q) {
  const out = { terms: [], preds: [], target: null, targetKey: 'mass', raw: q.trim() };
  if (!out.raw) return out;
  const tokens = out.raw.toLowerCase().match(/[a-z]+\s*(?:>=|<=|[<>=~])\s*-?[\d.]+|\S+/g) || [];
  for (const tok of tokens) {
    const cmp = tok.match(/^([a-z]+)\s*(>=|<=|[<>=~])\s*(-?[\d.]+)$/);
    if (cmp && FIELD_WORDS[cmp[1]]) {
      const key = FIELD_WORDS[cmp[1]], op = cmp[2], v = parseFloat(cmp[3]);
      out.preds.push(e => {
        const x = e[key];
        if (x == null) return false;
        return op === '>' ? x > v : op === '<' ? x < v : op === '>=' ? x >= v : op === '<=' ? x <= v : op === '~' ? Math.abs(x - v) <= Math.max(0.5, v * 0.02) : Math.abs(x - v) < 1e-9;
      });
      if (op === '~' || op === '=') { out.target = v; out.targetKey = key; }
      continue;
    }
    if (CLASS_WORDS[tok]) { out.preds.push(CLASS_WORDS[tok]); continue; }
    if (/^-?[\d.]+$/.test(tok)) { out.target = parseFloat(tok); out.terms.push(tok); continue; }
    out.terms.push(tok);
  }
  return out;
}

function textMatch(e, term) {
  return e.name.toLowerCase().startsWith(term) || e.symbol.toLowerCase() === term ||
    e.symbol.toLowerCase().startsWith(term) || e.name.toLowerCase().includes(term) ||
    String(e.z) === term || CATEGORIES[e.category].label.toLowerCase().includes(term);
}

function passesFilters(e) {
  const f = state.filters;
  if (f.cats.size && !f.cats.has(e.category)) return false;
  if (f.blocks.size && !f.blocks.has(e.block)) return false;
  for (const c of f.classes) if (!CLASS_WORDS[c](e)) return false;
  return true;
}

function currentSet() {
  const q = parseQuery(state.query);
  const pool = ELEMENTS.filter(passesFilters);
  let hits = pool.filter(e => {
    if (!q.preds.every(p => p(e))) return false;
    if (q.terms.length && !q.terms.every(t => textMatch(e, t))) return false;
    return true;
  });

  // A number nobody matches exactly still has an answer: the closest ones.
  let nearest = null;
  if (q.target != null && (!hits.length || !Number.isInteger(q.target))) {
    nearest = nearestBy(q.targetKey, q.target, pool);
    if (!hits.length) hits = nearest.map(n => n.e);
  }
  return { q, hits, nearest, hitZ: new Set(hits.map(e => e.z)) };
}

function nearestBy(key, target, pool) {
  return pool.filter(e => e[key] != null)
    .map(e => ({ e, d: Math.abs(e[key] - target) }))
    .sort((a, b) => a.d - b.d).slice(0, 3);
}

/* ---------- colour ---------- */
const RAMP = ['#D6CDA4', '#9DAE84', '#5E9086', '#3B6E8C', '#3D4A72'];
function ramp(t) {
  t = Math.max(0, Math.min(1, t));
  const s = t * (RAMP.length - 1), i = Math.min(RAMP.length - 2, Math.floor(s)), f = s - i;
  const hex = h => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16));
  const a = hex(RAMP[i]), b = hex(RAMP[i + 1]);
  return '#' + a.map((v, k) => Math.round(v + (b[k] - v) * f).toString(16).padStart(2, '0')).join('');
}

const PHASE_COLOR = { solid: '#6E7B8B', liquid: '#3F7A76', gas: '#B4552D', unknown: '#B9BEB4' };
const BLOCK_COLOR = { s: '#B4552D', p: '#2F5D7C', d: '#5E7F52', f: '#7A6AA3' };
const CLASS_COLOR = { metal: '#5E7F52', metalloid: '#7A6AA3', nonmetal: '#2F5D7C' };

let rampCache = {};
function colorFor(e) {
  const p = state.paint;
  if (p === 'category') return CATEGORIES[e.category].color;
  if (p === 'block') return BLOCK_COLOR[e.block];
  if (p === 'phase') return PHASE_COLOR[phaseAt(e, state.temp)];
  if (p === 'metallic') return CLASS_COLOR[e.metallic];
  const v = e[p];
  if (v == null) return '#B9BEB4';
  const r = rampCache[p] || (rampCache[p] = (() => {
    const vals = ELEMENTS.map(x => x[p]).filter(x => x != null);
    const log = p === 'density';
    const f = x => log ? Math.log10(x) : x;
    return { min: Math.min(...vals.map(f)), max: Math.max(...vals.map(f)), f };
  })());
  return ramp((r.f(v) - r.min) / (r.max - r.min || 1));
}

/* ---------- cell factory ---------- */
function cellFor(e, opts = {}) {
  const c = el('button', {
    class: 'cell' + (opts.extra ? ' ' + opts.extra : ''),
    style: `--c:${colorFor(e)}` + (opts.style || ''),
    type: 'button',
    'aria-label': `${e.name}, element ${e.z}, mass ${fmt(e.mass)}`,
    'data-z': e.z,
    onclick: () => select(e.z)
  });
  if (opts.showZ !== false) c.appendChild(el('span', { class: 'z num', text: e.z }));
  if (e.radioactive && opts.showZ !== false) c.appendChild(el('span', { class: 'rad', text: '\u26A1', title: 'radioactive' }));
  c.appendChild(el('span', { class: 'sym', text: e.symbol }));
  if (opts.value != null) c.appendChild(el('span', { class: 'val', text: opts.value }));
  if (opts.name) c.appendChild(el('span', { class: 'name', text: e.name }));
  return c;
}

/* ================= views ================= */

function viewTable({ hitZ, q }) {
  const wrap = el('div', { class: 'table-scroll' + (state.zoomTable ? ' zoom' : '') });
  const inner = el('div', { class: 'table-wrap' });
  const main = el('div', { class: 'table' });
  const f = el('div', { class: 'table fblock' });

  for (const e of ELEMENTS) {
    const fBlock = e.row > 7;
    const row = fBlock ? (e.z <= 71 ? 1 : 2) : e.row;
    const dim = q.raw && !hitZ.has(e.z);
    const c = cellFor(e, {
      style: `;--col:${e.col};--row:${row}`,
      extra: (dim ? 'dim ' : '') + (q.raw && hitZ.has(e.z) ? 'hit ' : '') + (state.selected === e.z ? 'active' : ''),
      value: paintValue(e)
    });
    (fBlock ? f : main).appendChild(c);
  }
  inner.append(main, f);
  wrap.appendChild(inner);

  const legend = el('div', { class: 'legend' });
  for (const [key, meta] of Object.entries(CATEGORIES)) {
    legend.appendChild(el('button', {
      class: 'chip', type: 'button', style: `--c:${meta.color}`,
      'aria-pressed': state.filters.cats.has(key),
      html: `<span class="dot"></span>${meta.label}`,
      onclick: () => toggleFilter('cats', key)
    }));
  }
  return el('div', {}, [wrap, legend]);
}

// The small second line inside a cell, when the paint mode is a number worth reading.
function paintValue(e) {
  const p = state.paint;
  if (NUMERIC[p]) return e[p] == null ? '—' : (p === 'year' ? fmtYear(e[p]) : fmt(e[p], NUMERIC[p].dp));
  if (p === 'phase') return phaseAt(e, state.temp).slice(0, 3);
  return null;
}

function viewFlow({ hits }) {
  const key = state.sortKey;
  const sorted = sortSet(hits, key);
  if (!sorted.length) return emptyState();
  const grid = el('div', { class: 'flow' });
  for (const e of sorted) {
    grid.appendChild(cellFor(e, {
      value: key === 'name' || key === 'symbol' ? null : (key === 'year' ? fmtYear(e[key]) : fmt(e[key], NUMERIC[key]?.dp ?? 2)),
      name: key === 'name' || key === 'symbol',
      extra: state.selected === e.z ? 'active' : ''
    }));
  }
  return grid;
}

function sortSet(list, key) {
  const dir = state.sortDir;
  return [...list].sort((a, b) => {
    const x = a[key], y = b[key];
    if (typeof x === 'string') return dir * x.localeCompare(y);
    if (x == null) return 1;
    if (y == null) return -1;
    return dir * (x - y);
  });
}

function viewRuler({ hits, q }) {
  const key = state.rulerKey;
  const pool = hits.filter(e => e[key] != null);
  if (!pool.length) return emptyState();

  const meta = NUMERIC[key];
  const useLog = key === 'density';
  const tf = v => useLog ? Math.log10(v) : v;
  let lo = Math.min(...pool.map(e => tf(e[key]))), hi = Math.max(...pool.map(e => tf(e[key])));
  if (q.target != null && q.targetKey === key) { lo = Math.min(lo, tf(q.target)); hi = Math.max(hi, tf(q.target)); }
  if (hi === lo) hi = lo + 1;

  const host = el('div', { style: 'position:relative' });
  const scroll = el('div', { style: 'overflow-x:auto' });
  const board = el('div', { style: `position:relative;width:${100 * state.rulerZoom}%;min-width:100%` });
  const axis = el('div', { class: 'ruler-axis' });
  const lanes = el('div', { class: 'ruler-lanes' });
  board.append(axis, lanes);
  scroll.appendChild(board);
  host.appendChild(scroll);

  // Positions need a measured width, so lay out after the node is in the document.
  requestAnimationFrame(() => {
    const W = board.clientWidth, TW = 46, GAP = 3, LANE = 34;
    const pos = v => (tf(v) - lo) / (hi - lo) * (W - TW) + TW / 2;

    const step = niceStep((hi - lo) / (useLog ? 4 : Math.max(3, Math.round(W / 90))));
    for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) {
      const x = (t - lo) / (hi - lo) * (W - TW) + TW / 2;
      axis.appendChild(el('span', { class: 'tick', style: `left:${x}px`, text: useLog ? fmt(Math.pow(10, t), 3) : fmt(t, meta.dp) }));
    }

    const laneEnd = [];
    const items = [...pool].sort((a, b) => tf(a[key]) - tf(b[key]));
    for (const e of items) {
      const x = pos(e[key]);
      let lane = laneEnd.findIndex(end => x - TW / 2 > end + GAP);
      if (lane < 0) { lane = laneEnd.length; laneEnd.push(0); }
      laneEnd[lane] = x + TW / 2;
      const y = lane * LANE + 8;
      lanes.appendChild(el('div', { class: 'stem', style: `left:${x}px;height:${y}px` }));
      const c = cellFor(e, { showZ: false, extra: state.selected === e.z ? 'active' : '', style: `;left:${x - TW / 2}px;top:${y}px` });
      c.appendChild(el('span', { class: 'val', text: fmt(e[key], meta.dp) }));
      lanes.appendChild(c);
    }
    lanes.style.height = (laneEnd.length * LANE + 20) + 'px';

    if (q.target != null && q.targetKey === key) {
      const x = pos(q.target);
      const line = el('div', { class: 'target-line', style: `left:${x}px` }, [el('span', { text: fmt(q.target, meta.dp) })]);
      board.appendChild(line);
      scroll.scrollLeft = Math.max(0, x - scroll.clientWidth / 2);
    }
  });

  return host;
}

function niceStep(raw) {
  const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(raw) || 1)));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
}

function viewPlot({ hits, hitZ, q }) {
  const kx = state.plotX, ky = state.plotY;
  const pool = ELEMENTS.filter(e => e[kx] != null && e[ky] != null);
  if (!pool.length) return emptyState();

  const W = Math.max(300, $('main').clientWidth - 20);
  const H = Math.min(460, Math.round(W * 0.85));
  const M = { l: 46, r: 12, t: 12, b: 40 };
  const logx = kx === 'density', logy = ky === 'density';
  const fx = v => logx ? Math.log10(v) : v, fy = v => logy ? Math.log10(v) : v;
  const xs = pool.map(e => fx(e[kx])), ys = pool.map(e => fy(e[ky]));
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const px = v => M.l + (fx(v) - x0) / (x1 - x0 || 1) * (W - M.l - M.r);
  const py = v => H - M.b - (fy(v) - y0) / (y1 - y0 || 1) * (H - M.t - M.b);

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'plot');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', W);
  svg.setAttribute('height', H);
  const add = (tag, attrs, text) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text != null) n.textContent = text;
    svg.appendChild(n);
    return n;
  };

  const ticks = (lo, hi, log) => {
    const s = niceStep((hi - lo) / 4), out = [];
    for (let t = Math.ceil(lo / s) * s; t <= hi + 1e-9; t += s) out.push(t);
    return out.map(t => ({ t, label: log ? fmt(Math.pow(10, t), 3) : fmt(t, Math.abs(t) >= 100 ? 0 : 2) }));
  };
  for (const { t, label } of ticks(y0, y1, logy)) {
    const y = H - M.b - (t - y0) / (y1 - y0 || 1) * (H - M.t - M.b);
    add('line', { x1: M.l, x2: W - M.r, y1: y, y2: y, class: 'grid-line' });
    add('text', { x: M.l - 5, y: y + 3, 'text-anchor': 'end' }, label);
  }
  for (const { t, label } of ticks(x0, x1, logx)) {
    const x = M.l + (t - x0) / (x1 - x0 || 1) * (W - M.l - M.r);
    add('line', { x1: x, x2: x, y1: M.t, y2: H - M.b, class: 'grid-line' });
    add('text', { x, y: H - M.b + 13, 'text-anchor': 'middle' }, label);
  }
  add('line', { x1: M.l, x2: M.l, y1: M.t, y2: H - M.b, class: 'axis' });
  add('line', { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b, class: 'axis' });
  add('text', { x: (W + M.l) / 2, y: H - 6, 'text-anchor': 'middle', class: 'axis-title' },
    NUMERIC[kx].label + (logx ? ' (log)' : '') + (NUMERIC[kx].unit ? ` · ${NUMERIC[kx].unit}` : ''));
  add('text', { x: 12, y: (H - M.b + M.t) / 2, 'text-anchor': 'middle', class: 'axis-title', transform: `rotate(-90 12 ${(H - M.b + M.t) / 2})` },
    NUMERIC[ky].label + (logy ? ' (log)' : '') + (NUMERIC[ky].unit ? ` · ${NUMERIC[ky].unit}` : ''));

  const focus = q.raw || state.filters.cats.size || state.filters.classes.size || state.filters.blocks.size;
  for (const e of pool) {
    const on = !focus || hitZ.has(e.z);
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'pt');
    g.setAttribute('tabindex', '0');
    g.setAttribute('role', 'button');
    g.setAttribute('aria-label', `${e.name}: ${fmt(e[kx], 2)}, ${fmt(e[ky], 2)}`);
    const dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('cx', px(e[kx]));
    dot.setAttribute('cy', py(e[ky]));
    dot.setAttribute('r', on ? (state.selected === e.z ? 6 : 4.2) : 2.4);
    dot.setAttribute('fill', colorFor(e));
    dot.setAttribute('opacity', on ? .9 : .16);
    if (state.selected === e.z) { dot.setAttribute('stroke', 'currentColor'); dot.setAttribute('stroke-width', 1.5); }
    g.appendChild(dot);
    const labelled = on && (state.selected === e.z || (focus && hits.length <= 40));
    if (labelled) {
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('class', 'pt-label');
      t.setAttribute('x', px(e[kx]) + 6);
      t.setAttribute('y', py(e[ky]) - 5);
      t.textContent = e.symbol;
      g.appendChild(t);
    }
    g.addEventListener('click', () => select(e.z));
    g.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(e.z); } });
    svg.appendChild(g);
  }
  return svg;
}

function viewList({ hits }) {
  if (!hits.length) return emptyState();
  const cols = [
    ['z', '#'], ['symbol', 'Sym'], ['name', 'Name'], ['mass', 'Mass'],
    ['en', 'EN'], ['melt', 'Melt K'], ['density', 'g/cm³'], ['year', 'Found']
  ];
  const t = el('table', { class: 'data' });
  const head = el('tr');
  for (const [key, label] of cols) {
    head.appendChild(el('th', {
      text: label + (state.sortKey === key ? (state.sortDir > 0 ? ' ↑' : ' ↓') : ''),
      'aria-sort': state.sortKey === key ? (state.sortDir > 0 ? 'ascending' : 'descending') : null,
      onclick: () => {
        if (state.sortKey === key) state.sortDir *= -1; else { state.sortKey = key; state.sortDir = 1; }
        store.set('sortKey', state.sortKey); store.set('sortDir', state.sortDir);
        render();
      }
    }));
  }
  t.appendChild(el('thead', {}, [head]));
  const body = el('tbody');
  for (const e of sortSet(hits, state.sortKey)) {
    body.appendChild(el('tr', { onclick: () => select(e.z), style: `--c:${colorFor(e)}` }, [
      el('td', { class: 'num', text: e.z }),
      el('td', { class: 'sym-cell', html: `<span class="swatch"></span>${e.symbol}` }),
      el('td', { text: e.name }),
      el('td', { class: 'num', text: fmt(e.mass, 3) }),
      el('td', { class: 'num', text: fmt(e.en, 2) }),
      el('td', { class: 'num', text: fmt(e.melt, 0) }),
      el('td', { class: 'num', text: fmt(e.density, 3) }),
      el('td', { class: 'num', text: fmtYear(e.year) })
    ]));
  }
  t.appendChild(body);
  return t;
}

/* ---------- bonding ---------- */
const gcd = (a, b) => b ? gcd(b, a % b) : a;

function predictFormula(cat, an) {
  // Oxidation lists are written most-common-first, so take the first of each sign.
  const pos = cat.oxidation.find(v => v > 0);
  const neg = an.oxidation.find(v => v < 0);
  if (pos == null || neg == null) return null;
  const p = pos, n = -neg, g = gcd(p, n);
  const a = n / g, b = p / g;
  const part = (sym, k) => sym + (k > 1 ? `<sub>${k}</sub>` : '');
  // Convention puts hydrogen second in the group 13-15 hydrides: CH4 and NH3, not H4C and H3N.
  if (cat.symbol === 'H' && [13, 14, 15].includes(an.group)) return part(an.symbol, b) + part(cat.symbol, a);
  return part(cat.symbol, a) + part(an.symbol, b);
}

function bondsFor(base) {
  const groups = {
    ionic: { title: 'Ionic', note: 'Electronegativity gap of 1.7 or more — electrons transfer, giving a salt.', items: [] },
    polar: { title: 'Polar covalent', note: 'Gap between 0.5 and 1.7 — shared electrons, pulled toward one side.', items: [] },
    nonpolar: { title: 'Nonpolar covalent', note: 'Gap under 0.5 between two nonmetals — electrons shared fairly evenly.', items: [] },
    metallic: { title: 'Alloys and intermetallics', note: 'Two metals: no fixed formula, they mix in a shared sea of electrons.', items: [] },
    inert: { title: 'Little or no reaction', note: 'Full outer shells. Under normal conditions these stay out of it.', items: [] }
  };
  for (const p of ELEMENTS) {
    if (p.z === base.z) continue;
    if (!passesFilters(p)) continue;
    const entry = { partner: p, delta: (base.en != null && p.en != null) ? Math.abs(base.en - p.en) : null, formula: null };
    if (base.category === 'noble' || p.category === 'noble') { groups.inert.items.push(entry); continue; }
    if (base.metallic === 'metal' && p.metallic === 'metal') { groups.metallic.items.push(entry); continue; }
    if (entry.delta == null) { continue; }
    const cat = base.en <= p.en ? base : p;
    const an = cat === base ? p : base;
    entry.formula = predictFormula(cat, an);
    (entry.delta >= 1.7 ? groups.ionic : entry.delta >= 0.5 ? groups.polar : groups.nonpolar).items.push(entry);
  }
  for (const g of Object.values(groups)) g.items.sort((a, b) => (b.delta ?? -1) - (a.delta ?? -1));
  return groups;
}

function viewBonds() {
  const base = BY_Z[state.bondBase];
  const host = el('div');
  const head = el('div', { class: 'bond-head' }, [
    cellFor(base, { showZ: true }),
    el('div', {}, [
      el('p', { html: `<strong>${base.name}</strong>` }),
      el('p', { html: `Electronegativity ${fmt(base.en, 2)} · usual charges ${base.oxidation.length ? base.oxidation.map(v => (v > 0 ? '+' : '') + v).join(', ') : 'unknown'}` }),
      el('p', { text: 'Predicted from charge and electronegativity — a starting point, not a guarantee.' })
    ])
  ]);
  host.appendChild(head);

  const picker = el('select', {
    'aria-label': 'Element to pair',
    onchange: e => { state.bondBase = +e.target.value; store.set('bondBase', state.bondBase); render(); }
  });
  for (const e of ELEMENTS) picker.appendChild(el('option', { value: e.z, text: `${e.z} · ${e.name}`, selected: e.z === base.z ? 'selected' : null }));
  host.appendChild(el('div', { class: 'field', style: 'margin-bottom:14px' }, [el('label', { text: 'Pair with' }), picker]));

  const groups = bondsFor(base);
  let any = false;
  for (const g of Object.values(groups)) {
    if (!g.items.length) continue;
    any = true;
    const sec = el('section', { class: 'bond-group' });
    sec.appendChild(el('h3', { html: `${g.title} <span class="num" style="color:var(--ink-3);font-size:11px">${g.items.length}</span>` }));
    sec.appendChild(el('p', { text: g.note }));
    const list = el('div', { class: 'bond-list' });
    for (const it of g.items) {
      list.appendChild(el('button', {
        class: 'bond-item', type: 'button', style: `--c:${colorFor(it.partner)}`,
        onclick: () => select(it.partner.z)
      }, [
        el('div', {}, [
          el('div', { class: 'formula', html: it.formula || `${base.symbol} + ${it.partner.symbol}` }),
          el('div', { class: 'partner', text: it.partner.name })
        ]),
        el('div', { class: 'meta', style: 'margin-left:auto', text: it.delta == null ? '' : 'Δ' + fmt(it.delta, 2) })
      ]));
    }
    sec.appendChild(list);
    host.appendChild(sec);
  }
  if (!any) host.appendChild(emptyState());

  host.appendChild(el('p', { style: 'font-size:11.5px;color:var(--ink-3);max-width:60ch;margin-top:18px', text: 'Formulas come from the usual charges on each element and the Pauling electronegativity gap. They are a first guess at what forms, not a guarantee: real chemistry depends on conditions, and many pairs form several compounds.' }));
  return host;
}

function emptyState() {
  return el('div', { class: 'empty', html: 'Nothing matches. Try a symbol like <code>Fe</code>, a number like <code>55.8</code> to find the nearest mass, or a filter like <code>mass&lt;20</code>, <code>en&gt;3</code>, <code>gas</code>, <code>radioactive</code>.' });
}

/* ================= detail sheet ================= */
function shellDiagram(e) {
  const NS = 'http://www.w3.org/2000/svg';
  const R = 96, cx = R, cy = R;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'shells-fig');
  svg.setAttribute('width', R * 2);
  svg.setAttribute('height', R * 2);
  svg.setAttribute('viewBox', `0 0 ${R * 2} ${R * 2}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Electron shells: ${e.shells.join(', ')}`);
  svg.style.setProperty('--c', colorFor(e));
  const add = (tag, attrs, text) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text != null) n.textContent = text;
    svg.appendChild(n);
  };
  add('circle', { cx, cy, r: 12, class: 'nucleus' });
  add('text', { x: cx, y: cy + 3.5, 'text-anchor': 'middle', fill: 'var(--paper)', style: 'font-size:10px' }, e.symbol);
  const n = e.shells.length;
  e.shells.forEach((count, i) => {
    const r = 20 + (i + 1) * ((R - 26) / n);
    add('circle', { cx, cy, r, class: 'orbit' });
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2 - Math.PI / 2 + i * 0.22;
      add('circle', { cx: cx + r * Math.cos(a), cy: cy + r * Math.sin(a), r: 2.1, class: 'e' });
    }
    add('text', { x: cx + r + 2, y: cy - 3, 'text-anchor': 'start' }, count);
  });
  return svg;
}

function openSheet(e) {
  const body = $('#sheet-body');
  body.textContent = '';
  const ph = phaseAt(e, state.temp);
  body.append(
    el('div', { class: 'el-head' }, [
      cellFor(e, {}),
      el('div', {}, [
        el('h2', { text: e.name }),
        el('div', { class: 'sub', text: `${CATEGORIES[e.category].label} · ${e.block}-block${e.group ? ' · group ' + e.group : ''} · period ${e.period}` }),
        el('div', { class: 'mass num', text: `${fmt(e.mass, 4)} u` })
      ])
    ]),
    (() => {
      const dl = el('dl', { class: 'props' });
      const row = (label, value, isText) => dl.appendChild(el('div', {}, [
        el('dt', { text: label }), el('dd', { class: isText ? 'text' : '', html: value })
      ]));
      row('Atomic number', e.z);
      row('Electron configuration', e.config.replace(/(\d+)([spdf])(\d+)/g, '$1$2<sup>$3</sup>'), true);
      row('Shells', e.shells.join(' · '));
      row('Electronegativity', fmt(e.en, 2));
      row('Usual charges', e.oxidation.length ? e.oxidation.map(v => (v > 0 ? '+' : '') + v).join('  ') : '—');
      row('Melting point', e.melt == null ? '—' : `${fmt(e.melt, 0)} K <span style="color:var(--ink-3)">${fmt(e.melt - 273.15, 0)} °C</span>`);
      row('Boiling point', e.boil == null ? '—' : `${fmt(e.boil, 0)} K <span style="color:var(--ink-3)">${fmt(e.boil - 273.15, 0)} °C</span>`);
      row('Density', e.density == null ? '—' : `${fmt(e.density, 4)} g/cm³`);
      row(`Phase at ${state.temp} K`, ph, true);
      row('Identified', fmtYear(e.year), true);
      row('Stability', e.radioactive ? (e.synthetic ? 'radioactive, made in a lab' : 'radioactive, occurs naturally') : 'stable isotopes exist', true);
      return dl;
    })(),
    shellDiagram(e),
    el('div', { class: 'sheet-actions' }, [
      el('button', {
        class: 'btn primary', type: 'button', text: 'What bonds with this',
        onclick: () => { state.bondBase = e.z; store.set('bondBase', e.z); setView('bonds'); closeSheet(); }
      }),
      el('button', {
        class: 'btn', type: 'button', text: 'Find similar mass',
        onclick: () => { $('#q').value = String(e.mass); state.query = String(e.mass); state.rulerKey = 'mass'; setView('ruler'); closeSheet(); }
      })
    ])
  );
  $('#sheet').classList.add('open');
  $('#scrim').classList.add('open');
  $('#sheet').setAttribute('aria-hidden', 'false');
}

function closeSheet() {
  $('#sheet').classList.remove('open');
  $('#scrim').classList.remove('open');
  $('#sheet').setAttribute('aria-hidden', 'true');
}

function select(z) {
  state.selected = z;
  openSheet(BY_Z[z]);
  document.querySelectorAll('.cell.active').forEach(n => n.classList.remove('active'));
  document.querySelectorAll(`.cell[data-z="${z}"]`).forEach(n => n.classList.add('active'));
}

/* ================= chrome ================= */
function setView(v) {
  state.view = v;
  store.set('view', v);
  document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', t.dataset.view === v));
  render();
}

function toggleFilter(kind, key) {
  const set = state.filters[kind];
  set.has(key) ? set.delete(key) : set.add(key);
  store.set('f.' + kind, [...set]);
  render();
}

function statusText({ q, hits, nearest }) {
  const bits = [];
  if (q.raw) {
    const exact = q.target != null && Number.isInteger(q.target) ? BY_Z[q.target] : null;
    if (exact) bits.push(`element <span class="num">${q.target}</span> is <b>${exact.name}</b>`);
    else bits.push(`<b>${hits.length}</b> match${hits.length === 1 ? '' : 'es'}`);
    if (nearest && nearest.length) {
      const meta = NUMERIC[q.targetKey];
      bits.push(`closest ${meta.label.toLowerCase()} to <span class="num">${fmt(q.target, meta.dp)}</span>: ` +
        nearest.map(({ e, d }) => `<b>${e.symbol}</b> <span class="num">${fmt(e[q.targetKey], meta.dp)}</span> <span style="color:var(--ink-3)">Δ${fmt(d, meta.dp)}</span>`).join(' · '));
    }
  } else {
    const n = hits.length;
    bits.push(n === 118 ? 'All 118 elements' : `<b>${n}</b> of 118 elements`);
    if (state.view === 'sort' || state.view === 'list') bits.push(`sorted by ${NUMERIC[state.sortKey]?.label.toLowerCase() || state.sortKey}, ${state.sortDir > 0 ? 'low to high' : 'high to low'}`);
    if (state.view === 'ruler') bits.push(`spaced by true ${NUMERIC[state.rulerKey].label.toLowerCase()}`);
  }
  return bits.join(' · ');
}

function buildControls() {
  const bar = $('#controls');
  bar.textContent = '';
  const v = state.view;

  const mk = (label, options, value, onChange) => {
    const sel = el('select', { 'aria-label': label, onchange: e => onChange(e.target.value) });
    for (const [val, txt] of options) sel.appendChild(el('option', { value: val, text: txt, selected: String(val) === String(value) ? 'selected' : null }));
    return el('div', { class: 'field' }, [el('label', { text: label }), sel]);
  };

  if (v !== 'bonds') {
    bar.appendChild(mk('Paint', [
      ['category', 'Category'], ['block', 'Orbital block'], ['metallic', 'Metal or not'], ['phase', 'Phase at T'],
      ['mass', 'Atomic mass'], ['en', 'Electronegativity'], ['melt', 'Melting point'], ['density', 'Density'], ['year', 'Year identified']
    ], state.paint, val => { state.paint = val; store.set('paint', val); render(); }));
  }

  if (v === 'sort' || v === 'list') {
    bar.appendChild(mk('Order by', [
      ['z', 'Atomic number'], ['mass', 'Atomic mass'], ['en', 'Electronegativity'], ['melt', 'Melting point'],
      ['boil', 'Boiling point'], ['density', 'Density'], ['year', 'Year identified'], ['name', 'Name'], ['period', 'Period']
    ], state.sortKey, val => { state.sortKey = val; store.set('sortKey', val); render(); }));
    bar.appendChild(el('button', {
      class: 'chip', type: 'button', text: state.sortDir > 0 ? 'Low to high' : 'High to low',
      onclick: () => { state.sortDir *= -1; store.set('sortDir', state.sortDir); render(); }
    }));
  }

  if (v === 'ruler') {
    bar.appendChild(mk('Spread by', [
      ['mass', 'Atomic mass'], ['z', 'Atomic number'], ['en', 'Electronegativity'],
      ['melt', 'Melting point'], ['boil', 'Boiling point'], ['density', 'Density'], ['year', 'Year identified']
    ], state.rulerKey, val => { state.rulerKey = val; store.set('rulerKey', val); render(); }));
    bar.appendChild(mk('Stretch', [[1, '1×'], [2, '2×'], [4, '4×'], [8, '8×']], state.rulerZoom, val => { state.rulerZoom = +val; render(); }));
  }

  if (v === 'plot') {
    const opts = Object.entries(NUMERIC).map(([k, m]) => [k, m.label]);
    bar.appendChild(mk('Across', opts, state.plotX, val => { state.plotX = val; store.set('plotX', val); render(); }));
    bar.appendChild(mk('Up', opts, state.plotY, val => { state.plotY = val; store.set('plotY', val); render(); }));
  }

  if (v === 'table') {
    bar.appendChild(el('button', {
      class: 'chip', type: 'button', 'aria-pressed': state.zoomTable, text: state.zoomTable ? 'Large cells' : 'Fit to screen',
      onclick: () => { state.zoomTable = !state.zoomTable; store.set('zoomTable', state.zoomTable); render(); }
    }));
  }

  const active = state.filters.cats.size + state.filters.classes.size + state.filters.blocks.size;
  bar.appendChild(el('button', {
    class: 'chip', type: 'button', 'aria-pressed': $('#drawer').classList.contains('open'),
    text: active ? `Filters · ${active}` : 'Filters',
    onclick: () => { $('#drawer').classList.toggle('open'); render(); }
  }));
  if (active) bar.appendChild(el('button', {
    class: 'chip', type: 'button', text: 'Clear',
    onclick: () => { state.filters = { cats: new Set(), classes: new Set(), blocks: new Set() }; store.set('f.cats', []); store.set('f.classes', []); store.set('f.blocks', []); render(); }
  }));

  $('#thermo').classList.toggle('show', state.paint === 'phase' || state.filters.classes.has('gas') || state.filters.classes.has('liquid') || state.filters.classes.has('solid'));
}

function buildDrawer() {
  const d = $('#drawer');
  if (!d.classList.contains('open')) return;
  d.textContent = '';
  const section = (title, kind, entries) => {
    d.appendChild(el('h3', { text: title }));
    const wrap = el('div', { class: 'chips' });
    for (const [key, label, color] of entries) {
      wrap.appendChild(el('button', {
        class: 'chip', type: 'button', style: color ? `--c:${color}` : null,
        'aria-pressed': state.filters[kind].has(key),
        html: (color ? '<span class="dot"></span>' : '') + label,
        onclick: () => toggleFilter(kind, key)
      }));
    }
    d.appendChild(wrap);
  };
  section('Family', 'cats', Object.entries(CATEGORIES).map(([k, m]) => [k, m.label, m.color]));
  section('Behaves like', 'classes', [
    ['metal', 'Metal'], ['metalloid', 'Metalloid'], ['nonmetal', 'Nonmetal'],
    ['solid', 'Solid at T'], ['liquid', 'Liquid at T'], ['gas', 'Gas at T'],
    ['radioactive', 'Radioactive'], ['synthetic', 'Lab-made'], ['natural', 'Found in nature']
  ]);
  section('Outer orbital', 'blocks', [['s', 's'], ['p', 'p'], ['d', 'd'], ['f', 'f']]);
}

/* ================= render ================= */
function render() {
  const set = currentSet();
  buildControls();
  buildDrawer();
  $('#status').innerHTML = statusText(set);
  const main = $('main');
  main.textContent = '';
  const v = state.view;
  main.appendChild(
    v === 'table' ? viewTable(set) :
    v === 'sort' ? viewFlow(set) :
    v === 'ruler' ? viewRuler(set) :
    v === 'plot' ? viewPlot(set) :
    v === 'list' ? viewList(set) :
    viewBonds()
  );
  if (state.selected) document.querySelectorAll(`.cell[data-z="${state.selected}"]`).forEach(n => n.classList.add('active'));
}

/* ================= wiring ================= */
function init() {
  const tabs = [['table', 'Table'], ['sort', 'Sorted'], ['ruler', 'Ruler'], ['plot', 'Plot'], ['bonds', 'Bonds'], ['list', 'List']];
  const bar = $('#tabs');
  for (const [v, label] of tabs) {
    bar.appendChild(el('button', {
      class: 'tab', type: 'button', role: 'tab', 'data-view': v,
      'aria-selected': state.view === v, text: label,
      onclick: () => setView(v)
    }));
  }

  const input = $('#q');
  let t;
  input.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => { state.query = input.value; $('#clear').style.visibility = input.value ? 'visible' : 'hidden'; render(); }, 90);
  });
  $('#clear').addEventListener('click', () => { input.value = ''; state.query = ''; $('#clear').style.visibility = 'hidden'; input.focus(); render(); });

  const temp = $('#temp');
  temp.value = state.temp;
  const showTemp = () => { $('#tempOut').textContent = `${state.temp} K · ${Math.round(state.temp - 273.15)} °C`; };
  temp.addEventListener('input', () => { state.temp = +temp.value; store.set('temp', state.temp); showTemp(); render(); });
  showTemp();
  document.querySelectorAll('[data-temp]').forEach(b => b.addEventListener('click', () => {
    state.temp = +b.dataset.temp; temp.value = state.temp; store.set('temp', state.temp); showTemp(); render();
  }));

  $('#scrim').addEventListener('click', closeSheet);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeSheet(); }
    if (e.key === '/' && document.activeElement !== input) { e.preventDefault(); input.focus(); }
  });

  // swipe the sheet down to dismiss
  let y0 = null;
  const sheet = $('#sheet');
  sheet.addEventListener('touchstart', e => { y0 = e.touches[0].clientY; }, { passive: true });
  sheet.addEventListener('touchend', e => {
    if (y0 != null && e.changedTouches[0].clientY - y0 > 70 && $('#sheet-body').scrollTop <= 0) closeSheet();
    y0 = null;
  });

  const themeBtn = $('#theme');
  const applyTheme = m => {
    document.documentElement.dataset.theme = m === 'auto' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : m;
    document.querySelector('meta[name="theme-color"]').content = getComputedStyle(document.body).backgroundColor;
  };
  let theme = store.get('theme', 'auto');
  applyTheme(theme);
  themeBtn.addEventListener('click', () => {
    theme = theme === 'auto' ? 'light' : theme === 'light' ? 'dark' : 'auto';
    store.set('theme', theme);
    applyTheme(theme);
    themeBtn.title = `Theme: ${theme}`;
    rampCache = {};
    render();
  });

  addEventListener('resize', () => { if (state.view === 'plot' || state.view === 'ruler') render(); });

  render();
  document.body.classList.add('intro');
  setTimeout(() => document.body.classList.remove('intro'), 900);

  // install prompt
  let deferred = null;
  addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferred = e;
    $('#install').classList.add('show');
  });
  $('#install-go').addEventListener('click', async () => {
    $('#install').classList.remove('show');
    if (deferred) { deferred.prompt(); deferred = null; }
  });
  $('#install-no').addEventListener('click', () => $('#install').classList.remove('show'));

  if ('serviceWorker' in navigator) {
    addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
}

document.addEventListener('DOMContentLoaded', init);
