/*
 * formulas.js — every baseball stat, as a pure function.
 *
 * A "pure function" is one that takes inputs, returns an output, and touches
 * nothing else — no screen updates, no network calls, no saved state. Same
 * inputs always give the same answer.
 *
 * That matters here for one big practical reason: because every stat is a
 * pure function of named inputs, the app can build a working calculator for
 * ANY stat automatically, just by reading the function's input list. Add a
 * new stat to the curriculum and you get a calculator for free — you never
 * write calculator UI by hand.
 */

import { wobaWeights, RUN_EXPECTANCY, RUNS_PER_WIN, POSITION_ADJUSTMENT } from './constants.js';

/* ---------------------------------------------------------------- helpers */

/** Divide safely. Baseball is full of 0-denominator cases (0 AB, 0 IP). */
const div = (a, b) => (b === 0 || b == null || !isFinite(b) ? null : a / b);

/** Convert MLB's odd innings notation (6.1 = 6⅓ innings) into real thirds. */
export function ipToOuts(ip) {
  const whole = Math.floor(ip);
  const frac = Math.round((ip - whole) * 10); // .1 => 1 out, .2 => 2 outs
  return whole * 3 + frac;
}
export function outsToIp(outs) {
  return Math.floor(outs / 3) + (outs % 3) / 10;
}
/** True decimal innings, for maths. 6.1 IP is 6.333 innings, not 6.1. */
export function ipDecimal(ip) {
  return ipToOuts(ip) / 3;
}

/* ============================================================ HITTING: RAW */

/** Singles are almost never listed; you derive them by subtraction. */
export const singles = ({ H, doubles, triples, HR }) => H - doubles - triples - HR;

/** Total Bases — weights each hit by how many bases it produced. */
export const totalBases = ({ H, doubles, triples, HR }) =>
  (H - doubles - triples - HR) + 2 * doubles + 3 * triples + 4 * HR;

/** Plate Appearances — every trip to the plate, including walks and sacrifices. */
export const plateAppearances = ({ AB, BB, HBP, SF, SH, CI = 0 }) => AB + BB + HBP + SF + SH + CI;

/** Extra-base hits. */
export const extraBaseHits = ({ doubles, triples, HR }) => doubles + triples + HR;

/* =========================================================== HITTING: RATE */

/** Batting Average — hits per at-bat. The oldest rate stat, and the weakest. */
export const avg = ({ H, AB }) => div(H, AB);

/**
 * On-Base Percentage — how often you avoid making an out.
 * Note the denominator quietly excludes sacrifice bunts (SH), a historical
 * quirk: bunting is treated as a tactic rather than a failure.
 */
export const obp = ({ H, BB, HBP, AB, SF }) => div(H + BB + HBP, AB + BB + HBP + SF);

/** Slugging — total bases per at-bat. Measures power, ignores walks entirely. */
export const slg = (v) => div(totalBases(v), v.AB);

/** OPS — OBP + SLG. Crude but useful; it adds two fractions with different denominators. */
export const ops = (v) => {
  const o = obp(v), s = slg(v);
  return o == null || s == null ? null : o + s;
};

/** Isolated Power — SLG minus AVG. Strips out singles to leave pure extra-base power. */
export const iso = (v) => {
  const s = slg(v), a = avg(v);
  return s == null || a == null ? null : s - a;
};

/** BABIP — how often balls put in play became hits. League norm ~.300. */
export const babip = ({ H, HR, AB, K, SF }) => div(H - HR, AB - K - HR + SF);

export const bbPct = ({ BB, PA }) => div(BB * 100, PA);
export const kPct = ({ K, PA }) => div(K * 100, PA);
export const bbPerK = ({ BB, K }) => div(BB, K);
export const abPerHr = ({ AB, HR }) => div(AB, HR);
export const xbhPct = (v) => div(extraBaseHits(v) * 100, v.AB);
export const sbPct = ({ SB, CS }) => div(SB * 100, SB + CS);

/* ================================================ HITTING: RUN ESTIMATORS */

