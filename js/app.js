/*
 * app.js — the router and shell.
 *
 * A "router" watches the part of the URL after the # (the hash) and decides
 * what to show. Because the hash never triggers a page reload, the site feels
 * instant, and — crucially — it works on GitHub Pages with no server
 * configuration at all. Every URL is shareable and the back button works.
 */

import { MODULES, ALL_STATS, STAT_BY_PATH, search, COURSE_STATS } from './content/index.js';
import { renderStat, ctx, esc } from './render.js';
import { renderSandbox } from './sandbox.js';
import { renderTeam } from './team.js';
import * as api from './api.js';
import * as F from './formulas.js';
import { wobaWeights } from './constants.js';

const main = document.getElementById('main');
const nav = document.getElementById('nav-modules');

/* ------------------------------------------------------------- live context
 * Before anything else, find out what season it is and what "average" means
 * right now. Every adjusted stat depends on this.
 */
async function loadContext() {
  try {
    const season = await api.currentSeason();
    ctx.season = season.year;

    const [hit, pit] = await Promise.all([
      api.leagueTotals(season.year, 'hitting'),
      api.leagueTotals(season.year, 'pitching'),
    ]);

    // League wOBA, computed from real summed league totals rather than assumed.
    ctx.lgwOBA = F.woba(hit, season.year);
    ctx.lgOBP = F.obp(hit);
    ctx.lgSLG = F.slg(hit);
    ctx.lgRperPA = hit.R / hit.PA;
    ctx.cFIP = F.fipConstant({ ER: pit.ER, IP: pit.IP, HR: pit.HR, BB: pit.BB, HBP: pit.HBP, K: pit.K });
    // ERA− and pitcher WAR both need to know what an average pitcher looks like.
    ctx.lgERA = F.era({ ER: pit.ER, IP: pit.IP });
    ctx.lgFIP = F.fip(pit, ctx.cFIP);
    ctx.lgTotals = { hitting: hit, pitching: pit };
    ctx.ready = true;

    document.getElementById('season-badge').textContent = `${season.year} season · live`;
  } catch (e) {
    document.getElementById('season-badge').textContent = 'offline — using stored constants';
    ctx.lgwOBA = wobaWeights(ctx.season).lgwOBA;
    ctx.ready = false;
    console.warn('Live context unavailable:', e.message);
  }
}

/* -------------------------------------------------------------------- nav */

function buildNav() {
  nav.innerHTML = MODULES.map((m, i) => `
    <details class="nav-module"${i === 0 ? ' open' : ''} data-module="${m.id}">
      <summary><span class="nav-num">${i + 1}</span>${esc(m.title)}</summary>
      <ul>
        ${m.stats.map((s) => `
          <li><a href="#/stat/${m.id}/${s.id}" data-path="${m.id}/${s.id}">
            <span class="nav-abbr">${esc(s.abbr)}</span>
            <span class="nav-name">${esc(s.name)}</span>
          </a></li>`).join('')}
      </ul>
    </details>`).join('');
}

function highlightNav(path) {
  nav.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.dataset.path === path));
  const moduleId = path?.split('/')[0];
  nav.querySelectorAll('.nav-module').forEach((d) => {
    if (d.dataset.module === moduleId) d.open = true;
  });
}

/* ----------------------------------------------------------------- routes */

function route() {
  const hash = location.hash.slice(1) || '/';
  const parts = hash.split('/').filter(Boolean);
  main.scrollTop = 0;
  window.scrollTo(0, 0);

  if (parts[0] === 'stat' && parts[1] && parts[2]) {
    const path = `${parts[1]}/${parts[2]}`;
    const stat = STAT_BY_PATH.get(path);
    if (stat) {
      renderStat(stat, main);
      highlightNav(path);
      document.title = `${stat.abbr} — ${stat.name} · Baseball Stats Lab`;
      return;
    }
  }

  highlightNav(null);
  document.title = 'Baseball Stats Lab';

  if (parts[0] === 'team') return renderTeam(main, parts[1]);
  if (parts[0] === 'sandbox') return renderSandbox(main);
  if (parts[0] === 'glossary') return renderGlossary(main);
  if (parts[0] === 'live') return renderLiveDashboard(main);
  return renderHome(main);
}

/* -------------------------------------------------------------------- home */

