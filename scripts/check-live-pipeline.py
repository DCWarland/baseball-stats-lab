#!/usr/bin/env python3
"""
check-live-pipeline.py — prove the live data pipeline actually works.

The formula tests check the maths. The smoke test checks the curriculum. This
checks the join between them: that real MLB API responses, run through the same
normalise() + compute() path the website uses, produce sensible distributions.

It is the closest thing to loading the site without a browser. It fetches real
current-season data, feeds it through the actual JavaScript, and reports the
distribution of each stat so you can eyeball whether the numbers are plausible.

Usage:  python3 scripts/check-live-pipeline.py
"""

import json
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MLB = 'https://statsapi.mlb.com/api/v1'


def strip_modules(src: str) -> str:
    src = re.sub(r'^\s*import\s+.*?;\s*$', '', src, flags=re.MULTILINE | re.DOTALL)
    src = re.sub(r'^\s*export\s+\{[^}]*\};?\s*$', '', src, flags=re.MULTILINE)
    return re.sub(r'^(\s*)export\s+', r'\1', src, flags=re.MULTILINE)


# Baseball Savant rejects requests with no User-Agent (Python sends none by
# default), so we set one. Browsers always send one, which is why the site
# itself is unaffected.
UA = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) baseball-stats-lab/1.2'}


def _open(url: str):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60)


def fetch(url: str):
    with _open(url) as r:
        return json.loads(r.read().decode())


def fetch_csv(url: str):
    import csv, io
    with _open(url) as r:
        text = r.read().decode('utf-8-sig')
    return [dict(row) for row in csv.DictReader(io.StringIO(text))]


def app_url(**kwargs) -> str:
    """Ask api.js itself for the URL, so this script tests the real request."""
    args = json.dumps(kwargs)  # json.dumps already emits JS-compatible true/false
    js = (strip_modules((ROOT / 'js' / 'api.js').read_text())
          + f'\nleadersUrl({args});')
    tmp = ROOT / 'scripts' / '.url.tmp.js'
    tmp.write_text(js)
    try:
        r = subprocess.run(['osascript', '-l', 'JavaScript', str(tmp)],
                           capture_output=True, text=True, timeout=30)
    finally:
        tmp.unlink(missing_ok=True)
    return (r.stdout or '').strip()


def main() -> int:
    season = fetch(f'{MLB}/seasons/current?sportId=1')['seasons'][0]['seasonId']
    print(f'Season: {season}\nFetching live league data…\n')

    # IMPORTANT: ask api.js to build these URLs rather than writing them here.
    # Hand-writing them is exactly how the playerPool bug survived — the script
    # requested the full pool while the app quietly requested only qualifiers.
    hit_url = app_url(group='hitting', season=season, limit=1500, qualified=False)
    pit_url = app_url(group='pitching', season=season, limit=1500, qualified=False)
    print(f'App request URL (hitting): {hit_url}')
    if 'playerPool=ALL' not in hit_url:
        print('FAIL: the app is not requesting the full player pool')
        return 1

    hitting = fetch(hit_url)
    pitching = fetch(pit_url)
    teamHit = fetch(f'{MLB}/teams/stats?season={season}&group=hitting&stats=season&sportId=1')
    teamPit = fetch(f'{MLB}/teams/stats?season={season}&group=pitching&stats=season&sportId=1')

    # Savant's pitcher batted-ball leaderboard is what makes SIERA and xFIP
    # computable, so the join it feeds gets exercised here too.
    savant = fetch_csv(
        f'https://baseballsavant.mlb.com/leaderboard/statcast'
        f'?type=pitcher&year={season}&position=&team=&min=q&csv=true')
    print(f'Savant pitcher batted-ball rows: {len(savant)}')

    payload = {
        'hitting': [s['stat'] | {'__pos': s.get('position', {}).get('abbreviation', '')} for s in hitting['stats'][0]['splits']],
        'pitching': [s['stat'] | {'__id': s['player']['id']} for s in pitching['stats'][0]['splits']],
        'teamHit': [s['stat'] | {'__id': s['team']['id']} for s in teamHit['stats'][0]['splits']],
        'teamPit': [s['stat'] | {'__id': s['team']['id']} for s in teamPit['stats'][0]['splits']],
        'savant': savant,
    }

    # api.js has no top-level side effects, so the whole file can be loaded and
    # its internal normalise() called directly — the same function the site uses.
    bundle = '\n'.join([
        strip_modules((ROOT / 'js' / 'constants.js').read_text()),
        strip_modules((ROOT / 'js' / 'formulas.js').read_text()),
        strip_modules((ROOT / 'js' / 'api.js').read_text()),
        f'var RAW = {json.dumps(payload)};',
        RUNNER,
    ])

    tmp = ROOT / 'scripts' / '.live.tmp.js'
    tmp.write_text(bundle)
    try:
        res = subprocess.run(['osascript', '-l', 'JavaScript', str(tmp)],
                             capture_output=True, text=True, timeout=180)
    finally:
        tmp.unlink(missing_ok=True)

    out = (res.stdout or '') + (res.stderr or '')
    print(out.strip())
    return 0 if 'PROBLEMS: 0' in out else 1