/**
 * wOBA — Weighted On-Base Average. The flagship modern rate stat.
 *
 * OBP treats a walk and a home run identically (both "on base"). SLG says a
 * double is exactly twice a single, which isn't true either. wOBA fixes both
 * by weighting each event by how many runs it actually produces on average.
 * It is deliberately scaled to look like OBP so the numbers feel familiar.
 */
export const woba = (v, season = 2026) => {
  const w = wobaWeights(season);
  const uBB = v.BB - (v.IBB || 0); // intentional walks are the pitcher's choice, not the hitter's skill
  const num =
    w.bb * uBB + w.hbp * v.HBP + w.b1 * singles(v) + w.b2 * v.doubles + w.b3 * v.triples + w.hr * v.HR;
  const den = v.AB + v.BB - (v.IBB || 0) + v.SF + v.HBP;
  return div(num, den);
};

/** wRAA — Weighted Runs Above Average. Converts a wOBA rate into total runs. */
export const wraa = (v, season = 2026, lgwOBA = null) => {
  const w = wobaWeights(season);
  const league = lgwOBA ?? w.lgwOBA;
  const playerWoba = woba(v, season);
  if (playerWoba == null) return null;
  return ((playerWoba - league) / w.scale) * v.PA;
};

/** wRC — Weighted Runs Created. wRAA re-expressed as total runs, not runs above average. */
export const wrc = (v, season = 2026, lgwOBA = null, lgRperPA = 0.12) => {
  const above = wraa(v, season, lgwOBA);
  return above == null ? null : above + lgRperPA * v.PA;
};

/**
 * wRC+ — the best single offensive number in baseball.
 * Takes wRC, adjusts for the park the player hit in and the league he faced,
 * then scales so 100 = exactly league average and each point = 1% better.
 * A 140 wRC+ means "created 40% more runs than an average hitter, park-adjusted".
 */
export const wrcPlus = (v, season = 2026, lgwOBA = null, parkFactor = 100, lgRperPA = 0.12) => {
  const w = wobaWeights(season);
  const league = lgwOBA ?? w.lgwOBA;
  const playerWoba = woba(v, season);
  if (playerWoba == null) return null;
  const wraaPerPA = (playerWoba - league) / w.scale;
  const pf = parkFactor / 100;
  return ((wraaPerPA + lgRperPA) / (lgRperPA * pf)) * 100;
};

/** OPS+ — the older, cruder cousin of wRC+. 100 = average, park-adjusted. */
export const opsPlus = (v, lgOBP = 0.318, lgSLG = 0.408, parkFactor = 100) => {
  const o = obp(v), s = slg(v);
  if (o == null || s == null) return null;
  const pf = parkFactor / 100;
  return 100 * (o / (lgOBP * pf) + s / (lgSLG * pf) - 1);
};

/** Bill James' original Runs Created — the ancestor of every estimator here. */
export const runsCreatedBasic = (v) => div((v.H + v.BB) * totalBases(v), v.AB + v.BB);

/* ========================================================= RUN EXPECTANCY */

/** Look up the average runs still to score from a given base/out state. */
export const runExpectancy = (bases, outs) => {
  const row = RUN_EXPECTANCY[bases];
  return row && outs >= 0 && outs <= 2 ? row[outs] : null;
};

/**
 * RE24 — credit for how much a play changed the run expectancy.
 * This is the purest "what actually happened" stat: fully context-dependent,
 * the exact opposite of wOBA's context-neutral approach.
 */
export const re24 = (startBases, startOuts, endBases, endOuts, runsScored) => {
  const before = runExpectancy(startBases, startOuts);
  const after = endOuts >= 3 ? 0 : runExpectancy(endBases, endOuts);
  if (before == null || after == null) return null;
  return after - before + runsScored;
};

/* ================================================== PITCHING: TRADITIONAL */

