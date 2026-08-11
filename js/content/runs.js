/*
 * runs.js — Modules 3 and 4.
 *
 * Module 3 answers: how many RUNS is each event actually worth?
 * Module 4 answers: how do we compare players across parks and eras?
 *
 * This is the conceptual centre of the whole site. Everything before it is
 * arithmetic; everything after it is an application of these two ideas.
 */

import * as F from '../formulas.js';
import { RUN_EXPECTANCY, BASE_STATE_LABELS, PARK_FACTORS, STABILISATION } from '../constants.js';

/* Some populations are not made of players. The run expectancy matrix, the
 * linear weights, the 30 park factors and the stabilisation points are each a
 * fixed set of values with a real, meaningful spread — so they get a curve too. */
const RE_VALUES = Object.entries(RUN_EXPECTANCY).flatMap(([state, outs]) =>
  outs.map((v, i) => ({ name: `${BASE_STATE_LABELS[state]}, ${i} out`, value: v })));

const LW_VALUES = [
  { name: 'Home run', value: 1.40 }, { name: 'Triple', value: 1.03 },
  { name: 'Double', value: 0.75 }, { name: 'Single', value: 0.47 },
  { name: 'Hit by pitch', value: 0.36 }, { name: 'Unintentional walk', value: 0.33 },
  { name: 'Out in play', value: -0.26 }, { name: 'Strikeout', value: -0.28 },
];

const PF_VALUES = Object.entries(PARK_FACTORS)
  .map(([team, p]) => ({ name: p.name, team, value: p.pf }));

const STAB_VALUES = STABILISATION.map((s) => ({ name: s.stat, team: s.unit, value: s.n }));

const BONDS_2001 = [
  { key: 'BB', label: 'Walks', def: 177 },
  { key: 'IBB', label: 'Intentional walks', def: 35 },
  { key: 'HBP', label: 'Hit by pitch', def: 9 },
  { key: 'H', label: 'Hits', def: 156 },
  { key: 'doubles', label: 'Doubles', def: 32 },
  { key: 'triples', label: 'Triples', def: 2 },
  { key: 'HR', label: 'Home runs', def: 73 },
  { key: 'AB', label: 'At-bats', def: 476 },
  { key: 'SF', label: 'Sacrifice flies', def: 2 },
];

