/*
 * team.js — the club view: every player on one team, side by side.
 *
 * The point here is intra-team comparison. Every cell is coloured by the
 * player's percentile against the WHOLE LEAGUE, not against his teammates —
 * so a roster of blue and green cells is a good team, and you can see at a
 * glance which positions are carrying it and which are sinking it.
 */

import * as F from './formulas.js';
import * as api from './api.js';
import { ctx } from './render.js';
import { percentileOf } from './charts.js';
import { tierFor, TIERS } from './tiers.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* The columns each table shows, with how to compute them and which way is
 * good. `lower` marks stats where a smaller number is better. */
const HITTING_COLS = [
  { key: 'PA', label: 'PA', fn: (r) => r.PA, format: 'int', plain: true },
  { key: 'AVG', label: 'AVG', fn: (r) => F.avg(r), format: 'rate3' },
  { key: 'OBP', label: 'OBP', fn: (r) => F.obp(r), format: 'rate3' },
  { key: 'SLG', label: 'SLG', fn: (r) => F.slg(r), format: 'rate3' },
  { key: 'ISO', label: 'ISO', fn: (r) => F.iso(r), format: 'rate3' },
  { key: 'BB%', label: 'BB%', fn: (r) => F.bbPct(r), format: 'pct1' },
  { key: 'K%', label: 'K%', fn: (r) => F.kPct(r), format: 'pct1', lower: true },
  { key: 'BABIP', label: 'BABIP', fn: (r) => F.babip(r), format: 'rate3' },
  { key: 'wOBA', label: 'wOBA', fn: (r, c) => F.woba(r, c.season), format: 'rate3' },
  { key: 'wRC+', label: 'wRC+', fn: (r, c) => F.wrcPlus(r, c.season, c.lgwOBA, 100, c.lgRperPA), format: 'plus' },
  { key: 'HR', label: 'HR', fn: (r) => r.HR, format: 'int', plain: true },
  { key: 'RBI', label: 'RBI', fn: (r) => r.RBI, format: 'int', plain: true },
  { key: 'SB', label: 'SB', fn: (r) => r.SB, format: 'int', plain: true },
];

const PITCHING_COLS = [
  { key: 'IP', label: 'IP', fn: (r) => F.ipDecimal(r.IP), format: 'one', plain: true },
  { key: 'ERA', label: 'ERA', fn: (r) => F.era(r), format: 'era', lower: true },
  { key: 'FIP', label: 'FIP', fn: (r, c) => F.fip(r, c.cFIP), format: 'era', lower: true },
  { key: 'WHIP', label: 'WHIP', fn: (r) => F.whip(r), format: 'two', lower: true },
  { key: 'K/9', label: 'K/9', fn: (r) => F.kPer9(r), format: 'two' },
  { key: 'BB/9', label: 'BB/9', fn: (r) => F.bbPer9(r), format: 'two', lower: true },
  { key: 'K-BB%', label: 'K−BB%', fn: (r) => F.kMinusBbPct(r), format: 'pct1' },
  { key: 'HR/9', label: 'HR/9', fn: (r) => F.hrPer9(r), format: 'two', lower: true },
  { key: 'LOB%', label: 'LOB%', fn: (r) => F.lobPct(r), format: 'pct1' },
  { key: 'W', label: 'W', fn: (r) => r.W, format: 'int', plain: true },
  { key: 'SV', label: 'SV', fn: (r) => r.saves, format: 'int', plain: true },
];

/* Playing-time floors: below these, rate stats are too noisy to colour. */
const MIN_PA = 150;
const MIN_OUTS = 90;