export const era = ({ ER, IP }) => div(ER * 9, ipDecimal(IP));
export const ra9 = ({ R, IP }) => div(R * 9, ipDecimal(IP));
export const whip = ({ BB, H, IP }) => div(BB + H, ipDecimal(IP));
export const kPer9 = ({ K, IP }) => div(K * 9, ipDecimal(IP));
export const bbPer9 = ({ BB, IP }) => div(BB * 9, ipDecimal(IP));
export const hPer9 = ({ H, IP }) => div(H * 9, ipDecimal(IP));
export const hrPer9 = ({ HR, IP }) => div(HR * 9, ipDecimal(IP));
export const kbb = ({ K, BB }) => div(K, BB);
export const kMinusBbPct = ({ K, BB, BF }) => div((K - BB) * 100, BF);
export const winPct = ({ W, L }) => div(W, W + L);

/** Left On Base % — what share of baserunners a pitcher stranded. Norm ~72%. */
export const lobPct = ({ H, BB, HBP, R, HR }) =>
  div((H + BB + HBP - R) * 100, H + BB + HBP - 1.4 * HR);

/* ============================================ PITCHING: DEFENCE-INDEPENDENT */

/**
 * FIP — Fielding Independent Pitching.
 *
 * The idea (Voros McCracken, 1999): pitchers have far less control over what
 * happens to a ball once a fielder can reach it than anyone assumed. So judge
 * them only on the three outcomes no fielder touches — strikeouts, walks and
 * home runs — and scale the result to look like an ERA.
 *
 * cFIP is a constant that shifts the answer so league FIP equals league ERA.
 */
export const fip = ({ HR, BB, HBP, K, IP }, cFIP = 3.15) =>
  div(13 * HR + 3 * (BB + HBP) - 2 * K, ipDecimal(IP)) + cFIP;

/**
 * xFIP — FIP, but replaces the pitcher's actual home runs with the number he
 * "should" have allowed at league-average HR-per-fly-ball rate (~13%).
 * Home run rate is very noisy year to year; fly ball rate is not.
 */
export const xfip = ({ FB, BB, HBP, K, IP }, lgHrFb = 0.13, cFIP = 3.15) =>
  div(13 * (FB * lgHrFb) + 3 * (BB + HBP) - 2 * K, ipDecimal(IP)) + cFIP;

/** kwERA — a stripped-down estimator using only strikeouts and walks. */
export const kwEra = ({ K, BB, BF }) => 5.4 - 12 * div(K - BB, BF);

/**
 * SIERA — Skill-Interactive ERA. Like xFIP but adds ground ball rate and
 * non-linear terms, on the logic that a high-strikeout pitcher's walks hurt
 * less, and that lots of grounders suppress extra-base damage.
 * This is the published FanGraphs coefficient form.
 */
export const siera = ({ K, BB, GB, FB, LD, BF }) => {
  const so = div(K, BF), bb = div(BB, BF);
  const netGb = div(GB - FB - LD, BF);
  if (so == null || bb == null || netGb == null) return null;
  return (
    6.145 - 16.986 * so + 11.434 * bb - 1.858 * netGb +
    7.653 * so * so + (-6.664) * bb * bb + 10.130 * so * netGb + (-5.195) * bb * netGb
  );
};

/** Compute the FIP constant from league totals — this is how it's really derived. */
export const fipConstant = (lg) =>
  era({ ER: lg.ER, IP: lg.IP }) - div(13 * lg.HR + 3 * (lg.BB + lg.HBP) - 2 * lg.K, ipDecimal(lg.IP));

/* ================================================= PLUS / MINUS  (context) */

/** ERA-, FIP-, xFIP-: 100 = average, LOWER is better, park-adjusted. */
export const eraMinus = (playerEra, lgEra = 4.15, parkFactor = 100) =>
  div(playerEra * 100, lgEra * (parkFactor / 100));

/* ============================================================== FIELDING */

export const fieldingPct = ({ PO, A, E }) => div(PO + A, PO + A + E);
export const rangeFactorGame = ({ PO, A, G }) => div(PO + A, G);
export const rangeFactor9 = ({ PO, A, INN }) => div((PO + A) * 9, INN);
export const csPct = ({ CS, SB }) => div(CS * 100, CS + SB);

/** Convert Outs Above Average into runs. Each out prevented ≈ 0.75 runs. */
export const oaaToRuns = ({ OAA }) => OAA * 0.75;

/* ============================================================ BASERUNNING */

