/*
 * render.js — turns a stat object into an interactive lesson page.
 *
 * THE KEY IDEA
 * This file contains no knowledge of any specific statistic. It reads the
 * generic shape of a stat object and builds the page from that. Adding a new
 * stat to the curriculum requires zero changes here — the calculator, the
 * league distribution, the player picker and the top-100 table all appear
 * automatically.
 *
 * THE compute() CONTRACT
 * Every stat's compute() is called as compute(values, ctx) — the numbers the
 * user typed, then the shared live-league context. If a formula in formulas.js
 * takes its own second argument (an exponent, a season, a constant), you MUST
 * wrap it in the content file:
 *
 *     compute: (v) => F.pythagoreanWins(v)          // correct
 *     compute: F.pythagoreanWins                     // WRONG — ctx becomes the exponent
 *
 * scripts/smoke-test.py catches that by running every calculator with its own
 * defaults and failing if the result is not a finite number.
 */

import * as F from './formulas.js';
import { SCALES, RUN_EXPECTANCY, BASE_STATE_LABELS, PARK_FACTORS, POSITION_ADJUSTMENT, STABILISATION } from './constants.js';
import { neighbours } from './content/index.js';
import { histogram, percentileBar, percentileOf, describe, scatter, ordinal } from './charts.js';
import { populationFor, minimumLabel } from './population.js';
import { tierBands, tierLegend, tierFor } from './tiers.js';
import { renderLeaderboard } from './leaderboard.js';
import * as api from './api.js';

/** Escape text before putting it in HTML, so a stray < never breaks the page. */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* Shared context: live league values, filled in by app.js once fetched. */
export const ctx = {
  season: 2026,
  lgwOBA: null,
  lgOBP: null,
  lgSLG: null,
  lgRperPA: 0.12,
  cFIP: 3.15,
  lgHrFb: 0.13,
  ready: false,
};

export function renderStat(stat, mount) {
  const { prev, next } = neighbours(stat.path);

  mount.innerHTML = `
    <article class="lesson">
      <header class="lesson-head">
        <p class="crumb">${esc(stat.moduleTitle)}</p>
        <h1><span class="abbr">${esc(stat.abbr)}</span>${esc(stat.name)}</h1>
        <p class="lede">${esc(stat.short ?? '')}</p>
        ${stat.formula ? `<div class="formula"><code>${esc(stat.formula)}</code></div>` : ''}
      </header>

      <section class="prose">${stat.body ?? ''}</section>

      ${stat.gotcha ? `<aside class="gotcha"><h3>Common mistake</h3><p>${esc(stat.gotcha)}</p></aside>` : ''}
      ${stat.note ? `<aside class="note"><p>${esc(stat.note)}</p></aside>` : ''}

      <div class="stitch" aria-hidden="true"></div>

      <div id="calc-slot"></div>
      <div id="dist-slot"></div>
      <div id="widget-slot"></div>
      <div id="scatter-slot"></div>
      <div id="lb-slot"></div>

      <nav class="pager">
        ${prev ? `<a class="pager-link prev" href="#/stat/${prev.path}"><span>← Previous</span><strong>${esc(prev.name)}</strong></a>` : '<span></span>'}
        ${next ? `<a class="pager-link next" href="#/stat/${next.path}"><span>Next →</span><strong>${esc(next.name)}</strong></a>` : '<span></span>'}
      </nav>
    </article>`;

  const calc = (stat.inputs && stat.compute)
    ? renderCalculator(stat, mount.querySelector('#calc-slot'))
    : null;

  if (stat.widget) renderWidget(stat.widget, mount.querySelector('#widget-slot'));
  if (stat.dist) renderDistributionAndBoard(stat, mount, calc);
  else if (stat.noDist) renderNoDistribution(stat, mount.querySelector('#dist-slot'));
  if (stat.scatter) renderScatter(stat, mount.querySelector('#scatter-slot'));
}

/* ---------------------------------------------------------- calculator */

/**
 * Builds the calculator and returns a small handle so other panels can react
 * to it. `subscribe` lets the distribution chart move its marker as you type.
 */
