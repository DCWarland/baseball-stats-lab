/*
 * leaderboard.js — the sortable table shown on every stat page.
 *
 * Sorting and filtering happen in plain JavaScript on an array already in
 * memory, so every interaction is instant — no network request, no reload.
 *
 * Each row carries its percentile and tier, so the table answers "where does
 * elite start?" directly rather than making you infer it from the rank.
 */

import { fmt } from './formulas.js';
import { dataBar, percentileOf } from './charts.js';
import { tierFor, TIERS } from './tiers.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* Supporting columns shown alongside the stat itself, so the table gives
 * context rather than a bare number. */
const CONTEXT_COLUMNS = {
  hitting: [
    { key: 'PA', label: 'PA', format: 'int' },
    { key: 'H', label: 'H', format: 'int' },
    { key: 'HR', label: 'HR', format: 'int' },
    { key: 'BB', label: 'BB', format: 'int' },
    { key: 'K', label: 'SO', format: 'int' },
  ],
  pitching: [
    { key: 'IP', label: 'IP', format: 'one' },
    { key: 'K', label: 'SO', format: 'int' },
    { key: 'BB', label: 'BB', format: 'int' },
    { key: 'HR', label: 'HR', format: 'int' },
    { key: 'ER', label: 'ER', format: 'int' },
  ],
  fielding: [
    { key: 'INN', label: 'Inn', format: 'int' },
    { key: 'PO', label: 'PO', format: 'int' },
    { key: 'A', label: 'A', format: 'int' },
    { key: 'E', label: 'E', format: 'int' },
  ],
  statcast: [
    { key: 'batted', label: 'BBE', format: 'int' },
    { key: 'avgEV', label: 'EV', format: 'one' },
    { key: 'barrelPctBBE', label: 'Brl%', format: 'one' },
  ],
  expected: [
    { key: 'PA', label: 'PA', format: 'int' },
    { key: 'ba', label: 'BA', format: 'rate3' },
    { key: 'woba', label: 'wOBA', format: 'rate3' },
  ],
  speed: [
    { key: 'runs', label: 'Runs', format: 'int' },
    { key: 'bolts', label: 'Bolts', format: 'int' },
    { key: 'homeToFirst', label: 'HP→1B', format: 'two' },
  ],
  oaa: [
    { key: 'runsPrevented', label: 'Runs', format: 'int' },
    { key: 'inFront', label: 'In', format: 'int' },
    { key: 'behind', label: 'Back', format: 'int' },
  ],
};