function renderHome(mount) {
  mount.innerHTML = `
    <article class="home">
      <header class="hero">
        <p class="hero-kicker">A working reference · ${ctx.season} season</p>
        <h1>Baseball Stats Lab</h1>
        <p class="hero-lede">Every baseball statistic — from batting average to wRC+ to Statcast barrel rate — explained, calculated, and set against the whole league.</p>
        <div class="hero-actions">
          <a class="btn" href="#/stat/counting/pa">Start the course</a>
          <a class="btn-secondary" href="#/team">Team views</a>
          <a class="btn-secondary" href="#/live">Live leaderboards</a>
          <a class="btn-secondary" href="#/sandbox">Sandbox</a>
        </div>
        <div class="hero-stats">
          <div><strong>${COURSE_STATS.stats}</strong><span>statistics</span></div>
          <div><strong>${COURSE_STATS.calculators}</strong><span>live calculators</span></div>
          <div><strong>${COURSE_STATS.distributions}</strong><span>league curves</span></div>
          <div><strong>${COURSE_STATS.modules}</strong><span>modules</span></div>
        </div>
      </header>


      <div class="stitch" aria-hidden="true"></div>

      <section class="prose">
        <h2>How this works</h2>
        <p>Statistics are taught in the order they were invented, because each one exists to fix a specific flaw in the one before it. Batting average ignores walks, so on-base percentage was created. On-base percentage treats a walk like a home run, so slugging appeared. Both misprice events, so wOBA measured the real run values. wOBA ignores the ballpark, so wRC+ adjusted for it.</p>
        <p>Follow that chain and the advanced stats stop being intimidating jargon — they become obvious answers to problems you have already felt.</p>
        <p><strong>Every number on this site is live.</strong> Each lesson ends with the real distribution of that statistic across every qualifying major leaguer this season, a marker showing where your calculator lands on it, and a sortable table of the top 100 — all generated by running the same formula the lesson just taught you over live MLB data.</p>
        <p>League averages, park context and the FIP constant are derived by summing all thirty clubs' totals from MLB's own feed. Statcast measurements come from Baseball Savant.</p>
      </section>

      <div class="stitch" aria-hidden="true"></div>

      <section class="module-grid">
        ${MODULES.map((m, i) => `
          <a class="module-card" href="#/stat/${m.id}/${m.stats[0].id}">
            <span class="module-num">Module ${i + 1}</span>
            <h3>${esc(m.title)}</h3>
            <p>${esc(m.blurb)}</p>
            <span class="module-count">${m.stats.length} statistics</span>
          </a>`).join('')}
      </section>
    </article>`;
}

/* ---------------------------------------------------------------- glossary */