export async function renderTeam(mount, teamId) {
  mount.innerHTML = `
    <article class="lesson">
      <header class="lesson-head">
        <p class="crumb">Clubs</p>
        <h1>Team View</h1>
        <p class="lede">Every player on one club, with each cell coloured by where he ranks against the entire league.</p>
      </header>
      <p class="loading">Loading rosters and league context</p>
    </article>`;

  try {
    const [teams, hitters, pitchers] = await Promise.all([
      api.teamList(),
      api.leaders({ group: 'hitting', season: ctx.season, limit: 1500, qualified: false }),
      api.leaders({ group: 'pitching', season: ctx.season, limit: 1500, qualified: false }),
    ]);

    const chosen = teamId ? teams.find((t) => String(t.id) === String(teamId)) : null;
    const active = chosen ?? teams[0];

    // League reference sets: every qualifying player, so percentiles mean
    // "against the league", not "against this roster".
    const leagueHit = hitters.filter((r) => (r.PA ?? 0) >= MIN_PA);
    const leaguePit = pitchers.filter((r) => (r.outs ?? 0) >= MIN_OUTS);
    const hitRef = buildReference(HITTING_COLS, leagueHit);
    const pitRef = buildReference(PITCHING_COLS, leaguePit);

    const teamHitters = hitters
      .filter((r) => r.teamId === active.id && (r.PA ?? 0) >= 25)
      .sort((a, b) => (b.PA ?? 0) - (a.PA ?? 0));
    const teamPitchers = pitchers
      .filter((r) => r.teamId === active.id && (r.outs ?? 0) >= 15)
      .sort((a, b) => (b.outs ?? 0) - (a.outs ?? 0));

    mount.innerHTML = `
      <article class="lesson">
        <header class="lesson-head">
          <p class="crumb">Clubs</p>
          <h1>${esc(active.name)}</h1>
          <p class="lede">Every cell is coloured by that player's percentile against the whole league — so you can see at a glance who is carrying the roster and who is sinking it.</p>
        </header>

        <div class="team-bar">
          <label for="team-select">Club</label>
          <select id="team-select">
            ${teams.map((t) => `<option value="${t.id}"${t.id === active.id ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}
          </select>
          <span class="team-meta">${teamHitters.length} hitters · ${teamPitchers.length} pitchers · ${ctx.season}</span>
        </div>

        <div class="tier-legend">
          ${TIERS.map((t) => `<span class="tier-chip t-${t.key}"><span class="tier-chip-label">${esc(t.label)}</span><span class="tier-chip-range">${esc(t.blurb)}</span></span>`).join('')}
        </div>

        ${gridTable('Hitters', HITTING_COLS, teamHitters, hitRef, MIN_PA, 'PA')}
        ${gridTable('Pitchers', PITCHING_COLS, teamPitchers, pitRef, MIN_OUTS, 'outs')}

        <p class="readout">Grey cells are players below the playing-time floor (${MIN_PA} plate appearances, ${MIN_OUTS / 3} innings). Their numbers are shown but not ranked, because rate stats built on tiny samples are mostly noise.</p>
      </article>`;

    mount.querySelector('#team-select').addEventListener('change', (e) => {
      location.hash = `#/team/${e.target.value}`;
    });
  } catch (e) {
    mount.querySelector('.loading')?.replaceWith(
      Object.assign(document.createElement('p'), { className: 'error', textContent: `Could not load team data: ${e.message}` }));
  }
}

/** Sorted league-wide values for each column, so percentiles can be looked up. */
function buildReference(cols, leagueRows) {
  const ref = {};
  for (const col of cols) {
    if (col.plain) continue;
    const vals = [];
    for (const r of leagueRows) {
      let v;
      try { v = col.fn(r, ctx); } catch { continue; }
      if (v != null && isFinite(v)) vals.push(v);
    }
    ref[col.key] = vals.sort((a, b) => a - b);
  }
  return ref;
}

function gridTable(title, cols, rows, ref, minValue, minField) {
  if (!rows.length) return `<section class="panel"><div class="panel-head"><h2>${esc(title)}</h2></div><p class="chart-empty">No players yet.</p></section>`;

  return `
    <section class="panel">
      <div class="panel-head"><h2>${esc(title)}</h2><span class="panel-meta">sorted by playing time</span></div>
      <div class="table-scroll">
        <table class="data-table team-grid">
          <thead><tr>
            <th class="col-name">Player</th><th class="col-team">Pos</th>
            ${cols.map((c) => `<th>${esc(c.label)}</th>`).join('')}
          </tr></thead>
          <tbody>
            ${rows.map((r) => {
              const ranked = (r[minField] ?? 0) >= minValue;
              return `<tr>
                <td class="col-name">${esc(r.name)}</td>
                <td class="col-team">${esc(r.position ?? '')}</td>
                ${cols.map((c) => {
                  let v;
                  try { v = c.fn(r, ctx); } catch { v = null; }
                  if (v == null || !isFinite(v)) return '<td class="cell-na">—</td>';
                  if (c.plain) return `<td>${F.fmt(v, c.format)}</td>`;
                  if (!ranked) return `<td class="cell-unranked">${F.fmt(v, c.format)}</td>`;
                  const pct = percentileOf(v, ref[c.key] ?? [], !!c.lower);
                  const tier = tierFor(pct);
                  return `<td class="cell t-${tier ? tier.key : 'none'}" title="${esc(c.label)} ${F.fmt(v, c.format)} — ${Math.round(pct)}th percentile, ${tier ? tier.label : ''}">${F.fmt(v, c.format)}</td>`;
                }).join('')}
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </section>`;
}