/**
 * wSB — Weighted Stolen Base runs. Steals help less than people think,
 * because getting caught costs about twice what a steal gains.
 */
export const wsb = ({ SB, CS, PA, BB, IBB, HBP }, season = 2026, lgWsbRate = 0) => {
  const w = wobaWeights(season);
  const opportunities = PA - BB - IBB - HBP; // rough stolen base opportunity proxy
  return w.runSB * SB + w.runCS * CS - lgWsbRate * (opportunities || 1);
};

/**
 * The break-even stolen base rate: how often you must succeed for stealing
 * to be worth attempting at all. Falls out of the run expectancy table.
 */
export const stealBreakEven = (gain = 0.2, loss = 0.41) => loss / (gain + loss);

/**
 * Speed Score — Bill James' pre-tracking attempt to infer speed from the box
 * score. Six components, each scaled 0–10, then averaged. Only the components
 * with usable denominators are included, which keeps it working for players
 * who never attempted a steal.
 */
export const speedScore = (v) => {
  const cap = (x) => (isFinite(x) ? Math.max(0, Math.min(10, x)) : null);
  const b1 = singles(v);
  const attempts = (v.SB ?? 0) + (v.CS ?? 0);
  const onBase = b1 + (v.BB ?? 0) + (v.HBP ?? 0);
  const contactOuts = (v.AB ?? 0) - (v.HR ?? 0) - (v.K ?? 0);

  const parts = [
    attempts >= 1 ? cap((div(v.SB + 3, attempts + 7) - 0.4) * 20) : null,        // success rate
    onBase > 0 ? cap(Math.sqrt(div(attempts, onBase)) / 0.07) : null,            // attempt frequency
    contactOuts > 0 ? cap((div(v.triples, contactOuts) / 0.02) * 10) : null,     // triples
    onBase > 0 ? cap((div(v.R - v.HR, v.H + v.BB + v.HBP - v.HR) - 0.1) / 0.04) : null, // scoring from base
    contactOuts > 0 ? cap((0.063 - div(v.GIDP, contactOuts)) / 0.007) : null,    // avoiding double plays
  ].filter((p) => p != null);

  return parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null;
};

/**
 * BaseRuns — the most accurate run estimator, because it models the structure
 * of an inning rather than assuming every event has a fixed value.
 *   A = baserunners  ·  B = advancement  ·  C = outs  ·  D = home runs
 * The B/(B+C) term is a score rate: what fraction of runners make it home.
 */
export const baseRuns = (v) => {
  const tb = totalBases(v);
  const A = v.H + v.BB + (v.HBP ?? 0) - v.HR;
  const B = 1.1 * (1.4 * tb - 0.6 * v.H - 3 * v.HR + 0.1 * (v.BB + (v.HBP ?? 0)));
  const C = v.AB - v.H;
  const D = v.HR;
  return B + C === 0 ? null : (A * B) / (B + C) + D;
};

/* ================================================================== WAR */

/**
 * WAR — Wins Above Replacement.
 *
 * Not really a stat so much as a recipe: convert everything a player does
 * into runs, add them up, compare to a "replacement level" scrub, then divide
 * by how many runs buy a win (~10).
 *
 * This is a simplified but structurally honest version of FanGraphs' fWAR.
 * Real WAR adds league corrections and daily-updated run environments, so
 * expect to land within a few tenths of the published figure, not on it.
 */
export const warBatting = ({ battingRuns, baserunningRuns, fieldingRuns, position, PA, replacementPer600 = 20 }) => {
  const posAdj = (POSITION_ADJUSTMENT[position] ?? 0) * (PA / 600);
  const replacement = replacementPer600 * (PA / 600);
  const totalRuns = battingRuns + baserunningRuns + fieldingRuns + posAdj + replacement;
  return totalRuns / RUNS_PER_WIN;
};

/**
 * Pitcher WAR, simplified. Same recipe as the hitter version: measure the
 * pitcher against a replacement-level scrub, in runs, then divide by ~10.
 *
 * A replacement starter allows roughly 29% more runs than average (a
 * replacement reliever ~15%, because relief innings are easier to fill).
 * That gap is the pitcher's cushion — every inning he throws better than the
 * scrub is value banked.
 */
