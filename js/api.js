/*
 * api.js — the live data layer.
 *
 * Two sources, both of which allow browsers to read them directly (they send
 * an "Access-Control-Allow-Origin: *" header, which is the permission slip a
 * browser demands before letting one website read another's data):
 *
 *   1. MLB Stats API      — official raw counting stats, updated live
 *   2. Baseball Savant    — Statcast tracking data (exit velocity, xwOBA…)
 *
 * Because both are open, this whole site works as plain static files on
 * GitHub Pages. There is no server, no API key, and nothing to deploy.
 *
 * Neither source publishes wOBA, wRC+, FIP or WAR. We compute those ourselves
 * in formulas.js — which is the point of the project.
 */

const MLB = 'https://statsapi.mlb.com/api/v1';
const SAVANT = 'https://baseballsavant.mlb.com/leaderboard';

/* ------------------------------------------------------------------ cache */
/*
 * Caching matters here. Savant CSVs are hundreds of kilobytes, and we'd
 * otherwise re-download them every time you click a lesson. We keep results
 * in memory for the session and in localStorage for 6 hours.
 */
const memory = new Map();
const TTL_MS = 6 * 60 * 60 * 1000;

/* Bump this whenever a change alters the SHAPE or CONTENT of a cached response.
 * Old entries then miss and are refetched, instead of a browser serving stale
 * data from before the fix. (v2: the playerPool bug — every "all players"
 * request had been silently returning only qualified players.) */
const CACHE_VERSION = 2;
const CACHE_PREFIX = `bsl:v${CACHE_VERSION}:`;

async function cached(key, loader) {
  if (memory.has(key)) return memory.get(key);

  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (raw) {
      const { at, data } = JSON.parse(raw);
      if (Date.now() - at < TTL_MS) {
        memory.set(key, data);
        return data;
      }
    }
  } catch { /* localStorage can be full or disabled; not fatal */ }

  const data = await loader();
  memory.set(key, data);
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), data }));
  } catch { /* quota exceeded — the in-memory copy still works */ }
  return data;
}

export function clearCache() {
  memory.clear();
  Object.keys(localStorage)
    .filter((k) => k.startsWith('bsl:'))
    .forEach((k) => localStorage.removeItem(k));
}

/* Drop entries written by an older cache version, so upgrading doesn't leave
 * megabytes of dead data sitting in localStorage. Runs once on load. */
try {
  Object.keys(localStorage)
    .filter((k) => k.startsWith('bsl:') && !k.startsWith(CACHE_PREFIX))
    .forEach((k) => localStorage.removeItem(k));
} catch { /* localStorage unavailable; nothing to clean */ }

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (${res.status}) — ${url}`);
  return res.json();
}

/* -------------------------------------------------------------- CSV parse */
/*
 * Savant returns CSV, not JSON. This parser handles the two things that break
 * naive `split(',')`: quoted fields containing commas ("Judge, Aaron"), and a
 * byte-order mark at the start of the file (an invisible character that would
 * otherwise corrupt the first column name).
 */
export function parseCsv(text) {
  const clean = text.replace(/^﻿/, '');
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++; }  // escaped quote
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }

  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1)
    .filter((r) => r.length === headers.length)
    .map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i]])));
}

async function getCsv(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Savant request failed (${res.status})`);
  const text = await res.text();
  if (text.trimStart().startsWith('<')) throw new Error('Savant returned a web page instead of data');
  return parseCsv(text);
}

/* ------------------------------------------------------------------ MLB */