function renderCalculator(stat, slot) {
  const id = (k) => `in-${stat.id}-${k}`;
  const listeners = [];
  let current = null;

  slot.innerHTML = `
    <section class="panel calc">
      <div class="panel-head"><h2>Work it out</h2></div>
      <p class="panel-note">Change any number and everything below updates — including where this player would rank in the league.</p>
      <div class="calc-grid">
        ${stat.inputs.map((i) => `
          <label class="calc-field" for="${id(i.key)}">
            <span>${esc(i.label)}</span>
            ${i.type === 'select'
              ? `<select id="${id(i.key)}" data-key="${i.key}">
                   ${i.options.map((o) => `<option value="${esc(o)}"${o === i.def ? ' selected' : ''}>${esc(o)}</option>`).join('')}
                 </select>`
              : `<input id="${id(i.key)}" data-key="${i.key}" type="number" step="${i.step ?? 1}" value="${i.def}">`}
          </label>`).join('')}
      </div>
      <div class="calc-out">
        <div class="calc-out-main">
          <span class="calc-out-label">${esc(stat.resultLabel ?? stat.abbr)}</span>
          <output class="calc-out-value" id="out-${stat.id}">—</output>
        </div>
        <span class="calc-grade" id="grade-${stat.id}"></span>
      </div>
      ${stat.benchmarks ? `
        <table class="bench-table">
          <tbody><tr>
            ${stat.benchmarks.map(([v, label]) => `
              <td><span class="bench-val">${formatBench(v, stat.format)}</span><span class="bench-label">${esc(label)}</span></td>`).join('')}
          </tr></tbody>
        </table>` : ''}
    </section>`;

  const fields = [...slot.querySelectorAll('[data-key]')];
  const out = slot.querySelector(`#out-${stat.id}`);
  const gradeEl = slot.querySelector(`#grade-${stat.id}`);

  function recalc(source) {
    const values = {};
    for (const f of fields) values[f.dataset.key] = f.tagName === 'SELECT' ? f.value : Number(f.value);

    let result;
    try { result = stat.compute(values, ctx); } catch { result = null; }
    current = result;

    out.textContent = F.fmt(result, stat.format);
    const scale = stat.scale ? SCALES[stat.scale] : null;
    const label = scale ? F.grade(result, scale) : null;
    gradeEl.textContent = label ?? '';
    gradeEl.className = 'calc-grade ' + (label ? 'g-' + label.toLowerCase().replace(/[^a-z]+/g, '-') : '');

    listeners.forEach((cb) => cb(result, source));
  }

  fields.forEach((f) => f.addEventListener('input', () => recalc('user')));
  recalc('init');

  return {
    subscribe: (cb) => { listeners.push(cb); cb(current, 'init'); },
    value: () => current,
    /**
     * Load a real player's line into the inputs. Any input whose key exists on
     * the row is filled; anything missing keeps its current value, so a partial
     * match still does something sensible.
     */
    setValues(row) {
      let filled = 0;
      for (const f of fields) {
        const v = row[f.dataset.key];
        if (v == null || (typeof v === 'number' && !isFinite(v))) continue;
        f.value = v;
        filled++;
      }
      recalc('player');
      return filled;
    },
  };
}

function formatBench(v, format) {
  if (format === 'rate3') return F.fmt(v, 'rate3');
  if (format === 'pct1') return v + '%';
  return String(v);
}

/* ------------------------------------------- distribution + leaderboard */

/**
 * The panels that answer "what counts as good?" — a curve of every qualifying
 * player in MLB right now, a picker to place any individual on it, and the
 * top-100 table.
 *
 * All three are generated by running this lesson's own compute() over live
 * data, so they can never drift away from the formula being taught.
 */
