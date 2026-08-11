/*
 * content/index.js — assembles the curriculum into one ordered course.
 *
 * The order matters. Each module assumes the previous one, building from
 * "count the things" to "convert everything into wins".
 */

import { COUNTING, RATE } from './hitting.js';
import { RUNS, CONTEXT } from './runs.js';
import { PITCHING, DIPS } from './pitching.js';
import { FIELDING, BASERUNNING } from './defense.js';
import { STATCAST } from './statcast.js';
import { WAR, WINPROB, TEAM } from './value.js';

export const MODULES = [
  COUNTING,     // 1. the box score
  RATE,         // 2. per-opportunity
  RUNS,         // 3. linear weights, wOBA
  CONTEXT,      // 4. park and league adjustment
  PITCHING,     // 5. traditional pitching
  DIPS,         // 6. FIP and friends
  FIELDING,     // 7. defence
  BASERUNNING,  // 8. baserunning
  STATCAST,     // 9. tracking data
  WAR,          // 10. wins above replacement
  WINPROB,      // 11. leverage and win probability
  TEAM,         // 12. team level and forecasting
];

/** Flat list of every stat, with its module attached — powers search and the glossary. */
export const ALL_STATS = MODULES.flatMap((m, moduleIndex) =>
  m.stats.map((s, statIndex) => ({
    ...s,
    moduleId: m.id,
    moduleTitle: m.title,
    moduleIndex,
    statIndex,
    path: `${m.id}/${s.id}`,
  }))
);

export const STAT_BY_PATH = new Map(ALL_STATS.map((s) => [s.path, s]));

/** Previous/next, so the course reads as a continuous sequence across modules. */
export function neighbours(path) {
  const i = ALL_STATS.findIndex((s) => s.path === path);
  if (i === -1) return { prev: null, next: null };
  return { prev: ALL_STATS[i - 1] ?? null, next: ALL_STATS[i + 1] ?? null };
}

/** Simple relevance search over name, abbreviation and summary. */
export function search(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return ALL_STATS
    .map((s) => {
      const abbr = s.abbr.toLowerCase();
      const name = s.name.toLowerCase();
      let score = 0;
      if (abbr === q) score = 100;
      else if (abbr.split(/[\s/]+/).includes(q)) score = 95;
      else if (name === q) score = 90;
      else if (abbr.includes(q)) score = 70;
      else if (name.startsWith(q)) score = 60;
      else if (name.includes(q)) score = 40;
      else if ((s.short ?? '').toLowerCase().includes(q)) score = 20;
      return { stat: s, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.stat.name.localeCompare(b.stat.name))
    .slice(0, 25)
    .map((r) => r.stat);
}

export const COURSE_STATS = {
  modules: MODULES.length,
  stats: ALL_STATS.length,
  calculators: ALL_STATS.filter((s) => s.inputs && s.compute).length,
  distributions: ALL_STATS.filter((s) => s.dist).length,
};