export function renderLeaderboard(stat, population, slot, limit = 100, onSelect = null) {
  const { rows, lowerIsBetter } = population;
  if (!rows.length) {
    slot.innerHTML = `<p class="chart-empty">No qualifying players yet this season.</p>`;
    return;
  }

  const sortedValues = [...population.values].sort((a, b) => a - b);
  const valueFormat = population.format ?? stat.format;

  // Attach percentile and tier once, so sorting and filtering are cheap.
  for (const r of rows) {
    r.pct = percentileOf(r.value, sortedValues, lowerIsBetter);
    r.tier = tierFor(r.pct);
  }

  const contextKey = population.source ?? population.group;
  const extras = (CONTEXT_COLUMNS[contextKey] ?? []).filter((c) => rows.some((r) => isFinite(r[c.key])));

  const columns = [
    { key: '__rank', label: '#', sortable: false, cls: 'col-rank' },
    { key: 'name', label: population.entity === 'club' ? 'Club' : 'Player', type: 'text', cls: 'col-name' },
    ...(population.entity === 'club' ? [] : [{ key: 'team', label: 'Team', type: 'text', cls: 'col-team' }]),
    { key: 'value', label: population.label ?? stat.abbr, format: valueFormat, cls: 'col-value' },
    { key: 'pct', label: 'Pct', format: 'int', cls: 'col-pct' },
    { key: 'pct', label: 'Tier', sortable: false, cls: 'col-tier' },
    ...extras.map((e) => ({ ...e, type: 'num' })),
  ];

  const teams = [...new Set(rows.map((r) => r.team).filter(Boolean))].sort();
  const state = { key: 'value', dir: lowerIsBetter ? 'asc' : 'desc', team: '', tier: '' };

  slot.innerHTML = `
    <section class="panel leaderboard">
      <div class="panel-head">
        <h2>Leaderboard — ${esc(population.label ?? stat.abbr)}</h2>
        <span class="lb-count"></span>
      </div>

      <div class="lb-tools">
        <input class="lb-filter" type="search" placeholder="Filter by name…" aria-label="Filter by name">
        ${teams.length > 1 ? `
        <select class="lb-team" aria-label="Filter by club">
          <option value="">All clubs</option>
          ${teams.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join('')}
        </select>` : ''}
        <select class="lb-tier" aria-label="Filter by tier">
          <option value="">All tiers</option>
          ${TIERS.map((t) => `<option value="${t.key}">${esc(t.label)} — ${esc(t.blurb)}</option>`).join('')}
        </select>
      </div>

      <p class="panel-note">Click a column heading to re-sort, or a row to place that ${population.entity} on the curve above. ${esc(population.source ? 'Values published by Baseball Savant.' : 'Values computed in your browser using the formula above.')}</p>

      <div class="table-scroll">
        <table class="data-table lb-table">
          <thead><tr>${columns.map((c) => `
            <th class="${c.cls ?? ''}${c.sortable === false ? '' : ' sortable'}"
                ${c.sortable === false ? '' : `data-key="${c.key}" data-type="${c.type ?? 'num'}" tabindex="0" role="button"`}>${esc(c.label)}<span class="sort-arrow"></span></th>`).join('')}
          </tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </section>`;

  const tbody = slot.querySelector('tbody');
  const nameBox = slot.querySelector('.lb-filter');
  const teamBox = slot.querySelector('.lb-team');
  const tierBox = slot.querySelector('.lb-tier');
  const countEl = slot.querySelector('.lb-count');

  const vMin = Math.min(...rows.map((r) => r.value));
  const vMax = Math.max(...rows.map((r) => r.value));

  function draw() {
    const q = nameBox.value.trim().toLowerCase();
    let view = rows;
    if (q) view = view.filter((r) => `${r.name} ${r.team ?? ''}`.toLowerCase().includes(q));
    if (state.team) view = view.filter((r) => r.team === state.team);
    if (state.tier) view = view.filter((r) => r.tier?.key === state.tier);

    const sorted = [...view].sort((a, b) => {
      const col = columns.find((c) => c.key === state.key);
      const av = a[state.key], bv = b[state.key];
      if (col?.type === 'text') {
        const cmp = String(av ?? '').localeCompare(String(bv ?? ''));
        return state.dir === 'asc' ? cmp : -cmp;
      }
      const an = isFinite(av) ? av : (state.dir === 'asc' ? Infinity : -Infinity);
      const bn = isFinite(bv) ? bv : (state.dir === 'asc' ? Infinity : -Infinity);
      return state.dir === 'asc' ? an - bn : bn - an;
    });

    // A club or tier filter is a deliberate narrowing — show all of it.
    const cap = (state.team || state.tier) ? sorted.length : limit;
    const shown = sorted.slice(0, cap);

    tbody.innerHTML = shown.map((r) => `
      <tr${onSelect ? ` class="clickable" data-rank="${r.rank}" tabindex="0"` : ''}>
        <td class="col-rank">${r.rank}</td>
        <td class="col-name">${esc(r.name)}</td>
        ${population.entity === 'club' ? '' : `<td class="col-team">${esc(shortTeam(r.team))}</td>`}
        <td class="col-value">
          <span class="value-num">${fmt(r.value, valueFormat)}</span>
          ${dataBar(r.value, vMin, vMax, lowerIsBetter)}
        </td>
        <td class="col-pct">${r.pct == null ? '—' : Math.round(r.pct)}</td>
        <td class="col-tier">${r.tier ? `<span class="tier-badge t-${r.tier.key}">${esc(r.tier.label)}</span>` : ''}</td>
        ${extras.map((e) => `<td>${fmt(r[e.key], e.format)}</td>`).join('')}
      </tr>`).join('');

    countEl.textContent = shown.length === sorted.length
      ? `${shown.length} of ${rows.length}`
      : `top ${shown.length} of ${sorted.length}`;

    if (onSelect) {
      tbody.querySelectorAll('tr.clickable').forEach((tr) => {
        const pick = () => {
          const row = rows.find((r) => String(r.rank) === tr.dataset.rank);
          if (row) onSelect(row);
        };
        tr.addEventListener('click', pick);
        tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); pick(); } });
      });
    }

    slot.querySelectorAll('th.sortable').forEach((th) => {
      const active = th.dataset.key === state.key;
      th.classList.toggle('sorted', active);
      th.querySelector('.sort-arrow').textContent = active ? (state.dir === 'asc' ? '▲' : '▼') : '';
    });
  }

  slot.querySelectorAll('th.sortable').forEach((th) => {
    const sort = () => {
      const key = th.dataset.key;
      if (state.key === key) state.dir = state.dir === 'asc' ? 'desc' : 'asc';
      else {
        state.key = key;
        // Sensible first click: names A–Z, numbers best-first.
        state.dir = th.dataset.type === 'text' ? 'asc' : (key === 'value' && lowerIsBetter ? 'asc' : 'desc');
      }
      draw();
    };
    th.addEventListener('click', sort);
    th.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sort(); } });
  });

  nameBox.addEventListener('input', draw);
  teamBox?.addEventListener('change', () => { state.team = teamBox.value; draw(); });
  tierBox.addEventListener('change', () => { state.tier = tierBox.value; draw(); });
  draw();
}

/** MLB returns full club names; the table reads better with a short form. */
function shortTeam(name) {
  if (!name) return '—';
  const parts = String(name).split(' ');
  return parts.length > 1 ? parts[parts.length - 1] : name;
}