export const warPitching = ({ IP, playerFip, lgFip = 4.15, role = 'SP' }) => {
  const innings = ipDecimal(IP);
  if (!innings) return null;
  // FIP sits on an ERA scale; total runs allowed run ~4.5% above earned runs.
  const playerR9 = playerFip * 1.045;
  const replacementR9 = lgFip * 1.045 * (role === 'SP' ? 1.29 : 1.15);
  const runsAboveReplacement = ((replacementR9 - playerR9) / 9) * innings;
  return runsAboveReplacement / RUNS_PER_WIN;
};

/** RAR — Runs Above Replacement. WAR before dividing by runs-per-win. */
export const rar = (war) => war * RUNS_PER_WIN;

/* ===================================================== TEAM / SEASON LEVEL */

/**
 * Pythagorean expectation — Bill James' discovery that a team's record is
 * almost entirely predicted by runs scored and allowed. Teams that beat their
 * Pythagorean record are usually lucky, not clutch, and tend to regress.
 */
export const pythagoreanWinPct = ({ RS, RA }, exponent = 1.83) =>
  div(Math.pow(RS, exponent), Math.pow(RS, exponent) + Math.pow(RA, exponent));

export const pythagoreanWins = ({ RS, RA, G }, exponent = 1.83) => {
  const pct = pythagoreanWinPct({ RS, RA }, exponent);
  return pct == null ? null : pct * G;
};

/** Defensive Efficiency Ratio — share of balls in play a defence turns into outs. */
export const der = ({ PA, H, HR, K, BB, HBP }) => div(PA - H - K - BB - HBP, PA - HR - K - BB - HBP);

/**
 * Runs per win, derived from the actual run environment instead of assumed.
 * In a high-scoring era runs are cheap, so it takes MORE of them to buy a win.
 * Calibrated so a normal ~9 total-runs-per-game environment returns 10.
 */
export const runsPerWin = ({ RS, RA, G }) => {
  const totalRunsPerGame = div(RS + RA, G);
  return totalRunsPerGame == null ? null : 10 * Math.sqrt(totalRunsPerGame / 9);
};

/**
 * PythagenPat — the refinement to Pythagorean expectation. Instead of always
 * using exponent 1.83, it derives the exponent from the run environment,
 * which makes it accurate in extreme eras (1968, 1930, Coors Field).
 */
export const pythagenpatExponent = ({ RS, RA, G }) => {
  const rpg = div(RS + RA, G);
  return rpg == null || rpg <= 0 ? null : Math.pow(rpg, 0.287);
};

/* ================================================================ SCALING */

/** Turn a raw value into a 100-scaled "plus" stat. */
export const toPlus = (value, leagueValue) => div(value * 100, leagueValue);
/** Turn a raw value into a 100-scaled "minus" stat (lower = better). */
export const toMinus = (value, leagueValue) => div(value * 100, leagueValue);

/* ============================================================= FORMATTING */

export function fmt(value, style) {
  if (value == null || !isFinite(value)) return '—';
  switch (style) {
    case 'rate3': // .327 — baseball drops the leading zero
      return (value < 0 ? '-' : '') + Math.abs(value).toFixed(3).replace(/^0/, '');
    case 'rate3z': return value.toFixed(3);
    case 'pct1': return value.toFixed(1) + '%';
    case 'era': return value.toFixed(2);
    case 'int': return Math.round(value).toString();
    case 'plus': return Math.round(value).toString();
    case 'one': return value.toFixed(1);
    case 'two': return value.toFixed(2);
    case 'runs': return (value > 0 ? '+' : '') + value.toFixed(1);
    default: return String(value);
  }
}

/** Grade a value against a scale from constants.js. */
export function grade(value, scale) {
  if (value == null || !scale) return null;
  for (const [threshold, label] of scale.tiers) {
    if (scale.dir === 'high' ? value >= threshold : value <= threshold) return label;
  }
  return scale.tiers[scale.tiers.length - 1][1];
}
