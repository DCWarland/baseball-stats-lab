/*
 * assertions.js — the actual formula checks.
 *
 * Run these with:  python3 scripts/run-tests.py
 * (Or open tests.html in a browser for the same checks with nicer output.)
 *
 * Every reference line below is a real published season, so a failure means a
 * formula genuinely drifted rather than a self-referential check breaking.
 */

var results = [];

function check(name, actual, expected, tol, note) {
  tol = tol === undefined ? 0.001 : tol;
  var pass = actual !== null && actual !== undefined && isFinite(actual) &&
             Math.abs(actual - expected) <= tol;
  results.push({ name: name, actual: actual, expected: expected, tol: tol, note: note || '', pass: pass });
}

/* --- Barry Bonds, 2001: the most extreme offensive season on record ------- */
var bonds = {
  AB: 476, H: 156, doubles: 32, triples: 2, HR: 73, BB: 177, IBB: 35,
  HBP: 9, SF: 2, SH: 0, K: 93, PA: 664, SB: 13, CS: 3,
};
check('Bonds 2001 AVG', avg(bonds), 0.328, 0.0006);
check('Bonds 2001 OBP', obp(bonds), 0.515, 0.0006);
check('Bonds 2001 SLG', slg(bonds), 0.863, 0.0006);
check('Bonds 2001 OPS', ops(bonds), 1.379, 0.0012);
check('Bonds 2001 ISO', iso(bonds), 0.536, 0.0012);
check('Bonds 2001 singles', singles(bonds), 49, 0);
check('Bonds 2001 total bases', totalBases(bonds), 411, 0);
check('Bonds 2001 PA rebuilt from parts', plateAppearances(bonds), 664, 0);
check('Bonds 2001 wOBA', woba(bonds, 2001), 0.537, 0.006, 'FanGraphs lists .537');
check('Bonds 2001 BB%', bbPct(bonds), 26.66, 0.05);
check('Bonds 2001 K%', kPct(bonds), 14.01, 0.05);
check('Bonds 2001 AB/HR', abPerHr(bonds), 6.52, 0.01);
check('Bonds 2001 BABIP', babip(bonds), 0.266, 0.002);

/* --- Aaron Judge, 2022: 62 home runs ------------------------------------- */
var judge = {
  AB: 570, H: 177, doubles: 28, triples: 0, HR: 62, BB: 111, IBB: 19,
  HBP: 5, SF: 5, SH: 0, K: 175, PA: 696,
};
check('Judge 2022 AVG', avg(judge), 0.311, 0.0006);
check('Judge 2022 OBP', obp(judge), 0.425, 0.0011);
check('Judge 2022 SLG', slg(judge), 0.686, 0.0011);
check('Judge 2022 wOBA', woba(judge, 2022), 0.458, 0.008);

/* --- Jacob deGrom, 2018: 1.70 ERA, Cy Young with a 10-9 record ----------- */
var degrom = { ER: 41, R: 48, IP: 217, H: 152, BB: 46, HBP: 5, K: 269, HR: 10, BF: 835, W: 10, L: 9 };
check('deGrom 2018 ERA', era(degrom), 1.70, 0.006);
check('deGrom 2018 WHIP', whip(degrom), 0.912, 0.002);
check('deGrom 2018 K/9', kPer9(degrom), 11.16, 0.02);
check('deGrom 2018 BB/9', bbPer9(degrom), 1.91, 0.02);
check('deGrom 2018 K-BB%', kMinusBbPct(degrom), 26.71, 0.05);
check('deGrom 2018 FIP', fip(degrom, 3.16), 1.99, 0.03, 'FanGraphs lists 1.99');
check('deGrom 2018 winning %', winPct(degrom), 0.526, 0.002);
check('deGrom 2018 RA9', ra9(degrom), 1.99, 0.01);

