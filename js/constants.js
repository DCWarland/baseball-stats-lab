/*
 * constants.js — the "magic numbers" behind advanced baseball stats.
 *
 * WHY THIS FILE EXISTS
 * Advanced stats are not pure math. They are math PLUS a set of empirically
 * measured coefficients that change every season, because run scoring changes
 * every season. A home run was worth more in 1968 (when runs were scarce) than
 * in 2019 (when they were cheap).
 *
 * Those coefficients live here so the formulas in formulas.js stay pure and
 * readable. Everything here is data; nothing here does work.
 */

/* ------------------------------------------------------------------------
 * LINEAR WEIGHTS (the engine behind wOBA)
 *
 * A "linear weight" is the average number of runs an event is worth, measured
 * by looking at every real plate appearance in a season and asking: how much
 * did the scoring situation improve when this happened?
 *
 * These are the published FanGraphs values. wOBAScale is a stretching factor
 * that rescales the result so wOBA lands on the same familiar number line as
 * OBP (roughly .320 = average, .400 = great).
 * Source: FanGraphs "Guts!" constants table.
 * ---------------------------------------------------------------------- */
export const WOBA_WEIGHTS = {
  2026: { lgwOBA: 0.317, scale: 1.221, bb: 0.691, hbp: 0.722, b1: 0.882, b2: 1.252, b3: 1.585, hr: 2.036, runSB: 0.2, runCS: -0.41, note: 'in-season estimate' },
  2025: { lgwOBA: 0.316, scale: 1.224, bb: 0.690, hbp: 0.721, b1: 0.881, b2: 1.250, b3: 1.582, hr: 2.032, runSB: 0.2, runCS: -0.41, note: 'estimate' },
  2024: { lgwOBA: 0.310, scale: 1.242, bb: 0.689, hbp: 0.720, b1: 0.882, b2: 1.254, b3: 1.590, hr: 2.050, runSB: 0.2, runCS: -0.41 },
  2023: { lgwOBA: 0.318, scale: 1.204, bb: 0.696, hbp: 0.726, b1: 0.883, b2: 1.244, b3: 1.569, hr: 2.004, runSB: 0.2, runCS: -0.41 },
  2022: { lgwOBA: 0.310, scale: 1.259, bb: 0.689, hbp: 0.720, b1: 0.884, b2: 1.261, b3: 1.601, hr: 2.072, runSB: 0.2, runCS: -0.41 },
  2021: { lgwOBA: 0.314, scale: 1.209, bb: 0.692, hbp: 0.723, b1: 0.879, b2: 1.242, b3: 1.568, hr: 2.007, runSB: 0.2, runCS: -0.41 },
  2019: { lgwOBA: 0.320, scale: 1.157, bb: 0.690, hbp: 0.719, b1: 0.870, b2: 1.217, b3: 1.529, hr: 1.940, runSB: 0.2, runCS: -0.41 },
  2015: { lgwOBA: 0.313, scale: 1.251, bb: 0.687, hbp: 0.718, b1: 0.881, b2: 1.256, b3: 1.594, hr: 2.065, runSB: 0.2, runCS: -0.41 },
  2001: { lgwOBA: 0.331, scale: 1.201, bb: 0.698, hbp: 0.729, b1: 0.883, b2: 1.238, b3: 1.558, hr: 1.979, runSB: 0.2, runCS: -0.41 },
  1994: { lgwOBA: 0.335, scale: 1.184, bb: 0.700, hbp: 0.732, b1: 0.884, b2: 1.238, b3: 1.554, hr: 1.966, runSB: 0.2, runCS: -0.41 },
  1968: { lgwOBA: 0.290, scale: 1.336, bb: 0.678, hbp: 0.708, b1: 0.877, b2: 1.276, b3: 1.632, hr: 2.140, runSB: 0.2, runCS: -0.41 },
};

/** Fall back to the closest season we have weights for. */
export function wobaWeights(season) {
  const yr = Number(season);
  if (WOBA_WEIGHTS[yr]) return { ...WOBA_WEIGHTS[yr], season: yr, exact: true };
  const years = Object.keys(WOBA_WEIGHTS).map(Number);
  const nearest = years.reduce((a, b) => (Math.abs(b - yr) < Math.abs(a - yr) ? b : a));
  return { ...WOBA_WEIGHTS[nearest], season: nearest, exact: false };
}

/* ------------------------------------------------------------------------
 * RUN EXPECTANCY MATRIX
 *
 * The single most important table in sabermetrics. For each of the 24
 * base/out states, it says: on average, how many more runs will the batting
 * team score before the inning ends?
 *
 * Every linear weight above is DERIVED from this table. Read across a row to
 * see how much an out costs; read down a column to see how much a baserunner
 * is worth. Values are a typical modern (~4.5 runs/game) environment.
 * ---------------------------------------------------------------------- */