function renderGlossary(mount) {
  const sorted = [...ALL_STATS].sort((a, b) => a.abbr.localeCompare(b.abbr));
  mount.innerHTML = `
    <article class="lesson">
      <header class="lesson-head">
        <p class="crumb">Reference</p>
        <h1>A–Z Glossary</h1>
        <p class="lede">All ${ALL_STATS.length} statistics in the course, alphabetically. Click any one to jump to its lesson.</p>
      </header>
      <div class="table-scroll">
        <table class="data-table glossary">
          <thead><tr><th>Abbr.</th><th>Name</th><th>What it measures</th><th>Module</th></tr></thead>
          <tbody>
            ${sorted.map((s) => `
              <tr>
                <td><a href="#/stat/${s.path}"><strong>${esc(s.abbr)}</strong></a></td>
                <td><a href="#/stat/${s.path}">${esc(s.name)}</a></td>
                <td>${esc(s.short ?? '')}</td>
                <td class="muted">${esc(s.moduleTitle)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </article>`;
}

/* ---------------------------------------------------------- live dashboard */

function renderLiveDashboard(mount) {
  mount.innerHTML = `
    <article class="lesson">
      <header class="lesson-head">
        <p class="crumb">Live data</p>
        <h1>This Season, Right Now</h1>
        <p class="lede">Everything below is fetched from MLB and Baseball Savant when the page loads, then the advanced stats are computed in your browser from the raw counting numbers.</p>
      </header>
      <div id="live-context"><p class="loading">Loading league context</p></div>
      <div id="live-board"><p class="loading">Loading hitting leaders</p></div>
      <div id="live-pitch"><p class="loading">Loading pitching leaders</p></div>
    </article>`;

  renderLeagueContext(mount.querySelector('#live-context'));
  renderComputedLeaderboard(mount.querySelector('#live-board'));
  renderPitchingBoard(mount.querySelector('#live-pitch'));
}

function renderLeagueContext(slot) {
  if (!ctx.ready) { slot.innerHTML = `<p class="error">Live league context is unavailable — check your connection.</p>`; return; }
  const h = ctx.lgTotals.hitting;
  slot.innerHTML = `
    <section class="panel">
      <div class="panel-head"><h2>League context, computed live</h2><span class="panel-meta">${ctx.season} · all 30 clubs</span></div>
      <p class="panel-note">These values feed every park- and league-adjusted stat on the site.</p>
      <div class="tiles">
        <div class="tile hl-tile"><span class="tile-label">League wOBA</span><span class="tile-value">${F.fmt(ctx.lgwOBA, 'rate3')}</span></div>
        <div class="tile"><span class="tile-label">League OBP</span><span class="tile-value">${F.fmt(ctx.lgOBP, 'rate3')}</span></div>
        <div class="tile"><span class="tile-label">League SLG</span><span class="tile-value">${F.fmt(ctx.lgSLG, 'rate3')}</span></div>
        <div class="tile"><span class="tile-label">Runs per PA</span><span class="tile-value">${F.fmt(ctx.lgRperPA, 'rate3')}</span></div>
        <div class="tile hl-tile"><span class="tile-label">FIP constant</span><span class="tile-value">${F.fmt(ctx.cFIP, 'two')}</span></div>
        <div class="tile"><span class="tile-label">League HR</span><span class="tile-value">${(h.HR ?? 0).toLocaleString()}</span></div>
      </div>
    </section>`;
}

function renderComputedLeaderboard(slot) {
  api.leaders({ group: 'hitting', season: ctx.season, limit: 200 })
    .then((rows) => {
      const enriched = rows.map((r) => {
        const v = { ...r, PA: r.PA ?? F.plateAppearances({ ...r, CI: 0 }) };
        return {
          ...v,
          woba: F.woba(v, ctx.season),
          wraa: F.wraa(v, ctx.season, ctx.lgwOBA),
          wrcPlus: F.wrcPlus(v, ctx.season, ctx.lgwOBA, 100, ctx.lgRperPA),
          iso: F.iso(v),
          kPct: F.kPct(v),
          bbPct: F.bbPct(v),
        };
      }).filter((r) => isFinite(r.wrcPlus)).sort((a, b) => b.wrcPlus - a.wrcPlus).slice(0, 30);

      slot.innerHTML = `
        <section class="panel">
          <div class="panel-head"><h2>${ctx.season} hitting leaders, by wRC+</h2><span class="panel-meta">qualified batters</span></div>
          <p class="panel-note">MLB publishes the raw counting stats but not wOBA or wRC+. The shaded columns were calculated in your browser using this season's live league context — the same code the lessons taught you.</p>
          <div class="table-scroll">
            <table class="data-table">
              <thead><tr>
                <th>#</th><th>Player</th><th>Team</th><th>PA</th><th>AVG</th><th>OBP</th><th>SLG</th>
                <th>ISO</th><th>BB%</th><th>K%</th><th class="calc-col">wOBA</th><th class="calc-col">wRAA</th><th class="calc-col">wRC+</th>
              </tr></thead>
              <tbody>
                ${enriched.map((r, i) => `
                  <tr>
                    <td>${i + 1}</td>
                    <td><strong>${esc(r.name)}</strong></td>
                    <td class="muted">${esc(r.team)}</td>
                    <td>${r.PA}</td>
                    <td>${F.fmt(F.avg(r), 'rate3')}</td>
                    <td>${F.fmt(F.obp(r), 'rate3')}</td>
                    <td>${F.fmt(F.slg(r), 'rate3')}</td>
                    <td>${F.fmt(r.iso, 'rate3')}</td>
                    <td>${F.fmt(r.bbPct, 'pct1')}</td>
                    <td>${F.fmt(r.kPct, 'pct1')}</td>
                    <td class="calc-col">${F.fmt(r.woba, 'rate3')}</td>
                    <td class="calc-col">${F.fmt(r.wraa, 'runs')}</td>
                    <td class="calc-col"><strong>${F.fmt(r.wrcPlus, 'plus')}</strong></td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
          <p class="readout">Park factors are held neutral (100) in this table — open the wRC+ lesson to apply a real one and see how much a ballpark moves a hitter.</p>
        </section>`;
    })
    .catch((e) => {
      slot.innerHTML = `<p class="error">Could not load leaderboard: ${esc(e.message)}</p>`;
    });
}

/** The pitching mirror: FIP, xFIP-style peripherals and ERA side by side. */
function renderPitchingBoard(slot) {
  api.leaders({ group: 'pitching', season: ctx.season, limit: 200 })
    .then((rows) => {
      const enriched = rows
        .map((r) => ({
          ...r,
          era: F.era(r),
          fip: F.fip(r, ctx.cFIP),
          whip: F.whip(r),
          k9: F.kPer9(r),
          bb9: F.bbPer9(r),
          kbb: F.kMinusBbPct(r),
          lob: F.lobPct(r),
        }))
        .filter((r) => isFinite(r.fip))
        .sort((a, b) => a.fip - b.fip)
        .slice(0, 30);

      slot.innerHTML = `
        <section class="panel">
          <div class="panel-head"><h2>${ctx.season} pitching leaders, by FIP</h2><span class="panel-meta">qualified pitchers</span></div>
          <p class="panel-note">Compare the ERA and FIP columns. Where they disagree sharply, the pitcher's results have run ahead of — or behind — what his strikeouts, walks and home runs actually earned.</p>
          <div class="table-scroll">
            <table class="data-table">
              <thead><tr>
                <th>#</th><th>Player</th><th>Team</th><th>IP</th><th>ERA</th><th>WHIP</th>
                <th>K/9</th><th>BB/9</th><th>LOB%</th><th class="calc-col">K−BB%</th><th class="calc-col">FIP</th><th class="calc-col">E−F</th>
              </tr></thead>
              <tbody>
                ${enriched.map((r, i) => {
                  const gap = r.era - r.fip;
                  return `
                  <tr>
                    <td>${i + 1}</td>
                    <td class="col-name">${esc(r.name)}</td>
                    <td class="col-team">${esc(r.team)}</td>
                    <td>${F.fmt(F.ipDecimal(r.IP), 'one')}</td>
                    <td>${F.fmt(r.era, 'era')}</td>
                    <td>${F.fmt(r.whip, 'two')}</td>
                    <td>${F.fmt(r.k9, 'two')}</td>
                    <td>${F.fmt(r.bb9, 'two')}</td>
                    <td>${F.fmt(r.lob, 'pct1')}</td>
                    <td class="calc-col">${F.fmt(r.kbb, 'pct1')}</td>
                    <td class="calc-col"><strong>${F.fmt(r.fip, 'era')}</strong></td>
                    <td class="calc-col ${gap > 0.4 ? 'pos' : gap < -0.4 ? 'neg' : ''}">${F.fmt(gap, 'runs')}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
          <p class="readout">A positive <strong>E−F</strong> means his ERA is worse than his peripherals deserved — usually a sign of bad luck or poor defence behind him, and a candidate to improve.</p>
        </section>`;
    })
    .catch((e) => {
      slot.innerHTML = `<p class="error">Could not load pitching leaders: ${esc(e.message)}</p>`;
    });
}

/* ------------------------------------------------------------------ search */

function wireSearch() {
  const box = document.getElementById('search');
  const results = document.getElementById('search-results');

  const close = () => { results.hidden = true; results.innerHTML = ''; };

  box.addEventListener('input', () => {
    const hits = search(box.value);
    if (!hits.length) return close();
    results.hidden = false;
    results.innerHTML = hits.map((s) => `
      <a href="#/stat/${s.path}">
        <span class="nav-abbr">${esc(s.abbr)}</span>
        <span class="nav-name">${esc(s.name)}</span>
        <span class="search-module">${esc(s.moduleTitle)}</span>
      </a>`).join('');
  });

  box.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { box.value = ''; close(); box.blur(); }
    if (e.key === 'Enter') {
      const first = results.querySelector('a');
      if (first) { location.hash = first.getAttribute('href').slice(1); box.value = ''; close(); box.blur(); }
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrap')) close();
  });

  // Press "/" anywhere to jump to search — a convention borrowed from docs sites.
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== box) { e.preventDefault(); box.focus(); }
  });
}

/* -------------------------------------------------------------------- theme */

function wireTheme() {
  const btn = document.getElementById('theme-toggle');
  const stored = localStorage.getItem('bsl:theme');
  if (stored) document.documentElement.dataset.theme = stored;

  btn.addEventListener('click', () => {
    const current = document.documentElement.dataset.theme
      ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('bsl:theme', next);
  });
}

function wireMenu() {
  const btn = document.getElementById('menu-toggle');
  btn.addEventListener('click', () => document.body.classList.toggle('nav-open'));
  document.getElementById('sidebar').addEventListener('click', (e) => {
    if (e.target.closest('a')) document.body.classList.remove('nav-open');
  });
}

/* --------------------------------------------------------------------- boot */

buildNav();
wireSearch();
wireTheme();
wireMenu();
window.addEventListener('hashchange', route);

// Draw immediately so the page never looks empty, then redraw once live
// league context has arrived (adjusted stats need it).
route();
loadContext().then(route);