RUNNER = r"""
function pct(sorted, q) {
  var pos = (sorted.length - 1) * q, b = Math.floor(pos), rest = pos - b;
  return sorted[b + 1] !== undefined ? sorted[b] + rest * (sorted[b + 1] - sorted[b]) : sorted[b];
}

var problems = [];
var lines = [];

function report(name, values, fmtStyle, expect) {
  var s = values.slice().sort(function (a, b) { return a - b; });
  if (s.length < 20) { problems.push(name + ': only ' + s.length + ' players computed'); return; }
  var med = pct(s, 0.5), p10 = pct(s, 0.10), p90 = pct(s, 0.90);
  lines.push(
    pad(name, 12) + pad(String(s.length), 6) +
    pad(fmt(p10, fmtStyle), 10) + pad(fmt(med, fmtStyle), 10) +
    pad(fmt(p90, fmtStyle), 10) +
    pad(fmt(s[0], fmtStyle), 10) + fmt(s[s.length - 1], fmtStyle)
  );
  // Sanity band: is the league median where baseball says it should be?
  if (expect && (med < expect[0] || med > expect[1])) {
    problems.push(name + ': median ' + fmt(med, fmtStyle) + ' outside expected band ' +
                  fmt(expect[0], fmtStyle) + '–' + fmt(expect[1], fmtStyle));
  }
}

function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }

/* ------- hitters: normalise exactly as the site does, then apply formulas -- */
var hitters = [];
for (var i = 0; i < RAW.hitting.length; i++) {
  var r = normalise(RAW.hitting[i], 'hitting');
  r.__pos = RAW.hitting[i].__pos;
  if ((r.PA || 0) >= 150) hitters.push(r);
}

var pitchers = [];
for (var j = 0; j < RAW.pitching.length; j++) {
  var p = normalise(RAW.pitching[j], 'pitching');
  p.__id = RAW.pitching[j].__id;
  if ((p.outs || 0) >= 90) pitchers.push(p);
}

function collect(rows, fn) {
  var out = [];
  for (var k = 0; k < rows.length; k++) {
    var v;
    try { v = fn(rows[k]); } catch (e) { continue; }
    if (v !== null && v !== undefined && isFinite(v)) out.push(v);
  }
  return out;
}

lines.push(pad('STAT', 12) + pad('N', 6) + pad('10th', 10) + pad('MEDIAN', 10) + pad('90th', 10) + pad('MIN', 10) + 'MAX');
lines.push('---------------------------------------------------------------------------');

report('AVG',   collect(hitters, function (r) { return avg(r); }),   'rate3', [0.230, 0.270]);
report('OBP',   collect(hitters, function (r) { return obp(r); }),   'rate3', [0.290, 0.345]);
report('SLG',   collect(hitters, function (r) { return slg(r); }),   'rate3', [0.360, 0.450]);
report('OPS',   collect(hitters, function (r) { return ops(r); }),   'rate3z',[0.660, 0.790]);
report('ISO',   collect(hitters, function (r) { return iso(r); }),   'rate3', [0.110, 0.190]);
report('BABIP', collect(hitters, function (r) { return babip(r); }), 'rate3', [0.270, 0.325]);
report('BB%',   collect(hitters, function (r) { return bbPct(r); }), 'pct1',  [6, 11]);
report('K%',    collect(hitters, function (r) { return kPct(r); }),  'pct1',  [17, 25]);
report('wOBA',  collect(hitters, function (r) { return woba(r, 2026); }), 'rate3', [0.290, 0.345]);

lines.push('');
report('ERA',   collect(pitchers, function (r) { return era(r); }),   'era',  [3.40, 4.90]);
report('WHIP',  collect(pitchers, function (r) { return whip(r); }),  'two',  [1.10, 1.42]);
report('K/9',   collect(pitchers, function (r) { return kPer9(r); }), 'two',  [7.0, 10.5]);
report('BB/9',  collect(pitchers, function (r) { return bbPer9(r); }),'two',  [2.2, 4.2]);
report('FIP',   collect(pitchers, function (r) { return fip(r, 3.15); }), 'era', [3.40, 4.90]);
report('LOB%',  collect(pitchers, function (r) { return lobPct(r); }), 'pct1', [66, 78]);

/* ------- the newly added formulas and joined sources ---------------------- */
report('Spd', collect(hitters, function (r) { return speedScore(r); }), 'two', [3.5, 6.5]);

/* Offensive WAR: batting + position + replacement, the same function the
   WAR lessons plot. */
var POSADJ = POSITION_ADJUSTMENT;
function offWar(r) {
  var runs = wraa(r, 2026, null);
  if (runs === null || !r.PA) return null;
  return (runs + (POSADJ[r.__pos] || 0) * (r.PA / 600) + 20 * (r.PA / 600)) / 10;
}
report('oWAR', collect(hitters, offWar), 'one', [0.4, 2.2]);
report('pWAR', collect(pitchers, function (r) {
  return warPitching({ IP: r.IP, playerFip: fip(r, 3.15), lgFip: 4.15,
                       role: (r.GS || 0) >= 5 ? 'SP' : 'RP' });
}), 'one', [0.0, 1.2]);
report('ERA-', collect(pitchers, function (r) { return eraMinus(era(r), 4.15, 100); }), 'plus', [82, 118]);

/* The Savant join: SIERA and the batted-ball profile need ground balls and
   fly-ball/line-drive counts that MLB's feed does not publish. */
var savantById = {};
for (var sv = 0; sv < RAW.savant.length; sv++) {
  var row = RAW.savant[sv];
  savantById[Number(row.player_id)] = { GB: Number(row.gb), FBLD: Number(row.fbld) };
}
var joined = [];
for (var jj = 0; jj < pitchers.length; jj++) {
  var pr = pitchers[jj], extra = savantById[pr.__id];
  if (extra && (pr.outs || 0) >= 120) joined.push(Object.assign({}, pr, extra));
}
lines.push('');
lines.push('Joined MLB+Savant pitchers: ' + joined.length);
if (joined.length < 30) problems.push('Savant join produced only ' + joined.length + ' pitchers');
report('SIERA', collect(joined, function (r) {
  return siera({ K: r.K, BB: r.BB, GB: r.GB, FB: r.FBLD, LD: 0, BF: r.BF });
}), 'era', [3.20, 5.00]);
report('xFIP', collect(joined, function (r) {
  return xfip({ FB: r.FBLD * 0.62, BB: r.BB, HBP: r.HBP, K: r.K, IP: r.IP }, 0.13, 3.15);
}), 'era', [3.30, 5.10]);
report('GB%', collect(joined, function (r) {
  return r.GB + r.FBLD > 0 ? (r.GB / (r.GB + r.FBLD)) * 100 : null;
}), 'pct1', [38, 52]);

/* ------- team level: 30 clubs, merged hitting and pitching ---------------- */
var pitByTeam = {};
for (var tp = 0; tp < RAW.teamPit.length; tp++) {
  var t = RAW.teamPit[tp];
  pitByTeam[t.__id] = normalise(t, 'pitching');
}
var teams = [];
for (var th = 0; th < RAW.teamHit.length; th++) {
  var raw = RAW.teamHit[th];
  var h = normalise(raw, 'hitting'), pt = pitByTeam[raw.__id] || {};
  teams.push(Object.assign({}, h, {
    RS: h.R, RA: pt.R, G: h.G,
    paAgainst: (pt.AB || 0) + (pt.BB || 0) + (pt.HBP || 0) + (pt.SF || 0) + (pt.SH || 0),
    hAgainst: pt.H, hrAgainst: pt.HR, kAgainst: pt.K, bbAgainst: pt.BB, hbpAgainst: pt.HBP,
  }));
}
lines.push('');
lines.push('Clubs: ' + teams.length);
if (teams.length !== 30) problems.push('Expected 30 clubs, got ' + teams.length);
report('PythWins', collect(teams, function (r) { return pythagoreanWins(r); }), 'one', [55, 85]);
report('RunDiff', collect(teams, function (r) { return r.RS - r.RA; }), 'int', [-90, 90]);
report('DER', collect(teams, function (r) {
  return der({ PA: r.paAgainst, H: r.hAgainst, HR: r.hrAgainst, K: r.kAgainst, BB: r.bbAgainst, HBP: r.hbpAgainst });
}), 'rate3', [0.665, 0.730]);
report('RPW', collect(teams, function (r) { return runsPerWin(r); }), 'two', [9.0, 11.5]);

/* BaseRuns should land close to the runs a club actually scored. */
var brErr = [];
for (var bi = 0; bi < teams.length; bi++) {
  var br = baseRuns(teams[bi]);
  if (br !== null && teams[bi].RS) brErr.push(Math.abs(br - teams[bi].RS) / teams[bi].RS * 100);
}
var meanErr = brErr.reduce(function (a, b) { return a + b; }, 0) / brErr.length;
lines.push('');
lines.push('BaseRuns mean error vs actual runs scored: ' + meanErr.toFixed(1) + '%');
if (meanErr > 8) problems.push('BaseRuns is off by ' + meanErr.toFixed(1) + '% on average — too high');

/* League wOBA from summed totals should land near the individual median. */
var tot = { AB: 0, H: 0, doubles: 0, triples: 0, HR: 0, BB: 0, IBB: 0, HBP: 0, SF: 0, PA: 0, K: 0 };
for (var m = 0; m < hitters.length; m++) {
  var h = hitters[m];
  tot.AB += h.AB || 0; tot.H += h.H || 0; tot.doubles += h.doubles || 0;
  tot.triples += h.triples || 0; tot.HR += h.HR || 0; tot.BB += h.BB || 0;
  tot.IBB += h.IBB || 0; tot.HBP += h.HBP || 0; tot.SF += h.SF || 0;
  tot.PA += h.PA || 0; tot.K += h.K || 0;
}
var lgw = woba(tot, 2026);
lines.push('');
lines.push('League wOBA from summed totals: ' + fmt(lgw, 'rate3'));
if (!(lgw > 0.28 && lgw < 0.36)) problems.push('League wOBA ' + fmt(lgw, 'rate3') + ' is implausible');

if (RAW.hitting.length < 400) problems.push('Only ' + RAW.hitting.length + ' hitters returned — the full player pool should be ~700');
if (RAW.pitching.length < 400) problems.push('Only ' + RAW.pitching.length + ' pitchers returned — the full player pool should be ~800');

var out = 'Live pipeline check\n===================\n' +
          'Hitters returned:  ' + RAW.hitting.length + '\n' +
          'Pitchers returned: ' + RAW.pitching.length + '\n' +
          'Hitters (150+ PA): ' + hitters.length + '\n' +
          'Pitchers (30+ IP): ' + pitchers.length + '\n\n' +
          lines.join('\n') + '\n\nPROBLEMS: ' + problems.length + '\n';
if (problems.length) out += '\n' + problems.join('\n') + '\n';
out;
"""


if __name__ == '__main__':
    sys.exit(main())