function renderDistributionAndBoard(stat, mount, calc) {
  const distSlot = mount.querySelector('#dist-slot');
  const lbSlot = mount.querySelector('#lb-slot');

  distSlot.innerHTML = `<section class="panel"><div class="panel-head"><h2>Where the league sits</h2></div><p class="loading">Fetching every qualifying player</p></section>`;
  lbSlot.innerHTML = '';

  populationFor(stat).then((pop) => {
    if (!pop || pop.values.length < 8) {
      distSlot.innerHTML = `<section class="panel"><div class="panel-head"><h2>Where the league sits</h2></div><p class="chart-empty">Not enough ${ctx.season} data yet to build a distribution.</p></section>`;
      return;
    }

    const s = describe(pop.values);
    const lower = pop.lowerIsBetter;
    const fmtStyle = pop.format;
    const named = pop.allRows.filter((r) => r.name);

    distSlot.innerHTML = `
      <section class="panel">
        <div class="panel-head">
          <h2>Where the league sits</h2>
          <span class="panel-meta">${s.n} ${pop.entity}${s.n === 1 ? '' : 's'} · ${ctx.season} · ${esc(minimumLabel(stat))}</span>
        </div>
        <p class="panel-note">${esc(pop.note ?? `Every qualifying ${pop.entity} this season, with ${pop.label} produced by the formula above. The line over the bars is the smoothed shape — the real distribution, not an idealised bell.`)}</p>

        ${named.length ? `
        <div class="picker">
          <div class="picker-search">
            <input type="search" id="pick-${stat.id}" autocomplete="off"
                   placeholder="Search any ${pop.entity} — type a name"
                   aria-label="Search for a ${pop.entity}">
            <div class="picker-results" id="pick-res-${stat.id}" hidden></div>
          </div>
          <button type="button" class="btn-secondary" id="pick-clear-${stat.id}">Clear</button>
        </div>
        <div class="picker-card" id="pick-card-${stat.id}" hidden></div>` : ''}

        <div id="hist-holder"></div>
        <div id="pct-holder"></div>
        <div class="tier-legend" id="tier-legend"></div>

        <table class="data-table ladder">
          <thead><tr><th>Percentile</th>${[1, 10, 25, 50, 75, 90, 99].map((p) => `<th>${p}${ordinal(p)}</th>`).join('')}</tr></thead>
          <tbody><tr>
            <th>${esc(pop.label)}</th>
            ${[0.01, 0.10, 0.25, 0.50, 0.75, 0.90, 0.99].map((q) =>
              `<td>${F.fmt(quantileOf(s.sorted, lower ? 1 - q : q), fmtStyle)}</td>`).join('')}
          </tr></tbody>
        </table>

        <table class="data-table ladder">
          <thead><tr><th>League</th><th>Median</th><th>Mean</th><th>Std dev</th><th>Best</th><th>Worst</th></tr></thead>
          <tbody><tr>
            <th>${ctx.season}</th>
            <td>${F.fmt(s.median, fmtStyle)}</td>
            <td>${F.fmt(s.mean, fmtStyle)}</td>
            <td>${F.fmt(s.sd, fmtStyle)}</td>
            <td>${F.fmt(lower ? s.min : s.max, fmtStyle)}</td>
            <td>${F.fmt(lower ? s.max : s.min, fmtStyle)}</td>
          </tr></tbody>
        </table>
      </section>`;

    const histHolder = distSlot.querySelector('#hist-holder');
    const pctHolder = distSlot.querySelector('#pct-holder');
    const search = distSlot.querySelector(`#pick-${stat.id}`);
    const results = distSlot.querySelector(`#pick-res-${stat.id}`);
    const card = distSlot.querySelector(`#pick-card-${stat.id}`);

    const bands = tierBands(s.sorted, lower);
    let selected = null;   // the row currently pinned to the curve

    // The tier legend: what "elite" actually means, in this stat's own units.
    distSlot.querySelector('#tier-legend').innerHTML =
      tierLegend(s.sorted, lower, F.fmt, fmtStyle).map((t) => `
        <span class="tier-chip t-${t.key}">
          <span class="tier-chip-label">${esc(t.label)}</span>
          <span class="tier-chip-range">${esc(t.range)}</span>
        </span>`).join('');

    function paint(value, name) {
      histHolder.innerHTML = histogram({
        values: pop.values, value, valueName: name ?? '',
        format: fmtStyle, lowerIsBetter: lower, label: stat.name, bands,
      });
      pctHolder.innerHTML = value == null ? '' : percentileBar(percentileOf(value, s.sorted, lower));
    }

    /* The player card: who he is, what he did, and where that ranks. This is
     * the "load any player and see their live stats" panel. */
    function showCard(row) {
      if (!card) return;
      if (!row) { card.hidden = true; card.innerHTML = ''; return; }

      const pct = row.qualified === false ? null : percentileOf(row.value, s.sorted, lower);
      const tier = tierFor(pct);
      const line = summaryLine(row, pop.group, pop.source);

      card.hidden = false;
      card.innerHTML = `
        <div class="pc-head">
          <div>
            <span class="pc-name">${esc(row.name)}</span>
            <span class="pc-meta">${esc(row.team ?? '')}${row.position ? ' · ' + esc(row.position) : ''}</span>
          </div>
          <div class="pc-value">
            <span class="pc-num">${F.fmt(row.value, fmtStyle)}</span>
            <span class="pc-stat">${esc(pop.label)}</span>
          </div>
          ${tier ? `<span class="tier-badge t-${tier.key}">${esc(tier.label)}</span>` : '<span class="tier-badge t-none">Below the qualifying line</span>'}
        </div>
        ${row.qualified === false
          ? `<p class="pc-warn">Not enough playing time to be ranked (${esc(minimumLabel(stat))}). Shown so you can still look him up — treat the rate as noisy.</p>`
          : `<p class="pc-rank">${row.rank}${ordinal(row.rank)} of ${s.n} qualifiers · ${Math.round(pct)}${ordinal(Math.round(pct))} percentile</p>`}
        ${line ? `<div class="pc-line">${line}</div>` : ''}
        ${calc ? `<p class="pc-hint">His real numbers are loaded into the calculator above — change any of them to see what would have happened.</p>` : ''}`;
    }

    /* Selecting a player fills the calculator with his real line, which makes
     * the marker move as a side effect — so you see the numbers that produced
     * the value, not just the value. */
    function select(row) {
      selected = row;
      showCard(row);
      if (calc && row) {
        const filled = calc.setValues(row);
        if (filled) return;          // the calculator repaints via subscribe
      }
      paint(row ? row.value : (calc ? calc.value() : null), row ? row.name : null);
    }

    function clear() {
      selected = null;
      if (search) search.value = '';
      if (results) { results.hidden = true; results.innerHTML = ''; }
      showCard(null);
      paint(calc ? calc.value() : null, null);
    }

    if (search) {
      const pool = pop.allRows.filter((r) => r.name);
      search.addEventListener('input', () => {
        const q = search.value.trim().toLowerCase();
        if (q.length < 2) { results.hidden = true; results.innerHTML = ''; return; }
        const hits = pool
          .filter((r) => r.name.toLowerCase().includes(q) || (r.team ?? '').toLowerCase().includes(q))
          .slice(0, 12);
        if (!hits.length) {
          results.hidden = false;
          results.innerHTML = `<p class="picker-empty">No ${pop.entity} found for “${esc(search.value)}”.</p>`;
          return;
        }
        results.hidden = false;
        results.innerHTML = hits.map((r) => `
          <button type="button" data-id="${r.id ?? r.rank}" data-rank="${r.rank ?? ''}">
            <span class="pr-name">${esc(r.name)}</span>
            <span class="pr-team">${esc(shortTeam(r.team))}</span>
            <span class="pr-val">${F.fmt(r.value, fmtStyle)}</span>
            ${r.qualified === false ? '<span class="pr-unq">unqualified</span>' : ''}
          </button>`).join('');

        results.querySelectorAll('button').forEach((b, i) => {
          b.addEventListener('click', () => {
            const row = hits[i];
            search.value = row.name;
            results.hidden = true;
            select(row);
          });
        });
      });

      search.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') clear();
        if (e.key === 'Enter') {
          const first = results.querySelector('button');
          if (first) { e.preventDefault(); first.click(); }
        }
      });
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.picker-search')) { results.hidden = true; }
      });
      distSlot.querySelector(`#pick-clear-${stat.id}`).addEventListener('click', clear);
    }

    // Typing in the calculator means you are no longer looking at that player.
    if (calc) {
      calc.subscribe((value, source) => {
        if (source === 'user' && selected) {
          if (card) card.querySelector('.pc-hint')?.replaceChildren(
            document.createTextNode(`Edited from ${selected.name}'s real line — this is now a hypothetical.`));
        }
        paint(value, selected && source !== 'user' ? selected.name : (selected ? selected.name + ' (edited)' : null));
      });
    } else {
      paint(null, null);
    }

    // Clicking a row in the top-100 table pins that player too.
    renderLeaderboard(stat, pop, lbSlot, 100, (row) => {
      if (picker) picker.value = String(row.rank);
      select(row);
      distSlot.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }).catch((e) => {
    distSlot.innerHTML = `<section class="panel"><div class="panel-head"><h2>Where the league sits</h2></div><p class="error">Could not load live data: ${esc(e.message)}</p></section>`;
  });
}