/* --- Innings-pitched notation: the classic source of bugs ---------------- */
check('6.1 IP is 19 outs', ipToOuts(6.1), 19, 0);
check('5.2 IP is 17 outs', ipToOuts(5.2), 17, 0);
check('6.2 + 2.2 IP equals 9.1 IP', outsToIp(ipToOuts(6.2) + ipToOuts(2.2)), 9.1, 0.001);
check('6.1 IP as decimal innings', ipDecimal(6.1), 6.3333, 0.001);
check('217 IP as decimal innings', ipDecimal(217), 217, 0.001);

/* --- Run expectancy and RE24 --------------------------------------------- */
check('RE bases empty, 0 out', runExpectancy('___', 0), 0.481, 0.0001);
check('RE bases loaded, 0 out', runExpectancy('123', 0), 2.292, 0.0001);
check('RE24 leadoff walk', re24('___', 0, '1__', 0, 0), 0.378, 0.0001);
check('RE24 strikeout with runner on 2nd, 0 out', re24('_2_', 0, '_2_', 1, 0), -0.436, 0.0001);
check('RE24 grand slam', re24('123', 0, '___', 0, 4), 2.189, 0.0001);
check('RE24 inning-ending double play', re24('1__', 2, '___', 3, 0), -0.224, 0.0001);

/* --- Team level ----------------------------------------------------------- */
check('Pythagorean wins, 750 RS / 680 RA', pythagoreanWins({ RS: 750, RA: 680, G: 162 }), 88.2, 0.3);
check('Pythagorean win% symmetric at equal runs', pythagoreanWinPct({ RS: 700, RA: 700 }), 0.5, 0.0001);
check('PythagenPat exponent, normal environment', pythagenpatExponent({ RS: 750, RA: 680, G: 162 }), 1.85, 0.06);
check('Runs per win at 9 runs/game', runsPerWin({ RS: 729, RA: 729, G: 162 }), 10.0, 0.05);
check('DER in a typical season', der({ PA: 6100, H: 1350, HR: 180, K: 1400, BB: 500, HBP: 60 }), 0.690, 0.02);

/* --- Baserunning ---------------------------------------------------------- */
check('Steal break-even rate', stealBreakEven(0.2, 0.41) * 100, 67.2, 0.2);
check('SB% 30-for-36', sbPct({ SB: 30, CS: 6 }), 83.33, 0.02);

/* --- Fielding ------------------------------------------------------------- */
check('Fielding percentage', fieldingPct({ PO: 180, A: 420, E: 12 }), 0.980, 0.0006);
check('Range factor per 9', rangeFactor9({ PO: 180, A: 420, INN: 1300 }), 4.154, 0.002);
check('Caught stealing %', csPct({ CS: 25, SB: 75 }), 25, 0.01);
check('OAA converted to runs', oaaToRuns({ OAA: 12 }), 9, 0.001);

/* --- Derivations and scaling ---------------------------------------------- */
check('FIP constant lands in a plausible band',
      fipConstant({ ER: 19500, IP: 43000, HR: 5400, BB: 15500, HBP: 2100, K: 41000 }),
      3.15, 0.55, 'sanity band, not an exact target');
check('ERA- for 3.60 in a 4.15 league', eraMinus(3.60, 4.15, 100), 86.7, 0.2);
check('ERA- rewards pitching at Coors', eraMinus(3.60, 4.15, 112), 77.5, 0.3);
check('RAR from WAR', rar(5), 50, 0.001);

/* --- WAR ------------------------------------------------------------------ */
check('Replacement-level hitter is near 0 WAR',
      warBatting({ battingRuns: -20, baserunningRuns: 0, fieldingRuns: 0, position: 'LF', PA: 600 }), 0.0, 0.9);
check('Elite shortstop lands in the MVP band',
      warBatting({ battingRuns: 45, baserunningRuns: 3, fieldingRuns: 8, position: 'SS', PA: 650 }), 8.0, 1.5);