export const RUN_EXPECTANCY = {
  // key: bases occupied. '___' = empty, '1__' = runner on first, etc.
  '___': [0.481, 0.254, 0.098],  // [0 outs, 1 out, 2 outs]
  '1__': [0.859, 0.509, 0.224],
  '_2_': [1.100, 0.664, 0.319],
  '__3': [1.350, 0.950, 0.353],
  '12_': [1.437, 0.884, 0.429],
  '1_3': [1.784, 1.130, 0.478],
  '_23': [1.964, 1.376, 0.580],
  '123': [2.292, 1.541, 0.752],
};

export const BASE_STATE_LABELS = {
  '___': 'Bases empty',
  '1__': 'Runner on 1st',
  '_2_': 'Runner on 2nd',
  '__3': 'Runner on 3rd',
  '12_': '1st and 2nd',
  '1_3': '1st and 3rd',
  '_23': '2nd and 3rd',
  '123': 'Bases loaded',
};

/* ------------------------------------------------------------------------
 * PARK FACTORS
 *
 * A park factor of 100 is neutral. 110 means the park inflates offence by
 * roughly 10%; 90 means it suppresses it by 10%. These are multi-year
 * regressed run factors, rounded — real ones are recomputed annually and
 * differ slightly between FanGraphs and Baseball-Reference.
 *
 * Used by OPS+, wRC+, ERA- and friends to stop crediting a hitter for
 * playing half his games at altitude.
 * ---------------------------------------------------------------------- */
export const PARK_FACTORS = {
  COL: { name: 'Coors Field', pf: 112 },
  CIN: { name: 'Great American Ball Park', pf: 105 },
  BOS: { name: 'Fenway Park', pf: 104 },
  KC:  { name: 'Kauffman Stadium', pf: 103 },
  PHI: { name: 'Citizens Bank Park', pf: 102 },
  BAL: { name: 'Camden Yards', pf: 101 },
  ATL: { name: 'Truist Park', pf: 101 },
  TOR: { name: 'Rogers Centre', pf: 100 },
  NYY: { name: 'Yankee Stadium', pf: 100 },
  HOU: { name: 'Daikin Park', pf: 100 },
  LAA: { name: 'Angel Stadium', pf: 100 },
  MIN: { name: 'Target Field', pf: 100 },
  CHC: { name: 'Wrigley Field', pf: 100 },
  WSH: { name: 'Nationals Park', pf: 100 },
  STL: { name: 'Busch Stadium', pf: 99 },
  ARI: { name: 'Chase Field', pf: 99 },
  TEX: { name: 'Globe Life Field', pf: 99 },
  MIL: { name: 'American Family Field', pf: 99 },
  CWS: { name: 'Rate Field', pf: 99 },
  LAD: { name: 'Dodger Stadium', pf: 98 },
  PIT: { name: 'PNC Park', pf: 98 },
  SD:  { name: 'Petco Park', pf: 97 },
  NYM: { name: 'Citi Field', pf: 97 },
  CLE: { name: 'Progressive Field', pf: 97 },
  ATH: { name: 'Sutter Health Park', pf: 97 },
  TB:  { name: 'Steinbrenner Field', pf: 97 },
  DET: { name: 'Comerica Park', pf: 96 },
  MIA: { name: 'loanDepot park', pf: 95 },
  SF:  { name: 'Oracle Park', pf: 95 },
  SEA: { name: 'T-Mobile Park', pf: 93 },
};

/* ------------------------------------------------------------------------
 * POSITIONAL ADJUSTMENT (runs per 600 PA, used by WAR)
 *
 * A shortstop and a first baseman can post identical batting lines, but the
 * shortstop is far more valuable — his position is harder, so the pool of
 * players who can handle it is smaller. WAR corrects for this by adding runs
 * to hard positions and subtracting from easy ones.
 * ---------------------------------------------------------------------- */
export const POSITION_ADJUSTMENT = {
  C:  12.5,
  SS: 7.5,
  CF: 2.5,
  '2B': 2.5,
  '3B': 2.0,
  RF: -7.5,
  LF: -7.5,
  '1B': -12.5,
  DH: -17.5,
};

/* ------------------------------------------------------------------------
 * SAMPLE SIZE STABILISATION POINTS
 *
 * How many plate appearances (or batted balls) before a stat tells you more
 * about the player than about random noise. This is the antidote to
 * "he's hitting .400 in April". Figures follow Russell Carleton's research.
 * ---------------------------------------------------------------------- */