/**
 * A handful of statistics have no per-player season feed anywhere public —
 * they are either proprietary models or play-level measures. Saying so plainly
 * is more useful than inventing a curve.
 */
function renderNoDistribution(stat, slot) {
  slot.innerHTML = `
    <section class="panel">
      <div class="panel-head"><h2>Where the league sits</h2><span class="panel-meta">no live feed</span></div>
      <p class="panel-note">${esc(stat.noDist)}</p>
    </section>`;
}

/** The handful of raw numbers worth showing beside a selected player. */
function summaryLine(row, group, source) {
  const cell = (label, v, style) =>
    (v == null || !isFinite(v)) ? '' : `<span><em>${label}</em>${F.fmt(v, style)}</span>`;

  if (source) return [
    cell('PA', row.PA, 'int'), cell('BBE', row.batted, 'int'),
    cell('EV', row.avgEV, 'one'), cell('Swings', row.swings, 'int'),
    cell('Runs', row.runs, 'int'), cell('Throws', row.throws, 'int'),
  ].join('');

  if (group === 'pitching') return [
    cell('IP', F.ipDecimal(row.IP), 'one'), cell('ERA', F.era(row), 'era'),
    cell('SO', row.K, 'int'), cell('BB', row.BB, 'int'), cell('HR', row.HR, 'int'),
    cell('WHIP', F.whip(row), 'two'),
  ].join('');

  if (group === 'fielding') return [
    cell('Inn', row.INN, 'int'), cell('PO', row.PO, 'int'),
    cell('A', row.A, 'int'), cell('E', row.E, 'int'),
  ].join('');

  if (group === 'team') return [
    cell('G', row.G, 'int'), cell('RS', row.RS, 'int'), cell('RA', row.RA, 'int'),
  ].join('');

  return [
    cell('PA', row.PA, 'int'), cell('AVG', F.avg(row), 'rate3'),
    cell('OBP', F.obp(row), 'rate3'), cell('SLG', F.slg(row), 'rate3'),
    cell('HR', row.HR, 'int'), cell('BB', row.BB, 'int'), cell('SO', row.K, 'int'),
  ].join('');
}