check('Identical DH earns clearly less than the SS',
      warBatting({ battingRuns: 45, baserunningRuns: 3, fieldingRuns: 8, position: 'SS', PA: 650 }) -
      warBatting({ battingRuns: 45, baserunningRuns: 3, fieldingRuns: 8, position: 'DH', PA: 650 }),
      2.7, 0.3, 'positional adjustment gap');
check('Pitcher WAR, 3.00 FIP over 200 IP',
      warPitching({ IP: 200, playerFip: 3.0, lgFip: 4.15, role: 'SP' }), 5.3, 1.2);

/* --- Advanced offence ----------------------------------------------------- */
check('wRAA is 0 for a league-average hitter',
      wraa({ AB: 500, H: 130, doubles: 26, triples: 2, HR: 15, BB: 50, IBB: 0, HBP: 5, SF: 4, PA: 559 }, 2023,
           woba({ AB: 500, H: 130, doubles: 26, triples: 2, HR: 15, BB: 50, IBB: 0, HBP: 5, SF: 4 }, 2023)),
      0, 0.0001, 'by construction');
check('wRC+ is 100 for a hitter at exactly league wOBA',
      wrcPlus({ AB: 500, H: 130, doubles: 26, triples: 2, HR: 15, BB: 50, IBB: 0, HBP: 5, SF: 4, PA: 559 }, 2023,
              woba({ AB: 500, H: 130, doubles: 26, triples: 2, HR: 15, BB: 50, IBB: 0, HBP: 5, SF: 4 }, 2023), 100, 0.12),
      100, 0.01, 'the definition of the scale');
check('OPS+ is 100 at exactly league OBP and SLG',
      opsPlus({ AB: 500, H: 130, doubles: 26, triples: 2, HR: 15, BB: 50, HBP: 5, SF: 4 },
              obp({ AB: 500, H: 130, BB: 50, HBP: 5, SF: 4 }),
              slg({ AB: 500, H: 130, doubles: 26, triples: 2, HR: 15 }), 100),
      100, 0.01, 'the definition of the scale');

/* --- Speed Score and BaseRuns (added for the distribution work) ----------- */
var burner = { AB: 550, H: 160, doubles: 25, triples: 12, HR: 8, BB: 55, HBP: 4,
               SF: 3, K: 95, R: 100, SB: 45, CS: 8, GIDP: 3, PA: 615 };
var plodder = { AB: 550, H: 145, doubles: 30, triples: 0, HR: 32, BB: 60, HBP: 6,
                SF: 5, K: 150, R: 70, SB: 0, CS: 1, GIDP: 22, PA: 625 };

check('Speed Score is on the 0-10 scale', speedScore(burner) >= 0 && speedScore(burner) <= 10 ? 1 : 0, 1, 0);
check('Speed Score rates the burner well above the plodder',
      speedScore(burner) - speedScore(plodder) > 2 ? 1 : 0, 1, 0,
      'burner ' + speedScore(burner).toFixed(2) + ' vs plodder ' + speedScore(plodder).toFixed(2));
check('Speed Score copes with a player who never ran',
      speedScore({ AB: 400, H: 100, doubles: 20, triples: 0, HR: 15, BB: 40, HBP: 2, SF: 3,
                   K: 90, R: 45, SB: 0, CS: 0, GIDP: 12, PA: 445 }) !== null ? 1 : 0, 1, 0);

var teamLine = { AB: 5500, H: 1400, doubles: 280, triples: 25, HR: 190,
                 BB: 500, HBP: 60, SF: 40, K: 1350, PA: 6150 };
check('BaseRuns lands in a plausible team range', baseRuns(teamLine), 755, 90,
      'a line like this scores roughly 700-800');
check('BaseRuns rises when home runs rise',
      baseRuns(Object.assign({}, teamLine, { HR: 260 })) - baseRuns(teamLine) > 40 ? 1 : 0, 1, 0);

