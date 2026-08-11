/*
 * sandbox.js — the "one player, every stat" explorer.
 *
 * Drag a slider and watch a dozen statistics move at once. This is where the
 * relationships between stats become obvious in a way that reading about them
 * never quite achieves: add 40 walks and see AVG refuse to budge while OBP,
 * wOBA and wRC+ all climb.
 *
 * It also loads a real current-season player, so the starting numbers are real.
 */

import * as F from './formulas.js';
import { SCALES } from './constants.js';
import { ctx } from './render.js';
import * as api from './api.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const SLIDERS = [
  { key: 'AB', label: 'At-bats', min: 100, max: 700 },
  { key: 'H', label: 'Hits', min: 0, max: 280 },
  { key: 'doubles', label: 'Doubles', min: 0, max: 70 },
  { key: 'triples', label: 'Triples', min: 0, max: 25 },
  { key: 'HR', label: 'Home runs', min: 0, max: 80 },
  { key: 'BB', label: 'Walks', min: 0, max: 200 },
  { key: 'IBB', label: 'Intentional walks', min: 0, max: 70 },
  { key: 'HBP', label: 'Hit by pitch', min: 0, max: 40 },
  { key: 'K', label: 'Strikeouts', min: 0, max: 250 },
  { key: 'SF', label: 'Sacrifice flies', min: 0, max: 15 },
  { key: 'SB', label: 'Stolen bases', min: 0, max: 90 },
  { key: 'CS', label: 'Caught stealing', min: 0, max: 30 },
];

const OUTPUTS = [
  { label: 'AVG', fn: (v) => F.avg(v), format: 'rate3', scale: 'avg' },
  { label: 'OBP', fn: (v) => F.obp(v), format: 'rate3', scale: 'obp' },
  { label: 'SLG', fn: (v) => F.slg(v), format: 'rate3', scale: 'slg' },
  { label: 'OPS', fn: (v) => F.ops(v), format: 'rate3z', scale: 'ops' },
  { label: 'ISO', fn: (v) => F.iso(v), format: 'rate3', scale: 'iso' },
  { label: 'BABIP', fn: (v) => F.babip(v), format: 'rate3' },
  { label: 'BB%', fn: (v) => F.bbPct(withPA(v)), format: 'pct1', scale: 'bbpct' },
  { label: 'K%', fn: (v) => F.kPct(withPA(v)), format: 'pct1', scale: 'kpct' },
  { label: 'wOBA', fn: (v) => F.woba(v, ctx.season), format: 'rate3', scale: 'woba' },
  { label: 'wRAA', fn: (v) => F.wraa(withPA(v), ctx.season, ctx.lgwOBA), format: 'runs' },
  { label: 'wRC+', fn: (v) => F.wrcPlus(withPA(v), ctx.season, ctx.lgwOBA, 100, ctx.lgRperPA), format: 'plus', scale: 'plus' },
  { label: 'SB%', fn: (v) => F.sbPct(v), format: 'pct1' },
];

const withPA = (v) => ({ ...v, PA: F.plateAppearances({ ...v, SH: 0, CI: 0 }) });

const DEFAULTS = { AB: 476, H: 156, doubles: 32, triples: 2, HR: 73, BB: 177, IBB: 35, HBP: 9, K: 93, SF: 2, SB: 13, CS: 3 };