function shortTeam(name) {
  if (!name) return '';
  const parts = String(name).split(' ');
  return parts.length > 1 ? parts[parts.length - 1] : name;
}

function quantileOf(sorted, q) {
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base];
}

/* ---------------------------------------------------------------- scatter */

/** Shows how two statistics relate across the whole league. */
function renderScatter(stat, slot) {
  const cfg = stat.scatter;
  slot.innerHTML = `<section class="panel"><div class="panel-head"><h2>${esc(cfg.title)}</h2></div><p class="loading">Plotting the league…</p></section>`;

  api.leaders({ group: cfg.group, season: ctx.season, limit: 1500, qualified: false })
    .then((raw) => {
      const min = cfg.min;
      const points = [];
      for (const r of raw) {
        if (min && (r[min.field] ?? 0) < min.value) continue;
        const row = { ...r };
        if (row.PA == null && row.AB != null) row.PA = row.AB + (row.BB ?? 0) + (row.HBP ?? 0) + (row.SF ?? 0) + (row.SH ?? 0);
        let x, y;
        try { x = cfg.x.fn(row, ctx); y = cfg.y.fn(row, ctx); } catch { continue; }
        if (!isFinite(x) || !isFinite(y)) continue;
        points.push({ x, y, label: r.name });
      }

      slot.innerHTML = `
        <section class="panel">
          <div class="panel-head">
            <h2>${esc(cfg.title)}</h2>
            <span class="panel-meta">${points.length} players · ${ctx.season}</span>
          </div>
          ${cfg.note ? `<p class="panel-note">${esc(cfg.note)}</p>` : ''}
          ${scatter({
            points,
            xLabel: cfg.x.label, yLabel: cfg.y.label,
            xFormat: cfg.x.format ?? 'two', yFormat: cfg.y.format ?? 'two',
          })}
        </section>`;
    })
    .catch((e) => {
      slot.innerHTML = `<section class="panel"><p class="error">Could not plot: ${esc(e.message)}</p></section>`;
    });
}