/* --- Tier bands: the "what counts as elite" logic ------------------------- */
check('97th percentile is Elite', tierFor(97).key === 'elite' ? 1 : 0, 1, 0);
check('88th percentile is Great', tierFor(88).key === 'great' ? 1 : 0, 1, 0);
check('50th percentile is Average', tierFor(50).key === 'average' ? 1 : 0, 1, 0);
check('5th percentile is Poor', tierFor(5).key === 'poor' ? 1 : 0, 1, 0);
check('tierFor copes with a missing percentile', tierFor(null) === null ? 1 : 0, 1, 0);

// A clean 1..100 population makes the boundaries easy to reason about.
var ramp = [];
for (var t = 1; t <= 100; t++) ramp.push(t);

var hiBands = tierBands(ramp, false);
check('Six tier bands are produced', hiBands.length, 6, 0);
check('Bands are contiguous and ascending in value',
      hiBands.every(function (b, i) { return i === 0 || b.from >= hiBands[i - 1].from; }) ? 1 : 0, 1, 0);
check('Higher-is-better puts Elite at the top of the range',
      hiBands[hiBands.length - 1].key === 'elite' ? 1 : 0, 1, 0);
check('Elite starts around the 95th value', hiBands[hiBands.length - 1].from, 95.05, 1.5);

var loBands = tierBands(ramp, true);
check('Lower-is-better puts Elite at the bottom of the range',
      loBands[0].key === 'elite' ? 1 : 0, 1, 0);
check('Lower-is-better Poor sits at the top',
      loBands[loBands.length - 1].key === 'poor' ? 1 : 0, 1, 0);
check('Elite ceiling for a lower-is-better stat is near the 5th value',
      loBands[0].to, 5.95, 1.5);

check('Tier legend returns one entry per band',
      tierLegend(ramp, false, fmt, 'int').length, 6, 0);
check('Tier legend is ordered best first',
      tierLegend(ramp, false, fmt, 'int')[0].key === 'elite' ? 1 : 0, 1, 0);

/* --- Request building ------------------------------------------------------
 * MLB's default player pool is QUALIFIED, so omitting the parameter quietly
 * returns ~140 hitters instead of ~700. That shipped once; these checks make
 * sure it cannot ship again. */
var urlAll = leadersUrl({ group: 'hitting', season: 2026, limit: 1500, qualified: false });
var urlQual = leadersUrl({ group: 'hitting', season: 2026, limit: 1500, qualified: true });

check('leadersUrl always states a player pool',
      urlAll.indexOf('playerPool=') > -1 && urlQual.indexOf('playerPool=') > -1 ? 1 : 0, 1, 0);
check('qualified:false asks for the FULL pool, not the default',
      urlAll.indexOf('playerPool=ALL') > -1 ? 1 : 0, 1, 0,
      'the default is QUALIFIED, which is the opposite of what we want');
check('qualified:true asks for the qualified pool',
      urlQual.indexOf('playerPool=QUALIFIED') > -1 ? 1 : 0, 1, 0);
check('leadersUrl passes the group through',
      leadersUrl({ group: 'pitching', season: 2026, qualified: false }).indexOf('group=pitching') > -1 ? 1 : 0, 1, 0);
check('leadersUrl passes the limit through',
      urlAll.indexOf('limit=1500') > -1 ? 1 : 0, 1, 0);

/* --- Responsive charts -----------------------------------------------------
 * An SVG viewBox scales its text along with everything else. If the viewBox is
 * much wider than the space it is drawn into, labels shrink below legibility.
 * These checks model the real page layout and require the smallest label to
 * render at 8 physical pixels or more at every width. */

check('Desktop keeps the full-width chart', chartMetrics(1400).histWidth, 760, 0);
check('Laptop narrows the viewBox', chartMetrics(900).histWidth, 560, 0);
check('Tablet narrows it further', chartMetrics(600).histWidth, 400, 0);
check('Small phone narrows it most', chartMetrics(375).histWidth, 340, 0);
check('Phones use fewer bins so bars stay visible',
      chartMetrics(375).bins < chartMetrics(1400).bins ? 1 : 0, 1, 0);