export function renderSandbox(mount) {
  const state = { ...DEFAULTS };

  mount.innerHTML = `
    <article class="lesson">
      <header class="lesson-head">
        <p class="crumb">Explorer</p>
        <h1>Stat Sandbox</h1>
        <p class="lede">Build a hitter and watch every statistic respond at once. The relationships between stats are much easier to feel than to read about.</p>
      </header>

      <section class="sandbox-load">
        <label for="sb-player">Load a real ${ctx.season} hitter:</label>
        <select id="sb-player"><option>Loading current season…</option></select>
        <button id="sb-reset" type="button" class="btn-secondary">Reset to Bonds 2001</button>
      </section>

      <div class="sandbox">
        <section class="sandbox-controls">
          <h2>Inputs</h2>
          ${SLIDERS.map((s) => `
            <div class="slider-row">
              <label for="sb-${s.key}">${esc(s.label)}</label>
              <input id="sb-${s.key}" type="range" data-key="${s.key}" min="${s.min}" max="${s.max}" value="${state[s.key]}">
              <output id="sbv-${s.key}">${state[s.key]}</output>
            </div>`).join('')}
        </section>

        <section class="sandbox-out">
          <h2>Results</h2>
          <div class="tiles" id="sb-tiles"></div>
          <p class="panel-note" id="sb-note"></p>
        </section>
      </div>

      <section class="prose">
        <h2>Three things to try</h2>
        <ol>
          <li><strong>Drag walks from 0 to 180.</strong> Batting average does not move at all — it cannot see walks. OBP, wOBA and wRC+ all climb steeply. This is the single clearest demonstration of why batting average fell out of favour.</li>
          <li><strong>Swap 20 singles for 20 home runs</strong> (drop hits stays the same, raise HR). Slugging leaps, but watch wOBA rise more modestly — because a home run is worth about 2.3 singles in real runs, not 4.</li>
          <li><strong>Set stolen bases to 40 and caught stealing to 20.</strong> A 67% success rate looks impressive in the counting stats and is worth almost exactly nothing.</li>
        </ol>
      </section>
    </article>`;

  const tiles = mount.querySelector('#sb-tiles');

  function recompute() {
    tiles.innerHTML = OUTPUTS.map((o) => {
      let value = null;
      try { value = o.fn(state); } catch { /* leave null */ }
      const scale = o.scale ? SCALES[o.scale] : null;
      const g = scale ? F.grade(value, scale) : null;
      return `
        <div class="tile${g ? ' g-' + g.toLowerCase().replace(/[^a-z]+/g, '-') : ''}">
          <span class="tile-label">${esc(o.label)}</span>
          <span class="tile-value">${F.fmt(value, o.format)}</span>
          ${g ? `<span class="tile-grade">${esc(g)}</span>` : ''}
        </div>`;
    }).join('');

    const pa = F.plateAppearances({ ...state, SH: 0, CI: 0 });
    mount.querySelector('#sb-note').textContent =
      `${pa} plate appearances · ${F.totalBases(state)} total bases · ${F.singles(state)} singles` +
      (ctx.lgwOBA ? ` · league wOBA ${F.fmt(ctx.lgwOBA, 'rate3')} (live)` : '');
  }

  mount.querySelectorAll('input[type=range]').forEach((el) => {
    el.addEventListener('input', () => {
      state[el.dataset.key] = Number(el.value);
      mount.querySelector('#sbv-' + el.dataset.key).textContent = el.value;
      recompute();
    });
  });

  function apply(values) {
    Object.assign(state, values);
    for (const s of SLIDERS) {
      const el = mount.querySelector('#sb-' + s.key);
      const v = Math.max(s.min, Math.min(s.max, state[s.key] ?? 0));
      state[s.key] = v;
      el.value = v;
      mount.querySelector('#sbv-' + s.key).textContent = v;
    }
    recompute();
  }

  mount.querySelector('#sb-reset').addEventListener('click', () => apply({ ...DEFAULTS }));

  // Populate the dropdown with real qualified hitters from the current season.
  api.leaders({ group: 'hitting', season: ctx.season, limit: 200 })
    .then((rows) => {
      const sel = mount.querySelector('#sb-player');
      sel.innerHTML = `<option value="">— pick a player —</option>` +
        rows.map((r, i) => `<option value="${i}">${esc(r.name)} (${esc(r.team)})</option>`).join('');
      sel.addEventListener('change', () => {
        const r = rows[Number(sel.value)];
        if (!r) return;
        apply({
          AB: r.AB ?? 0, H: r.H ?? 0, doubles: r.doubles ?? 0, triples: r.triples ?? 0,
          HR: r.HR ?? 0, BB: r.BB ?? 0, IBB: r.IBB ?? 0, HBP: r.HBP ?? 0,
          K: r.K ?? 0, SF: r.SF ?? 0, SB: r.SB ?? 0, CS: r.CS ?? 0,
        });
      });
    })
    .catch(() => {
      mount.querySelector('#sb-player').innerHTML = '<option>Could not load live players</option>';
    });

  recompute();
}