/* -------------------------------------------------------------- widgets */

function renderWidget(name, slot) {
  const widgets = {
    runExpectancyTable, linearWeightsExplorer, re24Calculator,
    parkFactorTable, positionAdjustmentTable, stabilisationTable, fipConstantLive,
  };
  (widgets[name] ?? (() => {}))(slot);
}

function runExpectancyTable(slot) {
  const states = Object.keys(RUN_EXPECTANCY);
  slot.innerHTML = `
    <section class="panel">
      <div class="panel-head"><h2>The 24 base/out states</h2></div>
      <p class="panel-note">Average runs scored from this point to the end of the inning. Click any cell.</p>
      <div class="table-scroll">
        <table class="data-table re-table">
          <thead><tr><th>Situation</th><th>0 out</th><th>1 out</th><th>2 out</th></tr></thead>
          <tbody>
            ${states.map((s) => `
              <tr>
                <th class="re-state">${esc(BASE_STATE_LABELS[s])}</th>
                ${RUN_EXPECTANCY[s].map((v, o) => `
                  <td class="re-cell" data-heat="${heat(v)}" data-state="${s}" data-outs="${o}" tabindex="0">${v.toFixed(3)}</td>`).join('')}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <p class="readout" id="re-readout">Bases empty, 0 out: a team scores <strong>0.481</strong> runs on average for the rest of the inning.</p>
    </section>`;

  slot.querySelectorAll('.re-cell').forEach((cell) => {
    const show = () => {
      const v = RUN_EXPECTANCY[cell.dataset.state][Number(cell.dataset.outs)];
      slot.querySelector('#re-readout').innerHTML =
        `${esc(BASE_STATE_LABELS[cell.dataset.state])}, ${cell.dataset.outs} out: a team scores <strong>${v.toFixed(3)}</strong> runs on average for the rest of the inning.`;
    };
    cell.addEventListener('click', show);
    cell.addEventListener('focus', show);
  });
}

const heat = (v) => (v >= 1.8 ? '5' : v >= 1.2 ? '4' : v >= 0.8 ? '3' : v >= 0.4 ? '2' : '1');

function linearWeightsExplorer(slot) {
  const events = [
    { name: 'Home run', re: 1.40, woba: 2.04 },
    { name: 'Triple', re: 1.03, woba: 1.59 },
    { name: 'Double', re: 0.75, woba: 1.25 },
    { name: 'Single', re: 0.47, woba: 0.88 },
    { name: 'Hit by pitch', re: 0.36, woba: 0.72 },
    { name: 'Unintentional walk', re: 0.33, woba: 0.69 },
    { name: 'Out in play', re: -0.26, woba: 0 },
    { name: 'Strikeout', re: -0.28, woba: 0 },
  ];
  const max = 2.04;
  slot.innerHTML = `
    <section class="panel">
      <div class="panel-head"><h2>What each event is really worth</h2></div>
      <p class="panel-note">Runs above average, measured from play-by-play data — and the wOBA weight derived from it.</p>
      <div class="lw-bars">
        ${events.map((e) => `
          <div class="lw-row">
            <span class="lw-name">${esc(e.name)}</span>
            <span class="lw-track"><span class="lw-bar${e.re < 0 ? ' neg' : ''}" style="width:${Math.abs(e.re) / max * 100}%"></span></span>
            <span class="lw-val">${e.re > 0 ? '+' : ''}${e.re.toFixed(2)}</span>
            <span class="lw-woba">wOBA ${e.woba.toFixed(2)}</span>
          </div>`).join('')}
      </div>
      <p class="readout">A home run is worth about <strong>3× a single</strong>, not the 4× slugging percentage assumes. A walk is worth about <strong>70% of a single</strong> — not the zero batting average implies.</p>
    </section>`;
}

function re24Calculator(slot) {
  const states = Object.keys(RUN_EXPECTANCY);
  const opt = (sel) => states.map((s) => `<option value="${s}"${s === sel ? ' selected' : ''}>${esc(BASE_STATE_LABELS[s])}</option>`).join('');
  slot.innerHTML = `
    <section class="panel calc">
      <div class="panel-head"><h2>Price any play yourself</h2></div>
      <div class="calc-grid">
        <label class="calc-field"><span>Bases before</span><select id="re-b1">${opt('1__')}</select></label>
        <label class="calc-field"><span>Outs before</span><select id="re-o1"><option>0</option><option>1</option><option>2</option></select></label>
        <label class="calc-field"><span>Bases after</span><select id="re-b2">${opt('_23')}</select></label>
        <label class="calc-field"><span>Outs after</span><select id="re-o2"><option>0</option><option>1</option><option>2</option><option>3</option></select></label>
        <label class="calc-field"><span>Runs scored on the play</span><input id="re-r" type="number" value="0" min="0" step="1"></label>
      </div>
      <div class="calc-out">
        <div class="calc-out-main">
          <span class="calc-out-label">Run value of this play</span>
          <output class="calc-out-value" id="re24-out">—</output>
        </div>
      </div>
      <p class="readout" id="re24-detail"></p>
    </section>`;

  const els = ['re-b1', 're-o1', 're-b2', 're-o2', 're-r'].map((i) => slot.querySelector('#' + i));
  function calc() {
    const [b1, o1, b2, o2, r] = els;
    const before = F.runExpectancy(b1.value, Number(o1.value));
    const after = Number(o2.value) >= 3 ? 0 : F.runExpectancy(b2.value, Number(o2.value));
    const val = F.re24(b1.value, Number(o1.value), b2.value, Number(o2.value), Number(r.value));
    slot.querySelector('#re24-out').textContent = F.fmt(val, 'runs');
    slot.querySelector('#re24-detail').innerHTML =
      `Run expectancy moved from <strong>${before?.toFixed(3) ?? '—'}</strong> to <strong>${after?.toFixed(3) ?? '0.000'}</strong>${Number(r.value) ? `, and <strong>${r.value}</strong> run(s) scored` : ''}.`;
  }
  els.forEach((e) => e.addEventListener('input', calc));
  calc();
}

function parkFactorTable(slot) {
  const rows = Object.entries(PARK_FACTORS).sort((a, b) => b[1].pf - a[1].pf);
  slot.innerHTML = `
    <section class="panel">
      <div class="panel-head"><h2>Park factors, all 30 stadiums</h2></div>
      <p class="panel-note">100 is neutral. Above helps hitters, below helps pitchers.</p>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr><th>Club</th><th>Park</th><th>Factor</th><th class="col-chart">Effect</th></tr></thead>
          <tbody>
            ${rows.map(([team, p]) => `
              <tr>
                <th>${esc(team)}</th>
                <td>${esc(p.name)}</td>
                <td class="num">${p.pf}</td>
                <td class="col-chart"><span class="divbar"><span class="divbar-fill${p.pf < 100 ? ' under' : ''}" style="width:${Math.abs(p.pf - 100) * 4}%;${p.pf < 100 ? 'right:50%' : 'left:50%'}"></span></span></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>`;
}

function positionAdjustmentTable(slot) {
  const rows = Object.entries(POSITION_ADJUSTMENT).sort((a, b) => b[1] - a[1]);
  slot.innerHTML = `
    <section class="panel">
      <div class="panel-head"><h2>Positional adjustment</h2><span class="panel-meta">runs per 600 PA</span></div>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr><th>Position</th><th>Runs</th><th>Wins</th><th class="col-chart">Scale</th></tr></thead>
          <tbody>
            ${rows.map(([pos, adj]) => `
              <tr><th>${esc(pos)}</th>
                  <td class="num ${adj >= 0 ? 'pos' : 'neg'}">${adj > 0 ? '+' : ''}${adj.toFixed(1)}</td>
                  <td class="num">${adj > 0 ? '+' : ''}${(adj / 10).toFixed(2)}</td>
                  <td class="col-chart"><span class="divbar"><span class="divbar-fill${adj < 0 ? ' under' : ''}" style="width:${Math.abs(adj) * 2.6}%;${adj < 0 ? 'right:50%' : 'left:50%'}"></span></span></td></tr>`).join('')}
          </tbody>
        </table>
      </div>
      <p class="readout">Catcher to designated hitter is a 30-run gap — three wins a season, before either player swings a bat.</p>
    </section>`;
}

function stabilisationTable(slot) {
  const rows = [...STABILISATION].sort((a, b) => a.n - b.n);
  const max = Math.max(...rows.map((r) => r.n));
  slot.innerHTML = `
    <section class="panel">
      <div class="panel-head"><h2>When does a stat become meaningful?</h2></div>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr><th>Statistic</th><th>Stabilises at</th><th class="col-chart">Relative</th></tr></thead>
          <tbody>
            ${rows.map((s) => `
              <tr><th>${esc(s.stat)}</th>
                  <td class="num">${s.n} <span class="unit">${esc(s.unit)}</span></td>
                  <td class="col-chart"><span class="databar"><span class="databar-fill" style="width:${(s.n / max) * 100}%"></span></span></td></tr>`).join('')}
          </tbody>
        </table>
      </div>
      <p class="readout">"Stabilises" is the point where the spread you observe is half true skill, half random variation. Below it, you are mostly reading noise.</p>
    </section>`;
}

function fipConstantLive(slot) {
  slot.innerHTML = `<section class="panel"><div class="panel-head"><h2>This season's FIP constant</h2></div><p class="loading">Fetching league pitching totals…</p></section>`;
  api.leagueTotals(ctx.season, 'pitching').then((lg) => {
    const c = F.fipConstant({ ER: lg.ER, IP: lg.IP, HR: lg.HR, BB: lg.BB, HBP: lg.HBP, K: lg.K });
    const lgEra = F.era({ ER: lg.ER, IP: lg.IP });
    slot.innerHTML = `
      <section class="panel">
        <div class="panel-head"><h2>This season's FIP constant</h2><span class="panel-meta">computed live from ${lg.teams} clubs</span></div>
        <table class="data-table ladder">
          <thead><tr><th>League</th><th>ERA</th><th>IP</th><th>SO</th><th>BB</th><th>HR</th><th class="hl">cFIP</th></tr></thead>
          <tbody><tr>
            <th>${ctx.season}</th>
            <td>${F.fmt(lgEra, 'era')}</td>
            <td>${F.fmt(F.ipDecimal(lg.IP), 'int')}</td>
            <td>${lg.K.toLocaleString()}</td>
            <td>${lg.BB.toLocaleString()}</td>
            <td>${lg.HR.toLocaleString()}</td>
            <td class="hl">${F.fmt(c, 'two')}</td>
          </tr></tbody>
        </table>
        <p class="readout">Add that constant to the raw FIP formula and league FIP lands exactly on league ERA — which is the whole reason it exists.</p>
      </section>`;
  }).catch((e) => {
    slot.innerHTML = `<section class="panel"><p class="error">Could not reach the MLB API: ${esc(e.message)}</p></section>`;
  });
}

export { esc };