export const RUNS = {
  id: 'runs',
  title: 'Linear Weights & Run Estimation',
  blurb: 'The central insight: measure every event by how many runs it actually produces.',
  intro: `
    <p>Everything up to now has used made-up weights. Batting average says every
    hit is worth 1. Slugging says a home run is worth 4 singles. Neither claim
    was ever tested against reality.</p>
    <p>The breakthrough — traceable to George Lindsey in the 1960s and Pete
    Palmer in the 1980s — was to stop guessing and <strong>measure</strong>.
    Take every plate appearance in a season, look at the base/out situation
    before and after, and record how much the expected run total changed. Average
    those across thousands of events and you get the true run value of a single,
    a double, a walk, an out.</p>
    <p>Those averages are called <strong>linear weights</strong>, and they are
    the foundation of every modern stat on this site.</p>`,
  stats: [
    {
      id: 're',
      dist: {
        values: RE_VALUES, format: 'rate3z', label: 'Expected runs',
        note: 'All 24 base/out states, ranked. This is the population every linear weight — and therefore wOBA, wRC+ and WAR — is ultimately derived from.',
      },
      abbr: 'RE',
      name: 'Run Expectancy (the 24 base/out states)',
      short: 'The table every advanced stat is secretly built on.',
      formula: 'RE = average runs scored from here to the end of the inning',
      body: `
        <p>There are 8 possible base configurations × 3 out counts =
        <strong>24 states</strong> an inning can be in. For each, we can measure
        the average number of runs a team goes on to score.</p>
        <p>Read the table below and the logic of baseball becomes visible. Bases
        empty with nobody out is worth about 0.48 runs. Bases loaded with nobody
        out is worth 2.29. The difference between those numbers <em>is</em> the
        value of getting men on base.</p>
        <p>Now you can price any event. A leadoff walk moves you from 0.481 to
        0.859 — worth <strong>+0.38 runs</strong>. That is where the wOBA walk
        weight of ~0.69 ultimately comes from, once you also account for the
        out the batter avoided making.</p>`,
      widget: 'runExpectancyTable',
    },
    {
      id: 'linearweights',
      dist: {
        values: LW_VALUES, format: 'two', label: 'Run value',
        note: 'The measured run value of each event. The gap between a home run and a single is about 3×, not the 4× slugging percentage assumes.',
      },
      abbr: 'LW',
      name: 'Linear Weights',
      short: 'The measured run value of every baseball event.',
      formula: 'Run value = (RE after) − (RE before) + runs scored on the play',
      body: `
        <p>Apply that formula to every plate appearance in a season and average
        by event type. You get numbers close to these:</p>
        <table class="data-table">
          <thead><tr><th>Event</th><th>Run value</th></tr></thead>
          <tbody>
            <tr><td>Home run</td><td>+1.40</td></tr>
            <tr><td>Triple</td><td>+1.03</td></tr>
            <tr><td>Double</td><td>+0.75</td></tr>
            <tr><td>Single</td><td>+0.47</td></tr>
            <tr><td>Hit by pitch</td><td>+0.36</td></tr>
            <tr><td>Walk</td><td>+0.33</td></tr>
            <tr><td>Out (in play)</td><td>−0.26</td></tr>
            <tr><td>Strikeout</td><td>−0.28</td></tr>
          </tbody>
        </table>
        <p>These are <strong>runs above average</strong>. To build wOBA we shift
        everything up so an out is worth zero, then rescale — which produces the
        familiar 0.69-for-a-walk, 2.04-for-a-home-run figures.</p>
        <p>Two things jump out. A home run is worth about <strong>3× a single,
        not 4×</strong>. And a walk is worth about <strong>70% of a single</strong> —
        far from the zero that batting average implicitly assigns it.</p>`,
      widget: 'linearWeightsExplorer',
    },
    {
      id: 'woba',
      dist: { group: 'hitting' },
      abbr: 'wOBA',
      name: 'Weighted On-Base Average',
      short: 'The best context-neutral rate stat. OBP, but with each event correctly priced.',
      formula: 'wOBA = (0.69×uBB + 0.72×HBP + 0.88×1B + 1.25×2B + 1.59×3B + 2.04×HR) ÷ (AB + uBB + SF + HBP)',
      body: `
        <p>wOBA is what you get when you take OBP's structure — reaching base per
        opportunity — and replace its "everything counts as 1" weighting with the
        measured linear weights.</p>
        <p>It is deliberately scaled so that <strong>league average wOBA equals
        league average OBP</strong>, around .320. That's a piece of design
        empathy: you already know .400 is a great OBP, so you instantly know
        .400 is a great wOBA.</p>
        <p>The weights change every season, because run environments change. Our
        calculator pulls the right season's weights automatically.</p>
        <p><strong>Intentional walks are removed</strong> — being walked on
        purpose measures the pitcher's fear, not your batting skill.</p>`,
      gotcha: `wOBA is context-NEUTRAL by design. It gives identical credit for a
        grand slam and a solo shot. That is a feature: it measures the hitter's
        contribution, not his teammates' ability to get on base ahead of him.`,
      inputs: BONDS_2001,
      compute: (v, ctx) => F.woba(v, ctx?.season ?? 2026),
      format: 'rate3',
      scale: 'woba',
      benchmarks: [[0.400, 'Elite'], [0.370, 'Great'], [0.320, 'Average'], [0.290, 'Poor']],
    },
    {
      id: 'wraa',
      dist: { group: 'hitting' },
      abbr: 'wRAA',
      name: 'Weighted Runs Above Average',
      short: 'Converts the wOBA rate into total runs contributed.',
      formula: 'wRAA = ((wOBA − league wOBA) ÷ wOBA scale) × PA',
      body: `
        <p>wOBA tells you the <em>rate</em>. wRAA converts it to a
        <em>quantity</em>: how many runs above an average hitter did this player
        produce in total?</p>
        <p>Dividing by the wOBA scale undoes the cosmetic stretching, returning
        the value to real runs. Multiplying by PA turns a rate back into a total,
        so playing time counts again.</p>
        <p>This is the first stat on the site denominated in <strong>runs</strong>,
        which is the currency WAR will eventually be built from.</p>`,
      inputs: [...BONDS_2001, { key: 'PA', label: 'Plate appearances', def: 664 }],
      compute: (v, ctx) => F.wraa(v, ctx?.season ?? 2026, ctx?.lgwOBA),
      format: 'runs',
      resultLabel: 'Runs above average',
      benchmarks: [[60, 'MVP level'], [30, 'All-Star'], [0, 'Exactly average'], [-15, 'Poor']],
    },
    {
      id: 'wrc',
      dist: { group: 'hitting' },
      abbr: 'wRC',
      name: 'Weighted Runs Created',
      short: 'Total runs created, not runs above average.',
      formula: 'wRC = wRAA + (league runs per PA × PA)',
      body: `
        <p>wRAA is measured <em>relative to average</em>, so an average hitter
        scores 0. wRC adds the league baseline back in, giving total runs
        created — a number that is always positive and easier to explain.</p>
        <p>Bill James invented the original Runs Created in the 1970s using a
        much simpler formula; wRC is its modern, linear-weights descendant.</p>`,
      inputs: [...BONDS_2001, { key: 'PA', label: 'Plate appearances', def: 664 }],
      compute: (v, ctx) => F.wrc(v, ctx?.season ?? 2026, ctx?.lgwOBA, ctx?.lgRperPA ?? 0.12),
      format: 'one',
      resultLabel: 'Runs created',
    },
    {
      id: 'rc',
      dist: { group: 'hitting' },
      abbr: 'RC',
      name: 'Runs Created (Bill James, original)',
      short: 'The 1970s ancestor of every run estimator here.',
      formula: 'RC = ((H + BB) × TB) ÷ (AB + BB)',
      body: `
        <p>James' insight, decades before anyone had play-by-play databases:
        scoring runs requires getting on base <em>and</em> advancing runners, so
        multiply an on-base component by an advancement component.</p>
        <p>It is crude — it double-counts, and it breaks badly for extreme
        players — but it lands within a few percent of team totals, which was
        astonishing for a formula built by hand.</p>`,
      inputs: [
        { key: 'H', label: 'Hits', def: 156 },
        { key: 'BB', label: 'Walks', def: 177 },
        { key: 'AB', label: 'At-bats', def: 476 },
        { key: 'doubles', label: 'Doubles', def: 32 },
        { key: 'triples', label: 'Triples', def: 2 },
        { key: 'HR', label: 'Home runs', def: 73 },
      ],
      compute: F.runsCreatedBasic,
      format: 'one',
      resultLabel: 'Runs created (basic)',
    },
    {
      id: 're24',
      dist: {
        values: RE_VALUES, format: 'rate3z', label: 'Starting run expectancy',
        note: 'RE24 is a per-play measure with no season-long feed, so this is the underlying table it prices every play against: the 24 states, from bases empty with two out to bases loaded with none.',
      },
      abbr: 'RE24',
      name: 'Run Expectancy 24 (base/out)',
      short: 'Full credit for what actually happened, context included.',
      formula: 'RE24 = RE(after) − RE(before) + runs scored',
      body: `
        <p>RE24 is wOBA's opposite. Where wOBA deliberately strips context, RE24
        embraces it entirely: a grand slam earns four times the credit of a solo
        home run, because it produced four times the runs.</p>
        <p>Neither is "right". Use wOBA to judge the <strong>hitter</strong>; use
        RE24 to describe what <strong>happened</strong>. The gap between a
        player's RE24 and his context-neutral value is usually called luck or
        opportunity — and it does not repeat year to year.</p>`,
      widget: 're24Calculator',
    },
    {
      id: 'baseruns',
      dist: {
        group: 'team', format: 'int', label: 'BaseRuns',
        valueFn: (r) => F.baseRuns(r),
        note: 'BaseRuns for all 30 clubs, computed from their real offensive lines. Compare a club\'s BaseRuns to its actual runs scored — the gap is sequencing luck.',
      },
      abbr: 'BsR',
      name: 'BaseRuns',
      short: 'The most accurate run estimator, especially at extremes.',
      formula: 'BaseRuns = (A × B) ÷ (B + C) + D',
      body: `
        <p>Where linear weights assume every event has a fixed value, BaseRuns
        models the actual <em>structure</em> of an inning:</p>
        <ul>
          <li><strong>A</strong> — baserunners created</li>
          <li><strong>B</strong> — advancement of those runners</li>
          <li><strong>C</strong> — outs consumed</li>
          <li><strong>D</strong> — home runs (which score regardless)</li>
        </ul>
        <p>The B ÷ (B + C) term is a <em>score rate</em>: what fraction of
        runners make it home. That makes BaseRuns behave sensibly in absurd
        cases where linear methods break — a team of nine players who homer every
        time correctly gets infinite runs, not a linear extrapolation.</p>
        <p>It is the estimator of choice for team-level and "third-order wins"
        analysis.</p>`,
    },
  ],
};