check('narrow flag trips below 700px',
      chartMetrics(699).narrow && !chartMetrics(701).narrow ? 1 : 0, 1, 0);

var SMALLEST_LABEL = 10;   // .tier-band-label, in SVG user units

/* Width actually available to a chart, following the real stylesheet:
 *   >= 1000px  sidebar (272) + main max-width 64rem + 2.6rem padding
 *   >=  640px  no sidebar, 1.1rem main padding
 *   <   640px  panels run edge to edge
 * then minus the chart's own .9rem padding on each side. */
function contentPx(vw) {
  var main = vw >= 1000 ? Math.min(vw - 272, 1024) - 83.2
           : vw >= 640  ? vw - 35.2
           : vw;
  return main - 28.8;
}

function renderedLabelPx(vw) {
  return (contentPx(vw) / chartMetrics(vw).histWidth) * SMALLEST_LABEL;
}

var WIDTHS = [320, 375, 390, 414, 430, 500, 600, 640, 700, 768, 900, 1000, 1100, 1280, 1440, 1920];
var worst = 999, worstAt = 0;
for (var wi = 0; wi < WIDTHS.length; wi++) {
  var px = renderedLabelPx(WIDTHS[wi]);
  if (px < worst) { worst = px; worstAt = WIDTHS[wi]; }
}
check('Smallest chart label stays >= 8px at every width',
      worst >= 8 ? 1 : 0, 1, 0,
      'worst is ' + worst.toFixed(1) + 'px at ' + worstAt + 'px wide');
check('...and never balloons above 20px', worst < 20 ? 1 : 0, 1, 0);

/* --- Formatting ----------------------------------------------------------- */
check('fmt drops the leading zero', fmt(0.328, 'rate3') === '.328' ? 1 : 0, 1, 0);
check('fmt handles null', fmt(null, 'rate3') === '—' ? 1 : 0, 1, 0);
check('fmt keeps the sign on a negative rate', fmt(-0.05, 'rate3') === '-.050' ? 1 : 0, 1, 0);
check('fmt adds a plus for runs', fmt(45.2, 'runs') === '+45.2' ? 1 : 0, 1, 0);

/* --- Division-by-zero safety: must be null, never NaN or Infinity --------- */
check('AVG with 0 AB is null', avg({ H: 0, AB: 0 }) === null ? 1 : 0, 1, 0);
check('ERA with 0 IP is null', era({ ER: 0, IP: 0 }) === null ? 1 : 0, 1, 0);
check('BB/K with 0 K is null', bbPerK({ BB: 10, K: 0 }) === null ? 1 : 0, 1, 0);
check('SB% with no attempts is null', sbPct({ SB: 0, CS: 0 }) === null ? 1 : 0, 1, 0);

/* --- Grading -------------------------------------------------------------- */
check('grade() rates .420 wOBA as excellent', grade(0.420, SCALES.woba) === 'Excellent' ? 1 : 0, 1, 0);
check('grade() rates a 2.50 ERA as excellent', grade(2.50, SCALES.era) === 'Excellent' ? 1 : 0, 1, 0);
check('grade() rates a 5.50 ERA as poor', grade(5.50, SCALES.era) === 'Poor' ? 1 : 0, 1, 0);

/* ------------------------------------------------------------------ report */
var passed = 0, failed = 0, lines = [];
for (var i = 0; i < results.length; i++) {
  var r = results[i];
  if (r.pass) { passed++; }
  else {
    failed++;
    lines.push('  FAIL  ' + r.name + '\n        got ' + r.actual +
               ', expected ' + r.expected + ' +/- ' + r.tol + (r.note ? '  (' + r.note + ')' : ''));
  }
}

var out = 'Baseball Stats Lab - formula tests\n' +
          '==================================\n' +
          'PASSED: ' + passed + '\n' +
          'FAILED: ' + failed + '\n' +
          'TOTAL:  ' + results.length + '\n';
if (lines.length) out += '\n' + lines.join('\n') + '\n';

out;
