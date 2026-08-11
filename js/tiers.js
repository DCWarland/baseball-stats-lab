/*
 * tiers.js — turning a number into a verdict.
 *
 * "Is .340 good?" has no answer without context. This file supplies the
 * context by ranking every qualifying player and cutting the population into
 * named bands by percentile.
 *
 * WHY PERCENTILES RATHER THAN FIXED THRESHOLDS
 * A .300 batting average meant something different in 1930, 1968 and today.
 * Fixed cutoffs go stale; percentiles never do, because they are recomputed
 * from this season's actual players every time you load the page. "Elite"
 * always means the top 5% of the league right now.
 *
 * The same six bands are used for all 86 statistics, so once you learn the
 * colours you can read any page on the site at a glance.
 */

/** Ordered best-first. `min` is the percentile floor for that band. */
export const TIERS = [
  { key: 'elite',   label: 'Elite',         min: 95, blurb: 'top 5% of the league' },
  { key: 'great',   label: 'Great',         min: 85, blurb: 'top 15%' },
  { key: 'above',   label: 'Above average', min: 60, blurb: 'better than most regulars' },
  { key: 'average', label: 'Average',       min: 40, blurb: 'the middle fifth' },
  { key: 'below',   label: 'Below average', min: 15, blurb: 'bottom 40%' },
  { key: 'poor',    label: 'Poor',          min: 0,  blurb: 'bottom 15%' },
];

/** Which band does this percentile fall in? */
export function tierFor(pct) {
  if (pct == null || !isFinite(pct)) return null;
  return TIERS.find((t) => pct >= t.min) ?? TIERS[TIERS.length - 1];
}

function quantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * Math.max(0, Math.min(1, q));
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
}

/**
 * The tier boundaries expressed in the statistic's own units, so they can be
 * drawn as shaded regions behind the histogram.
 *
 * Returns bands sorted left-to-right in value space. For a stat where lower is
 * better (ERA, K%), "Elite" ends up on the left — which is correct, and the
 * colour tells you it is still the good end.
 */
export function tierBands(sortedValues, lowerIsBetter = false) {
  if (!sortedValues.length) return [];

  const valueAtPercentile = (pct) =>
    quantile(sortedValues, lowerIsBetter ? 1 - pct / 100 : pct / 100);

  // Build [floorPercentile, ceilingPercentile] for each band, then convert.
  const bands = TIERS.map((t, i) => {
    const hiPct = i === 0 ? 100 : TIERS[i - 1].min;
    const a = valueAtPercentile(t.min);
    const b = valueAtPercentile(hiPct);
    return { ...t, from: Math.min(a, b), to: Math.max(a, b) };
  });

  return bands.sort((x, y) => x.from - y.from);
}

/**
 * A compact legend describing every band in this stat's own units — the
 * "so what counts as elite?" answer, in a single row.
 */
export function tierLegend(sortedValues, lowerIsBetter, fmt, format) {
  return tierBands(sortedValues, lowerIsBetter)
    .slice()
    .sort((a, b) => b.min - a.min)          // best first, for reading
    .map((b) => ({
      key: b.key,
      label: b.label,
      blurb: b.blurb,
      range: lowerIsBetter
        ? `${fmt(b.from, format)} – ${fmt(b.to, format)}`
        : `${fmt(b.from, format)} – ${fmt(b.to, format)}`,
      edge: lowerIsBetter ? fmt(b.to, format) : fmt(b.from, format),
    }));
}
