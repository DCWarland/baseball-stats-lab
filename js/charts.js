/*
 * charts.js — hand-built SVG charts. No charting library, no dependencies.
 *
 * WHY SVG BY HAND
 * A charting library would add hundreds of kilobytes to draw a histogram. SVG
 * is just markup — a <rect> is a bar, a <path> is a line — so drawing it
 * directly is both smaller and completely transparent. You can read exactly
 * what produced every pixel.
 *
 * Every colour is a CSS variable, so charts follow the light/dark theme
 * without any JavaScript involvement.
 */

import { fmt } from './formulas.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ------------------------------------------------------------- statistics */

export function quantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
}

export function describe(values) {
  const sorted = [...values].filter((v) => v != null && isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const n = sorted.length;
  const mean = sorted.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(sorted.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  return {
    n, mean, sd,
    min: sorted[0], max: sorted[n - 1],
    p10: quantile(sorted, 0.10), p25: quantile(sorted, 0.25),
    median: quantile(sorted, 0.50),
    p75: quantile(sorted, 0.75), p90: quantile(sorted, 0.90),
    p99: quantile(sorted, 0.99),
    sorted,
  };
}

/**
 * What share of the league a value beats.
 * For stats where lower is better (ERA, K%), the scale is flipped so that
 * "95th percentile" always means "excellent".
 */
export function percentileOf(value, sorted, lowerIsBetter = false) {
  if (value == null || !isFinite(value) || !sorted.length) return null;
  let below = 0;
  for (const v of sorted) { if (v < value) below++; else break; }
  const pct = (below / sorted.length) * 100;
  return lowerIsBetter ? 100 - pct : pct;
}

/* -------------------------------------------------------------- histogram */

/**
 * The league distribution for a statistic, drawn from real current-season data.
 *
 * Bars are the actual counts. The line over the top is a smoothed version of
 * the same bars — the "bell" shape — so you can see the underlying tendency
 * without pretending the data is a perfect normal curve, which it never is.
 */
export function histogram({
  values, value = null, valueName = '', format = 'two', lowerIsBetter = false,
  bins = 34, width = 760, height = 268, label = '', bands = null,
}) {
  const stats = describe(values);
  if (!stats || stats.n < 8) return `<p class="chart-empty">Not enough players yet this season to draw a distribution.</p>`;

  const pad = { top: 16, right: 14, bottom: 34, left: 14 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  // Trim the extreme tails so one outlier doesn't squash the whole chart.
  const lo = quantile(stats.sorted, 0.005);
  const hi = quantile(stats.sorted, 0.995);
  const span = hi - lo || 1;
  const binW = span / bins;

  const counts = new Array(bins).fill(0);
  for (const v of stats.sorted) {
    let i = Math.floor((v - lo) / binW);
    if (i < 0) i = 0;
    if (i >= bins) i = bins - 1;
    counts[i]++;
  }
  const maxCount = Math.max(...counts) || 1;

  const x = (v) => pad.left + ((v - lo) / span) * plotW;
  const y = (c) => pad.top + plotH - (c / maxCount) * plotH;

  // Smoothed curve: a 3-wide weighted moving average over the bin counts.
  const smooth = counts.map((_, i) => {
    const a = counts[i - 1] ?? 0, b = counts[i], c = counts[i + 1] ?? 0;
    return (a + 2 * b + c) / 4;
  });
  const curve = smooth
    .map((c, i) => `${i === 0 ? 'M' : 'L'}${(x(lo + (i + 0.5) * binW)).toFixed(1)},${y(c).toFixed(1)}`)
    .join(' ');

  const barW = plotW / bins;
  const bars = counts.map((c, i) => {
    const bx = pad.left + i * barW;
    const bh = (c / maxCount) * plotH;
    return `<rect class="hist-bar" x="${bx.toFixed(1)}" y="${(pad.top + plotH - bh).toFixed(1)}" width="${Math.max(barW - 1, 0.6).toFixed(1)}" height="${bh.toFixed(1)}"><title>${c} player${c === 1 ? '' : 's'} near ${fmt(lo + (i + 0.5) * binW, format)}</title></rect>`;
  }).join('');

  /* Shaded tier regions behind the bars. This is what turns "is .340 good?"
   * into something you can answer by looking. */
  let bandLayer = '';
  if (bands && bands.length) {
    bandLayer = bands.map((b) => {
      const bx = Math.max(pad.left, x(b.from));
      const bw = Math.min(pad.left + plotW, x(b.to)) - bx;
      if (!(bw > 0)) return '';
      const showLabel = bw > 44;
      return `
        <rect class="tier-band t-${b.key}" x="${bx.toFixed(1)}" y="${pad.top}" width="${bw.toFixed(1)}" height="${plotH}"/>
        ${showLabel ? `<text class="tier-band-label" x="${(bx + bw / 2).toFixed(1)}" y="${pad.top - 5}" text-anchor="middle">${esc(b.label)}</text>` : ''}
        <line class="tier-edge" x1="${bx.toFixed(1)}" y1="${pad.top}" x2="${bx.toFixed(1)}" y2="${pad.top + plotH}"/>`;
    }).join('');
  }

  const marks = [{ v: stats.median, key: 'med', text: 'Median' }]
    .filter((m) => m.v >= lo && m.v <= hi);

  const guides = marks.map((m) => `
    <line class="hist-guide ${m.key}" x1="${x(m.v).toFixed(1)}" y1="${pad.top}" x2="${x(m.v).toFixed(1)}" y2="${pad.top + plotH}"/>`).join('');

  let marker = '';
  if (value != null && isFinite(value)) {
    const cx = Math.max(pad.left, Math.min(pad.left + plotW, x(value)));
    const pct = percentileOf(value, stats.sorted, lowerIsBetter);
    // Keep the label inside the frame when the marker sits near either edge.
    const anchor = cx < pad.left + 70 ? 'start' : cx > pad.left + plotW - 70 ? 'end' : 'middle';
    const text = `${valueName ? valueName + '  ' : ''}${fmt(value, format)}${pct == null ? '' : '  ·  ' + Math.round(pct) + ordinal(Math.round(pct)) + ' pct'}`;
    marker = `
      <line class="hist-you" x1="${cx.toFixed(1)}" y1="${pad.top - 2}" x2="${cx.toFixed(1)}" y2="${pad.top + plotH + 4}"/>
      <polygon class="hist-you-tip" points="${cx.toFixed(1)},${pad.top + plotH + 4} ${(cx - 5).toFixed(1)},${pad.top + plotH + 13} ${(cx + 5).toFixed(1)},${pad.top + plotH + 13}"/>
      <text class="hist-you-label" x="${cx.toFixed(1)}" y="${pad.top + plotH + 27}" text-anchor="${anchor}">${esc(text)}</text>`;
  }

  const ticks = [lo, lo + span * 0.25, lo + span * 0.5, lo + span * 0.75, hi].map((t) => `
    <text class="hist-tick" x="${x(t).toFixed(1)}" y="${pad.top + plotH + 14}" text-anchor="middle">${fmt(t, format)}</text>`).join('');

  return `
    <figure class="chart">
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="League distribution of ${esc(label)}">
        <g class="tier-bands">${bandLayer}</g>
        <g class="hist-bars">${bars}</g>
        <path class="hist-curve" d="${curve}"/>
        ${guides}
        <line class="hist-axis" x1="${pad.left}" y1="${pad.top + plotH}" x2="${pad.left + plotW}" y2="${pad.top + plotH}"/>
        ${ticks}
        ${marker}
      </svg>
    </figure>`;
}

/* ---------------------------------------------------------- percentile bar */

/** A compact 0–100 strip showing where a value sits against the league. */
export function percentileBar(pct, { height = 26 } = {}) {
  if (pct == null || !isFinite(pct)) return '';
  const p = Math.max(0, Math.min(100, pct));
  return `
    <div class="pctbar" title="${Math.round(p)}th percentile">
      <svg viewBox="0 0 400 ${height}" preserveAspectRatio="none" role="img" aria-label="${Math.round(p)}th percentile">
        <rect class="pctbar-track" x="0" y="${height / 2 - 5}" width="400" height="10"/>
        <rect class="pctbar-fill" x="0" y="${height / 2 - 5}" width="${(p / 100) * 400}" height="10"/>
        <line class="pctbar-mid" x1="200" y1="${height / 2 - 9}" x2="200" y2="${height / 2 + 9}"/>
        <circle class="pctbar-dot" cx="${(p / 100) * 400}" cy="${height / 2}" r="6"/>
      </svg>
      <span class="pctbar-value">${Math.round(p)}<sup>th</sup> percentile</span>
    </div>`;
}

/* ------------------------------------------------------------------ scatter */

/**
 * Scatter plot for showing how two statistics relate — and how tightly.
 * Reports Pearson's r, which is the standard measure of linear correlation
 * (1 = perfect straight line, 0 = no relationship at all).
 */
export function scatter({ points, xLabel, yLabel, xFormat = 'two', yFormat = 'two', width = 760, height = 340 }) {
  const clean = points.filter((p) => isFinite(p.x) && isFinite(p.y));
  if (clean.length < 5) return `<p class="chart-empty">Not enough data to plot.</p>`;

  const pad = { top: 14, right: 16, bottom: 44, left: 58 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const xs = clean.map((p) => p.x), ys = clean.map((p) => p.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const xSpan = xMax - xMin || 1, ySpan = yMax - yMin || 1;

  const X = (v) => pad.left + ((v - xMin) / xSpan) * plotW;
  const Y = (v) => pad.top + plotH - ((v - yMin) / ySpan) * plotH;

  // Pearson correlation and a least-squares trend line.
  const n = clean.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const p of clean) { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) ** 2; syy += (p.y - my) ** 2; }
  const r = sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
  const slope = sxx ? sxy / sxx : 0;
  const intercept = my - slope * mx;

  const dots = clean.map((p) => `
    <circle class="scatter-dot" cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="3"><title>${esc(p.label ?? '')} — ${fmt(p.x, xFormat)}, ${fmt(p.y, yFormat)}</title></circle>`).join('');

  const trend = `<line class="scatter-trend" x1="${X(xMin)}" y1="${Y(intercept + slope * xMin).toFixed(1)}" x2="${X(xMax)}" y2="${Y(intercept + slope * xMax).toFixed(1)}"/>`;

  const xTicks = [xMin, xMin + xSpan / 2, xMax].map((t) =>
    `<text class="hist-tick" x="${X(t).toFixed(1)}" y="${pad.top + plotH + 16}" text-anchor="middle">${fmt(t, xFormat)}</text>`).join('');
  const yTicks = [yMin, yMin + ySpan / 2, yMax].map((t) =>
    `<text class="hist-tick" x="${pad.left - 6}" y="${(Y(t) + 3).toFixed(1)}" text-anchor="end">${fmt(t, yFormat)}</text>`).join('');

  return `
    <figure class="chart">
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(xLabel)} versus ${esc(yLabel)}">
        <line class="hist-axis" x1="${pad.left}" y1="${pad.top + plotH}" x2="${pad.left + plotW}" y2="${pad.top + plotH}"/>
        <line class="hist-axis" x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + plotH}"/>
        ${dots}${trend}${xTicks}${yTicks}
        <text class="axis-label" x="${pad.left + plotW / 2}" y="${height - 6}" text-anchor="middle">${esc(xLabel)}</text>
        <text class="axis-label" transform="rotate(-90)" x="${-(pad.top + plotH / 2)}" y="14" text-anchor="middle">${esc(yLabel)}</text>
      </svg>
      <figcaption>Each dot is a player. Correlation <strong>r = ${r.toFixed(2)}</strong> — ${describeR(r)}.</figcaption>
    </figure>`;
}

/** 1st, 2nd, 3rd, 4th… including the 11–13 exceptions. */
export function ordinal(n) {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return 'th';
  return ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
}

function describeR(r) {
  const a = Math.abs(r);
  const dir = r < 0 ? 'negative' : 'positive';
  if (a > 0.85) return `a very strong ${dir} relationship`;
  if (a > 0.6) return `a strong ${dir} relationship`;
  if (a > 0.35) return `a moderate ${dir} relationship`;
  if (a > 0.15) return `a weak ${dir} relationship`;
  return 'essentially no relationship';
}

/* -------------------------------------------------------------- data bars */

/** Inline bar used inside leaderboard rows, so rank differences are visible. */
export function dataBar(value, min, max, negative = false) {
  const span = max - min || 1;
  const pct = Math.max(0, Math.min(100, ((value - min) / span) * 100));
  return `<span class="databar"><span class="databar-fill${negative ? ' neg' : ''}" style="width:${pct.toFixed(1)}%"></span></span>`;
}