export const CONTEXT = {
  id: 'context',
  title: 'Context & Adjustment',
  blurb: 'A .300 hitter in Coors Field is not a .300 hitter in Petco Park. Here is how we fix that.',
  intro: `
    <p>Raw stats are contaminated by things the player did not control: the park
    he plays in, the league's run environment, the era he was born into.</p>
    <p>Adjusted stats strip that out. They almost all follow one convention that,
    once learned, unlocks dozens of stats at once:</p>
    <p class="callout"><strong>100 = exactly league average. Each point = 1%.</strong>
    Stats ending in <strong>+</strong> (wRC+, OPS+) are better when
    <em>higher</em>. Stats ending in <strong>−</strong> (ERA−, FIP−) are better
    when <em>lower</em>, because they measure runs allowed.</p>`,
  stats: [
    {
      id: 'parkfactor',
      dist: {
        values: PF_VALUES, format: 'int', label: 'Park factor',
        note: 'All 30 ballparks. 100 is neutral; the spread from Coors Field to T-Mobile Park is nearly 20 points, which is why unadjusted stats mislead.',
      },
      abbr: 'PF',
      name: 'Park Factor',
      short: 'How much a ballpark inflates or suppresses scoring.',
      formula: 'PF ≈ (runs scored at home ÷ runs scored on road), regressed and normalised to 100',
      body: `
        <p>Baseball is the only major sport whose playing field is not
        standardised. Coors Field sits at 5,200 feet where the thin air carries
        the ball; Oracle Park has a cavernous right-centre gap and heavy sea air.
        The gap between them is worth roughly 15% of offence.</p>
        <p>Real park factors are computed over multiple years and regressed
        toward 100, because a single season of home/road splits is far too noisy.
        Sophisticated versions differ by handedness and by event type — Fenway's
        Green Monster boosts doubles while suppressing home runs.</p>`,
      widget: 'parkFactorTable',
    },
    {
      id: 'wrcplus',
      dist: { group: 'hitting' },
      abbr: 'wRC+',
      name: 'Weighted Runs Created Plus',
      short: 'The best single offensive number in baseball. 100 = average.',
      formula: 'wRC+ = [(wRAA/PA + lgR/PA) ÷ (lgR/PA × park factor)] × 100',
      body: `
        <p>wRC+ takes wRC, adjusts for the park and the league, and scales so
        that 100 is exactly average. A wRC+ of 140 means "created 40% more runs
        than a league-average hitter, after accounting for his ballpark".</p>
        <p>This is the stat to reach for when comparing hitters across teams and
        across eras. Babe Ruth's 1920 wRC+ of 239 and Barry Bonds' 2002 mark of
        244 are directly comparable, despite eighty years and a transformed
        sport between them.</p>`,
      gotcha: `wRC+ measures OFFENCE ONLY. A 130 wRC+ shortstop who fields
        brilliantly is far more valuable than a 130 wRC+ designated hitter, and
        wRC+ cannot see that difference. That is what WAR is for.`,
      inputs: [
        ...BONDS_2001,
        { key: 'PA', label: 'Plate appearances', def: 664 },
        { key: 'parkFactor', label: 'Park factor (100 = neutral)', def: 100 },
      ],
      compute: (v, ctx) => F.wrcPlus(v, ctx?.season ?? 2026, ctx?.lgwOBA, v.parkFactor ?? 100, ctx?.lgRperPA ?? 0.12),
      format: 'plus',
      scale: 'plus',
      benchmarks: [[160, 'MVP level'], [130, 'All-Star'], [100, 'League average'], [80, 'Replacement-ish']],
    },
    {
      id: 'opsplus',
      dist: { group: 'hitting' },
      abbr: 'OPS+',
      name: 'OPS Plus',
      short: 'Park- and league-adjusted OPS. The Baseball-Reference staple.',
      formula: 'OPS+ = 100 × (OBP ÷ lgOBP + SLG ÷ lgSLG − 1), park-adjusted',
      body: `
        <p>OPS+ does for OPS what wRC+ does for wRC. It is slightly less accurate
        — it inherits OPS's equal weighting of on-base and slugging — but it is
        the historical standard on Baseball-Reference and appears in almost every
        Hall of Fame argument ever made.</p>
        <p>Note it is <em>not</em> simply "OPS compared to league OPS": it
        compares each component separately, which handles unusual players better.</p>`,
      inputs: [
        { key: 'H', label: 'Hits', def: 156 },
        { key: 'BB', label: 'Walks', def: 177 },
        { key: 'HBP', label: 'Hit by pitch', def: 9 },
        { key: 'AB', label: 'At-bats', def: 476 },
        { key: 'SF', label: 'Sacrifice flies', def: 2 },
        { key: 'doubles', label: 'Doubles', def: 32 },
        { key: 'triples', label: 'Triples', def: 2 },
        { key: 'HR', label: 'Home runs', def: 73 },
        { key: 'parkFactor', label: 'Park factor', def: 100 },
      ],
      compute: (v, ctx) => F.opsPlus(v, ctx?.lgOBP ?? 0.318, ctx?.lgSLG ?? 0.408, v.parkFactor ?? 100),
      format: 'plus',
      scale: 'plus',
      benchmarks: [[160, 'MVP level'], [130, 'All-Star'], [100, 'Average'], [80, 'Poor']],
    },
    {
      id: 'minusstats',
      dist: {
        group: 'pitching', format: 'plus', label: 'ERA−', lowerIsBetter: true,
        min: { field: 'outs', value: 90 },
        valueFn: (r, c) => F.eraMinus(F.era(r), c.lgERA ?? 4.15, 100),
        note: 'Every pitcher\'s ERA re-expressed against this season\'s live league ERA. 100 is exactly average and lower is better, so the good pitchers are on the left.',
      },
      abbr: 'ERA− / FIP− / xFIP−',
      name: 'The Minus Stats',
      short: 'Pitching, adjusted for park and league. Lower is better.',
      formula: 'ERA− = (ERA ÷ league ERA, park-adjusted) × 100',
      body: `
        <p>Same idea as the plus stats, flipped. Because pitchers want to
        <em>allow</em> fewer runs, a lower number is better: ERA− of 75 means
        "allowed 25% fewer runs than a league-average pitcher in a neutral park".</p>
        <p>These matter more than people expect. A 3.60 ERA in 2000 (when the
        league ERA was 4.77) was excellent; the same 3.60 in 2014 (league 3.74)
        was merely fine. The raw number hides a huge difference; ERA− does not.</p>`,
      inputs: [
        { key: 'playerEra', label: 'Player ERA', def: 3.6 },
        { key: 'lgEra', label: 'League ERA', def: 4.15 },
        { key: 'parkFactor', label: 'Park factor', def: 100 },
      ],
      compute: ({ playerEra, lgEra, parkFactor }) => F.eraMinus(playerEra, lgEra, parkFactor),
      format: 'plus',
      scale: 'minus',
      lowerIsBetter: true,
      benchmarks: [[70, 'Elite'], [90, 'Above average'], [100, 'Average'], [115, 'Poor']],
    },
    {
      id: 'stabilise',
      dist: {
        values: STAB_VALUES, format: 'int', label: 'Sample needed',
        note: 'How much data each statistic needs before it means anything. The spread is enormous — strikeout rate settles in 60 plate appearances, batting average needs more than a full season.',
      },
      abbr: 'n',
      name: 'Sample Size & Stabilisation',
      short: 'When does a stat start telling you about the player rather than the noise?',
      formula: 'The point where observed variance is half true talent, half luck',
      body: `
        <p>Every stat needs a different amount of data before it means anything.
        Strikeout rate settles down after about 60 plate appearances. Batting
        average needs roughly 910 at-bats — <em>more than a full season</em>.</p>
        <p>This single table is the best defence against most bad baseball
        arguments. When someone cites a hitter's .390 average through 80 PA, the
        answer is not "that's a small sample" as a vague hedge — it is that this
        specific stat provably needs eleven times more data.</p>`,
      widget: 'stabilisationTable',
    },
  ],
};