export const STABILISATION = [
  { stat: 'Strikeout rate (K%)',    n: 60,   unit: 'PA' },
  { stat: 'Walk rate (BB%)',        n: 120,  unit: 'PA' },
  { stat: 'Home run rate (HR/PA)',  n: 170,  unit: 'PA' },
  { stat: 'Ground ball rate (GB%)', n: 80,   unit: 'batted balls' },
  { stat: 'Fly ball rate (FB%)',    n: 80,   unit: 'batted balls' },
  { stat: 'Line drive rate (LD%)',  n: 600,  unit: 'batted balls' },
  { stat: 'On-base percentage',     n: 460,  unit: 'PA' },
  { stat: 'Slugging percentage',    n: 320,  unit: 'AB' },
  { stat: 'Batting average',        n: 910,  unit: 'AB' },
  { stat: 'BABIP',                  n: 820,  unit: 'balls in play' },
  { stat: 'ISO',                    n: 160,  unit: 'PA' },
];

/* ------------------------------------------------------------------------
 * GRADING SCALES
 *
 * Used to colour-code a computed value so you develop intuition for what
 * counts as good. Thresholds are the widely used FanGraphs rules of thumb.
 * `dir: 'high'` means bigger is better; `dir: 'low'` means smaller is better.
 * ---------------------------------------------------------------------- */
export const SCALES = {
  avg:   { dir: 'high', tiers: [[0.300, 'Excellent'], [0.275, 'Above average'], [0.250, 'Average'], [0.225, 'Below average'], [-Infinity, 'Poor']] },
  obp:   { dir: 'high', tiers: [[0.390, 'Excellent'], [0.350, 'Above average'], [0.320, 'Average'], [0.300, 'Below average'], [-Infinity, 'Poor']] },
  slg:   { dir: 'high', tiers: [[0.500, 'Excellent'], [0.450, 'Above average'], [0.400, 'Average'], [0.375, 'Below average'], [-Infinity, 'Poor']] },
  ops:   { dir: 'high', tiers: [[0.900, 'Excellent'], [0.800, 'Above average'], [0.730, 'Average'], [0.690, 'Below average'], [-Infinity, 'Poor']] },
  woba:  { dir: 'high', tiers: [[0.400, 'Excellent'], [0.350, 'Above average'], [0.320, 'Average'], [0.300, 'Below average'], [-Infinity, 'Poor']] },
  iso:   { dir: 'high', tiers: [[0.250, 'Excellent'], [0.180, 'Above average'], [0.140, 'Average'], [0.110, 'Below average'], [-Infinity, 'Poor']] },
  plus:  { dir: 'high', tiers: [[140, 'Excellent'], [115, 'Above average'], [100, 'Average'], [85, 'Below average'], [-Infinity, 'Poor']] },
  minus: { dir: 'low',  tiers: [[70, 'Excellent'], [90, 'Above average'], [100, 'Average'], [115, 'Below average'], [Infinity, 'Poor']] },
  era:   { dir: 'low',  tiers: [[3.00, 'Excellent'], [3.75, 'Above average'], [4.20, 'Average'], [4.75, 'Below average'], [Infinity, 'Poor']] },
  fip:   { dir: 'low',  tiers: [[3.10, 'Excellent'], [3.70, 'Above average'], [4.20, 'Average'], [4.70, 'Below average'], [Infinity, 'Poor']] },
  whip:  { dir: 'low',  tiers: [[1.05, 'Excellent'], [1.20, 'Above average'], [1.30, 'Average'], [1.40, 'Below average'], [Infinity, 'Poor']] },
  war:   { dir: 'high', tiers: [[6, 'MVP level'], [4, 'All-Star'], [2, 'Solid starter'], [1, 'Role player'], [-Infinity, 'Replacement level']] },
  kpct:  { dir: 'low',  tiers: [[13, 'Excellent'], [18, 'Above average'], [22, 'Average'], [26, 'Below average'], [Infinity, 'Poor']] },
  bbpct: { dir: 'high', tiers: [[13, 'Excellent'], [10, 'Above average'], [8, 'Average'], [6, 'Below average'], [-Infinity, 'Poor']] },
  ev:    { dir: 'high', tiers: [[93, 'Excellent'], [90, 'Above average'], [88.5, 'Average'], [87, 'Below average'], [-Infinity, 'Poor']] },
  barrel:{ dir: 'high', tiers: [[12, 'Excellent'], [9, 'Above average'], [6.5, 'Average'], [4.5, 'Below average'], [-Infinity, 'Poor']] },
  speed: { dir: 'high', tiers: [[29.5, 'Excellent'], [28, 'Above average'], [27, 'Average'], [26, 'Below average'], [-Infinity, 'Poor']] },
};

/** Runs-to-wins converter. Roughly 10 runs = 1 win in a modern run environment. */
export const RUNS_PER_WIN = 10;

/** Replacement level: what a freely available minor-league filler produces. */
export const REPLACEMENT_RUNS_PER_600PA = -20;