/** All 30 clubs, for the team selector. */
export async function teamList() {
  return cached('teamlist', async () => {
    const d = await getJson(`${MLB}/teams?sportId=1`);
    return (d.teams ?? [])
      .map((t) => ({ id: t.id, name: t.name, abbr: t.abbreviation, division: t.division?.name ?? '' }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });
}

/** Which season is MLB currently in, and is it actually underway? */
export async function currentSeason() {
  return cached('season', async () => {
    const d = await getJson(`${MLB}/seasons/current?sportId=1`);
    const s = d.seasons[0];
    return {
      year: Number(s.seasonId),
      regularSeasonStart: s.regularSeasonStartDate,
      regularSeasonEnd: s.regularSeasonEndDate,
      qualifierPA: s.qualifierPlateAppearances,   // 3.1 PA per team game
      qualifierOuts: s.qualifierOutsPitched,      // 1 IP per team game
    };
  });
}

/**
 * Build the leaderboard URL.
 *
 * Kept as its own exported function purely so the tests can check it without a
 * network call — because this line has bitten us once already.
 *
 * MLB's default player pool is QUALIFIED. Omitting the parameter therefore does
 * NOT mean "everyone"; it silently returns only the ~140 qualified hitters. The
 * pool must always be stated explicitly.
 */
export function leadersUrl({ group = 'hitting', season, limit = 200, qualified = true }) {
  const pool = qualified ? 'QUALIFIED' : 'ALL';
  return `${MLB}/stats?stats=season&group=${group}&season=${season}&sportId=1&limit=${limit}&playerPool=${pool}`;
}

/**
 * Season leaderboard of raw stats.
 * group: 'hitting' | 'pitching' | 'fielding'
 */
export async function leaders({ group = 'hitting', season, limit = 200, qualified = true }) {
  const key = `lead:${group}:${season}:${limit}:${qualified}`;
  return cached(key, async () => {
    const url = leadersUrl({ group, season, limit, qualified });
    const d = await getJson(url);
    const splits = d.stats?.[0]?.splits ?? [];
    return splits.map((s) => ({
      id: s.player.id,
      name: s.player.fullName,
      team: s.team?.name ?? '—',
      teamId: s.team?.id,
      position: s.position?.abbreviation ?? '',
      season: Number(s.season),
      ...normalise(s.stat, group),
    }));
  });
}

/** A single player's season line. */
export async function playerSeason(playerId, season, group = 'hitting') {
  const key = `player:${playerId}:${season}:${group}`;
  return cached(key, async () => {
    const d = await getJson(`${MLB}/people/${playerId}/stats?stats=season&group=${group}&season=${season}`);
    const split = d.stats?.[0]?.splits?.[0];
    if (!split) return null;
    return { id: playerId, season: Number(split.season), team: split.team?.name, ...normalise(split.stat, group) };
  });
}

/** Free-text player search, for the "look up any player" box. */
export async function searchPlayers(query) {
  if (!query || query.length < 3) return [];
  const d = await getJson(`${MLB}/people/search?names=${encodeURIComponent(query)}&limit=25`);
  return (d.people ?? []).map((p) => ({
    id: p.id,
    name: p.fullName,
    position: p.primaryPosition?.abbreviation ?? '',
    active: p.active,
    debut: p.mlbDebutDate,
  }));
}

/**
 * League-wide totals, built by summing all 30 teams.
 *
 * This is genuinely important: wRC+, OPS+, FIP and ERA- all need to know what
 * "average" is RIGHT NOW. Rather than hardcoding a guess, we add up every
 * team's line and derive the real league context live.
 */
export async function leagueTotals(season, group = 'hitting') {
  const key = `league:${season}:${group}`;
  return cached(key, async () => {
    const d = await getJson(`${MLB}/teams/stats?season=${season}&group=${group}&stats=season&sportId=1`);
    const splits = d.stats?.[0]?.splits ?? [];
    const sum = {};
    const COUNTING = ['G','AB','R','H','doubles','triples','HR','RBI','BB','IBB','K','HBP','SF','SH','SB','CS','PA','TB','GIDP','ER','BF','outs','saves','W','L'];
    for (const s of splits) {
      const n = normalise(s.stat, group);
      for (const f of COUNTING) if (typeof n[f] === 'number') sum[f] = (sum[f] ?? 0) + n[f];
      if (n.outs) sum.outs = sum.outs ?? 0; // ensured above
    }
    // Innings pitched must be summed as OUTS, never as the 6.1-style decimal.
    if (group === 'pitching') sum.IP = Math.floor(sum.outs / 3) + (sum.outs % 3) / 10;
    sum.teams = splits.length;
    sum.season = Number(season);
    return sum;
  });
}

/**
 * Translate MLB's field names into the short abbreviations the formulas use.
 * Keeping this in one place means the rest of the app never has to know that
 * MLB calls strikeouts "strikeOuts" and doubles "doubles".
 */
function normalise(stat, group) {
  const num = (v) => (v == null || v === '' || v === '-.--' ? null : Number(String(v).replace(/^\./, '0.')));
  const base = {
    G: stat.gamesPlayed ?? null,
    R: stat.runs ?? null,
    H: stat.hits ?? null,
    doubles: stat.doubles ?? null,
    triples: stat.triples ?? null,
    HR: stat.homeRuns ?? null,
    BB: stat.baseOnBalls ?? null,
    IBB: stat.intentionalWalks ?? 0,
    K: stat.strikeOuts ?? null,
    HBP: stat.hitByPitch ?? stat.hitBatsmen ?? 0,
    AB: stat.atBats ?? null,
    SB: stat.stolenBases ?? null,
    CS: stat.caughtStealing ?? null,
    GIDP: stat.groundIntoDoublePlay ?? null,
    SF: stat.sacFlies ?? 0,
    SH: stat.sacBunts ?? 0,
    TB: stat.totalBases ?? null,
    GO: stat.groundOuts ?? null,
    AO: stat.airOuts ?? null,
    pitches: stat.numberOfPitches ?? null,
  };

  if (group === 'hitting') {
    return {
      ...base,
      PA: stat.plateAppearances ?? null,
      RBI: stat.rbi ?? null,
      LOB: stat.leftOnBase ?? null,
      CI: stat.catchersInterference ?? 0,
      // MLB's own published rate stats — useful for checking our maths.
      mlbAvg: num(stat.avg), mlbObp: num(stat.obp), mlbSlg: num(stat.slg),
      mlbOps: num(stat.ops), mlbBabip: num(stat.babip),
    };
  }

  if (group === 'pitching') {
    return {
      ...base,
      IP: num(stat.inningsPitched),
      outs: stat.outs ?? null,
      ER: stat.earnedRuns ?? null,
      BF: stat.battersFaced ?? null,
      W: stat.wins ?? null, L: stat.losses ?? null,
      GS: stat.gamesStarted ?? null, GF: stat.gamesFinished ?? null,
      CG: stat.completeGames ?? null, SHO: stat.shutouts ?? null,
      saves: stat.saves ?? null, saveOpps: stat.saveOpportunities ?? null,
      holds: stat.holds ?? null, blownSaves: stat.blownSaves ?? null,
      balks: stat.balks ?? null, wildPitches: stat.wildPitches ?? null,
      pickoffs: stat.pickoffs ?? null,
      strikes: stat.strikes ?? null,
      inheritedRunners: stat.inheritedRunners ?? null,
      inheritedScored: stat.inheritedRunnersScored ?? null,
      mlbEra: num(stat.era), mlbWhip: num(stat.whip),
      mlbK9: num(stat.strikeoutsPer9Inn), mlbBb9: num(stat.walksPer9Inn),
    };
  }

  // fielding
  return {
    G: stat.gamesPlayed ?? null,
    GS: stat.gamesStarted ?? null,
    PO: stat.putOuts ?? null,
    A: stat.assists ?? null,
    E: stat.errors ?? null,
    TC: stat.chances ?? null,
    DP: stat.doublePlays ?? null,
    TP: stat.triplePlays ?? null,
    INN: num(stat.innings),
    throwingErrors: stat.throwingErrors ?? null,
    mlbFpct: num(stat.fielding),
    mlbRf9: num(stat.rangeFactorPer9Inn),
    mlbRfg: num(stat.rangeFactorPerGame),
  };
}

/* -------------------------------------------------------------- SAVANT */

/** Expected stats: xBA, xSLG, xwOBA — what the contact "deserved". */
export async function expectedStats(season, minPA = 100) {
  return cached(`savant:expected:${season}:${minPA}`, async () => {
    const rows = await getCsv(
      `${SAVANT}/expected_statistics?type=batter&year=${season}&position=&team=&min=${minPA}&csv=true`
    );
    return rows.map((r) => ({
      id: Number(r.player_id),
      name: flipName(r['last_name, first_name']),
      PA: Number(r.pa),
      BIP: Number(r.bip),
      ba: Number(r.ba), xba: Number(r.est_ba),
      slg: Number(r.slg), xslg: Number(r.est_slg),
      woba: Number(r.woba), xwoba: Number(r.est_woba),
      wobaDiff: Number(r.est_woba_minus_woba_diff),
    }));
  });
}

/** Batted-ball quality: exit velocity, launch angle, barrels, hard-hit rate. */
export async function statcastBatting(season) {
  return cached(`savant:statcast:${season}`, async () => {
    const rows = await getCsv(
      `${SAVANT}/statcast?type=batter&year=${season}&position=&team=&min=q&csv=true`
    );
    return rows.map((r) => ({
      id: Number(r.player_id),
      name: flipName(r['last_name, first_name']),
      batted: Number(r.attempts),
      avgLaunchAngle: Number(r.avg_hit_angle),
      sweetSpotPct: Number(r.anglesweetspotpercent),
      maxEV: Number(r.max_hit_speed),
      avgEV: Number(r.avg_hit_speed),
      ev50: Number(r.ev50),
      maxDistance: Number(r.max_distance),
      avgHrDistance: Number(r.avg_hr_distance),
      hardHit: Number(r.ev95plus),
      hardHitPct: Number(r.ev95percent) * 100,
      barrels: Number(r.barrels),
      barrelPctBBE: Number(r.brl_percent),
      barrelPctPA: Number(r.brl_pa),
    }));
  });
}

/** Sprint speed, in feet per second. 27 ft/s is average; 30+ is elite. */
export async function sprintSpeed(season, minRuns = 10) {
  return cached(`savant:speed:${season}:${minRuns}`, async () => {
    const rows = await getCsv(`${SAVANT}/sprint_speed?year=${season}&position=&team=&min=${minRuns}&csv=true`);
    return rows.map((r) => ({
      id: Number(r.player_id),
      name: flipName(r['last_name, first_name']),
      team: r.team,
      position: r.position,
      age: Number(r.age),
      runs: Number(r.competitive_runs),
      bolts: Number(r.bolts),
      homeToFirst: Number(r.hp_to_1b),
      sprintSpeed: Number(r.sprint_speed),
    }));
  });
}

/** Outs Above Average — the modern range-based fielding metric. */
export async function outsAboveAverage(season) {
  return cached(`savant:oaa:${season}`, async () => {
    const rows = await getCsv(`${SAVANT}/outs_above_average?type=Fielder&year=${season}&min=1&csv=true`);
    return rows.map((r) => ({
      id: Number(r.player_id),
      name: flipName(r['last_name, first_name']),
      team: r.display_team_name,
      position: r.primary_pos_formatted,
      runsPrevented: Number(r.fielding_runs_prevented),
      oaa: Number(r.outs_above_average),
      inFront: Number(r.outs_above_average_infront),
      behind: Number(r.outs_above_average_behind),
      toward3B: Number(r.outs_above_average_lateral_toward3bline),
      toward1B: Number(r.outs_above_average_lateral_toward1bline),
      successRate: r.actual_success_rate_formatted,
      expectedRate: r.adj_estimated_success_rate_formatted,
    }));
  });
}

/** Pitcher expected stats — the source of xERA. */
export async function expectedStatsPitcher(season, minPA = 100) {
  return cached(`savant:expectedP:${season}:${minPA}`, async () => {
    const rows = await getCsv(
      `${SAVANT}/expected_statistics?type=pitcher&year=${season}&position=&team=&min=${minPA}&csv=true`
    );
    return rows.map((r) => ({
      id: Number(r.player_id),
      name: flipName(r['last_name, first_name']),
      PA: Number(r.pa),
      era: Number(r.era), xera: Number(r.xera),
      eraMinusXera: Number(r.era_minus_xera_diff),
      woba: Number(r.woba), xwoba: Number(r.est_woba),
    }));
  });
}

/** Batted-ball quality allowed by pitchers — gives us ground balls and fly/line balls. */
export async function statcastPitching(season) {
  return cached(`savant:statcastP:${season}`, async () => {
    const rows = await getCsv(`${SAVANT}/statcast?type=pitcher&year=${season}&position=&team=&min=q&csv=true`);
    return rows.map((r) => ({
      id: Number(r.player_id),
      name: flipName(r['last_name, first_name']),
      batted: Number(r.attempts),
      GB: Number(r.gb),
      FBLD: Number(r.fbld),
      avgEV: Number(r.avg_hit_speed),
      hardHitPct: Number(r.ev95percent) * 100,
      barrelPctBBE: Number(r.brl_percent),
      sweetSpotPct: Number(r.anglesweetspotpercent),
    }));
  });
}

/** Maximum throw velocity, for outfielders and infielders. */
export async function armStrength(season, minThrows = 50) {
  return cached(`savant:arm:${season}:${minThrows}`, async () => {
    const rows = await getCsv(`${SAVANT}/arm-strength?type=outfielder&year=${season}&minThrows=${minThrows}&csv=true`);
    return rows.map((r) => ({
      id: Number(r.player_id),
      name: flipName(r.fielder_name),
      team: r.team_name,
      position: r.primary_position_name,
      throws: Number(r.total_throws),
      maxArm: Number(r.max_arm_strength),
    }));
  });
}

/** Catcher pop time, exchange, and the caught-stealing counts behind them. */
export async function popTime(season, min2b = 5) {
  return cached(`savant:pop:${season}:${min2b}`, async () => {
    const rows = await getCsv(`${SAVANT}/poptime?year=${season}&team=&min2b=${min2b}&min3b=0&csv=true`);
    return rows.map((r) => ({
      id: Number(r.entity_id),
      name: flipName(r.entity_name),
      popTime: Number(r.pop_2b_sba),
      armVelo: Number(r.maxeff_arm_2b_3b_sba),
      exchange: Number(r.exchange_2b_3b_sba),
      attempts: Number(r.pop_2b_sba_count),
      CS: Number(r.pop_2b_cs),
      SB: Number(r.pop_2b_sb),
    }));
  });
}

/** Bat tracking (2024+): swing speed, length, squared-up and blast rates. */
export async function batTracking(season, type = 'batter', minSwings = 100) {
  return cached(`savant:bat:${season}:${type}:${minSwings}`, async () => {
    const rows = await getCsv(`${SAVANT}/bat-tracking?type=${type}&year=${season}&minSwings=${minSwings}&csv=true`);
    return rows.map((r) => ({
      id: Number(r.id),
      name: flipName(r.name),
      swings: Number(r.swings_competitive),
      batSpeed: Number(r.avg_bat_speed),
      swingLength: Number(r.swing_length),
      squaredUpPerSwing: Number(r.squared_up_per_swing) * 100,
      blastPerSwing: Number(r.blast_per_swing) * 100,
      hardSwingRate: Number(r.hard_swing_rate) * 100,
      whiffPerSwing: Number(r.whiff_per_swing) * 100,
    }));
  });
}

/** Active spin — the share of a pitch's spin that actually moves it. */
export async function activeSpin(season, min = 100) {
  return cached(`savant:spin:${season}:${min}`, async () => {
    const rows = await getCsv(`${SAVANT}/active-spin?year=${season}&min=${min}&hand=&csv=true`);
    return rows.map((r) => ({
      id: Number(r.entity_id),
      name: flipName(r.entity_name),
      hand: r.pitch_hand,
      fourseam: Number(r.active_spin_fourseam),
      sinker: Number(r.active_spin_sinker),
      curve: Number(r.active_spin_curve),
      slider: Number(r.active_spin_slider),
    }));
  });
}

/**
 * All 30 clubs as single rows, with runs scored and runs allowed merged.
 * This is the population for team-level stats — Pythagorean, run differential,
 * BaseRuns, defensive efficiency.
 */
export async function teamRows(season) {
  return cached(`teams:${season}`, async () => {
    const [hit, pit] = await Promise.all([
      getJson(`${MLB}/teams/stats?season=${season}&group=hitting&stats=season&sportId=1`),
      getJson(`${MLB}/teams/stats?season=${season}&group=pitching&stats=season&sportId=1`),
    ]);
    const pitchBy = new Map(
      (pit.stats?.[0]?.splits ?? []).map((s) => [s.team.id, normalise(s.stat, 'pitching')])
    );

    return (hit.stats?.[0]?.splits ?? []).map((s) => {
      const h = normalise(s.stat, 'hitting');
      const p = pitchBy.get(s.team.id) ?? {};
      return {
        id: s.team.id,
        name: s.team.name,
        team: s.team.name,
        G: h.G,
        RS: h.R, RA: p.R,
        // Everything below is what the club ALLOWED — the inputs to DER.
        paAgainst: (p.AB ?? 0) + (p.BB ?? 0) + (p.HBP ?? 0) + (p.SF ?? 0) + (p.SH ?? 0),
        hAgainst: p.H, hrAgainst: p.HR, kAgainst: p.K, bbAgainst: p.BB, hbpAgainst: p.HBP,
        ER: p.ER, IP: p.IP, outs: p.outs,
        // And what it produced at the plate.
        AB: h.AB, H: h.H, doubles: h.doubles, triples: h.triples, HR: h.HR,
        BB: h.BB, IBB: h.IBB, HBP: h.HBP, SF: h.SF, K: h.K, PA: h.PA, SB: h.SB, CS: h.CS,
      };
    });
  });
}

/** Savant writes names "Judge, Aaron". Humans read "Aaron Judge". */
function flipName(s) {
  if (!s) return '';
  const [last, first] = s.split(',').map((x) => x.trim());
  return first ? `${first} ${last}` : last;
}

/** Merge Savant tracking data onto an MLB stat line, matched by player id. */
export function joinById(base, extra, prefix = '') {
  const index = new Map(extra.map((e) => [e.id, e]));
  return base.map((b) => {
    const match = index.get(b.id);
    if (!match) return b;
    const tagged = prefix
      ? Object.fromEntries(Object.entries(match).map(([k, v]) => [prefix + k, v]))
      : match;
    return { ...b, ...tagged, id: b.id, name: b.name };
  });
}
