/*
 * defense.js — Modules 7 and 8: fielding and baserunning.
 *
 * Fielding is the hardest thing in baseball to measure, because the traditional
 * stats count only what a fielder DID, never what he had the CHANCE to do.
 */

import * as F from '../formulas.js';

export const FIELDING = {
  id: 'fielding',
  title: 'Fielding',
  blurb: 'The hardest thing in baseball to measure, and the stats that finally cracked it.',
  intro: `
    <p>Here is the problem in one sentence: <strong>a fielder who never reaches
    a ball is never charged with anything.</strong></p>
    <p>Fielding percentage only counts balls you touched. A statue at shortstop
    with terrible range makes very few errors, because balls he can't reach go
    into the book as base hits charged to nobody. Meanwhile a rangy shortstop who
    gets to fifty extra balls has fifty extra chances to make a mistake — and a
    worse fielding percentage for his trouble.</p>
    <p>Every modern fielding metric exists to answer the question the old ones
    couldn't: <em>how many balls did he have a realistic chance at, and how many
    did he convert?</em></p>`,
  stats: [
    {
      id: 'fpct',
      dist: { group: 'fielding' },
      abbr: 'FPCT',
      name: 'Fielding Percentage',
      short: 'Share of chances handled without an error. Nearly useless on its own.',
      formula: 'FPCT = (PO + A) ÷ (PO + A + E)',
      body: `
        <p>Modern infielders post fielding percentages around .970–.985, and the
        spread between the best and worst is tiny — which should be your first
        clue that it isn't measuring much.</p>
        <p>Its two fatal flaws: it ignores range entirely, and "error" is an
        official scorer's opinion about whether a play <em>should</em> have been
        made. It rewards not trying.</p>`,
      inputs: [
        { key: 'PO', label: 'Putouts', def: 180 },
        { key: 'A', label: 'Assists', def: 420 },
        { key: 'E', label: 'Errors', def: 12 },
      ],
      compute: F.fieldingPct,
      format: 'rate3',
      benchmarks: [[0.990, 'Excellent'], [0.975, 'Above average'], [0.965, 'Average'], [0.950, 'Poor']],
    },
    {
      id: 'errors',
      dist: { group: 'fielding', field: 'E', format: 'int', lowerIsBetter: true },
      abbr: 'E / PO / A / TC',
      name: 'Errors, Putouts, Assists, Chances',
      short: 'The raw fielding counting stats.',
      formula: 'TC = PO + A + E',
      body: `
        <ul>
          <li><strong>Putout (PO)</strong> — you personally recorded the out:
          caught the fly, stepped on the bag, applied the tag.</li>
          <li><strong>Assist (A)</strong> — you touched the ball on the way to
          somebody else's putout.</li>
          <li><strong>Error (E)</strong> — the scorer judged that ordinary effort
          should have produced an out.</li>
          <li><strong>Total Chances (TC)</strong> — the three added together.</li>
        </ul>
        <p>Note how positional this is. First basemen accumulate enormous putout
        totals simply by standing on the bag receiving throws — it says nothing
        about their skill.</p>`,
    },
    {
      id: 'rf',
      dist: { group: 'fielding' },
      abbr: 'RF',
      name: 'Range Factor',
      short: 'Bill James\' fix: count plays made per game, not per chance.',
      formula: 'RF/9 = ((PO + A) ÷ innings) × 9',
      body: `
        <p>James' reasoning was blunt: a fielder's job is to make plays, so count
        the plays. This at least rewards range, which fielding percentage does
        not.</p>
        <p>It's still crude — it takes no account of how many balls were actually
        hit your way, which depends on your pitching staff's ground-ball tendency
        and the handedness of opposing hitters. But it was a genuine step forward
        in 1977, and it pointed at the right question.</p>`,
      inputs: [
        { key: 'PO', label: 'Putouts', def: 180 },
        { key: 'A', label: 'Assists', def: 420 },
        { key: 'INN', label: 'Innings in the field', def: 1300 },
      ],
      compute: F.rangeFactor9,
      format: 'two',
      resultLabel: 'Range factor per 9 innings',
    },
    {
      id: 'drs',
      dist: {
        source: 'oaa', field: 'runsPrevented', format: 'int', label: 'Fielding Run Value',
        note: 'DRS is proprietary to Baseball Info Solutions and has no public feed. This is Statcast\'s Fielding Run Value — the same idea, measured from tracking data instead of human charting.',
      },
      abbr: 'DRS',
      name: 'Defensive Runs Saved',
      short: 'Runs saved versus an average fielder. The Baseball Info Solutions standard.',
      formula: 'Sum of several run-value components, expressed as runs above average',
      body: `
        <p>DRS divides the field into small zones and, using human-charted data
        on every batted ball, asks: how often did an average fielder convert a
        ball hit to this zone at this speed? Credit the difference, convert to
        runs.</p>
        <p>It bundles several components — range, arm strength, double play
        turns, bunt handling, and for catchers, pitch framing and blocking.</p>
        <p><strong>0 is average.</strong> +15 is excellent, −15 is dreadful.
        DRS is the fielding input to Baseball-Reference's WAR.</p>`,
      benchmarks: [[15, 'Gold Glove level'], [5, 'Above average'], [0, 'Average'], [-10, 'Poor']],
    },
    {
      id: 'uzr',
      dist: {
        source: 'oaa', field: 'oaa', format: 'int', label: 'Outs Above Average',
        note: 'UZR is published only by FanGraphs. This is the Statcast range metric, which measures the same skill and is openly available.',
      },
      abbr: 'UZR',
      name: 'Ultimate Zone Rating',
      short: 'FanGraphs\' zone-based fielding metric, in runs above average.',
      formula: 'Range runs + error runs + arm runs + double-play runs',
      body: `
        <p>Similar in spirit to DRS but with different data and different
        adjustments. It corrects for park, batted ball speed, and the base/out
        situation.</p>
        <p><strong>UZR/150</strong> scales the result to a full 150-game season,
        which makes part-time players comparable to regulars.</p>
        <p>Important caution: zone-based fielding metrics are <em>noisy</em>.
        One season of UZR is roughly as reliable as a couple of months of
        batting average. Always look at three years before drawing conclusions.</p>`,
      gotcha: `Never use a single season of UZR or DRS to settle an argument.
        These metrics need about three years of data to stabilise — far longer
        than any offensive stat.`,
    },
    {
      id: 'oaa',
      dist: { source: 'oaa', field: 'oaa' },
      abbr: 'OAA',
      name: 'Outs Above Average',
      short: 'The Statcast metric — measures range directly from tracking data.',
      formula: 'Sum over all plays of (1 − catch probability) for outs made, minus catch probability for misses',
      body: `
        <p>This is the current state of the art, and conceptually the cleanest
        idea in fielding analysis.</p>
        <p>Statcast tracks how far the fielder had to travel, how much time he
        had, and (for outfielders) how far he was from the wall. From millions of
        plays it computes a <strong>catch probability</strong> for each
        opportunity.</p>
        <p>Make a play with a 25% catch probability and you earn +0.75 outs. Miss
        a routine 95% chance and you lose 0.95. Sum across the season.</p>
        <p>The key advantage over DRS and UZR: it uses <em>measured</em>
        positioning and distance rather than inferring difficulty from a zone
        chart, so it is far less affected by defensive shifts.</p>
        <p><strong>FRV (Fielding Run Value)</strong> is OAA converted into runs —
        roughly 0.75 runs per out.</p>`,
      inputs: [{ key: 'OAA', label: 'Outs above average', def: 12 }],
      compute: F.oaaToRuns,
      resultLabel: 'Approximate runs saved',
      format: 'runs',
    },
    {
      id: 'framing',
      noDist: 'MLB\'s catcher framing leaderboard is the one Savant endpoint that returns no machine-readable data, so this is the single statistic on the site without a live curve. The catcher pop-time distribution on the next page draws from the same population.',
      abbr: 'Framing',
      name: 'Catcher Framing',
      short: 'Turning balls into strikes. The most valuable hidden skill in baseball.',
      formula: 'Runs = (extra strikes gained) × ~0.125 runs per strike',
      body: `
        <p>For a century, nobody could measure the most important thing a catcher
        does. Pitch tracking changed that overnight.</p>
        <p>For every pitch we know its exact location and how often that location
        is called a strike. Compare each catcher's actual calls to expectation and
        you get <strong>extra strikes gained</strong>. Each one is worth about
        0.125 runs.</p>
        <p>The effect is enormous — the best framers save <strong>15–20 runs a
        season</strong>, comparable to an elite shortstop's entire glove value,
        and it was completely invisible before 2008.</p>
        <p>This is the best modern example of a skill that always existed and was
        always valuable, but that nobody could see until the measurement arrived.</p>`,
      note: `MLB's public framing leaderboard does not currently expose a machine-readable feed, so this lesson uses illustrative figures rather than live data.`,
    },
    {
      id: 'cspct',
      dist: {
        source: 'poptime', format: 'pct1', label: 'CS%',
        min: { field: 'attempts', value: 10 },
        valueFn: (r) => F.csPct({ CS: r.CS, SB: r.SB }),
      },
      abbr: 'CS% / PB / Pop Time',
      name: 'Catcher Throwing and Blocking',
      short: 'The visible catching skills.',
      formula: 'CS% = CS ÷ (CS + SB) × 100',
      body: `
        <p><strong>Caught stealing percentage</strong> — league average is around
        25%. Note it is heavily influenced by the <em>pitcher's</em> delivery
        time to the plate, not just the catcher's arm.</p>
        <p><strong>Pop time</strong> — Statcast's measure of glove-to-glove time
        on a throw to second. Elite is under 1.90 seconds; average about 2.00.</p>
        <p><strong>Passed balls and wild pitches</strong> — the blocking skills.
        The distinction between them is another official-scorer judgement call.</p>`,
      inputs: [
        { key: 'CS', label: 'Runners caught stealing', def: 22 },
        { key: 'SB', label: 'Stolen bases allowed', def: 45 },
      ],
      compute: F.csPct,
      format: 'pct1',
      benchmarks: [[35, 'Elite arm'], [28, 'Above average'], [25, 'Average'], [18, 'Poor']],
    },
    {
      id: 'der',
      dist: {
        group: 'team', format: 'rate3',
        valueFn: (r) => F.der({ PA: r.paAgainst, H: r.hAgainst, HR: r.hrAgainst, K: r.kAgainst, BB: r.bbAgainst, HBP: r.hbpAgainst }),
      },
      abbr: 'DER',
      name: 'Defensive Efficiency Ratio',
      short: 'Team-level: share of balls in play converted into outs.',
      formula: 'DER = (PA − H − K − BB − HBP) ÷ (PA − HR − K − BB − HBP)',
      body: `
        <p>The cleanest team defensive measure, and beautifully simple: of all the
        balls hit into the field of play, what fraction did the defence turn into
        outs? League average is around <strong>.690</strong>.</p>
        <p>Because it is measured at team level it avoids the hard problem of
        assigning credit to individuals, which is where most fielding metric
        error comes from.</p>`,
      inputs: [
        { key: 'PA', label: 'Plate appearances against', def: 6100 },
        { key: 'H', label: 'Hits allowed', def: 1350 },
        { key: 'HR', label: 'Home runs allowed', def: 180 },
        { key: 'K', label: 'Strikeouts', def: 1400 },
        { key: 'BB', label: 'Walks', def: 500 },
        { key: 'HBP', label: 'Hit batsmen', def: 60 },
      ],
      compute: F.der,
      format: 'rate3',
      benchmarks: [[0.710, 'Elite defence'], [0.697, 'Above average'], [0.690, 'Average'], [0.675, 'Poor']],
    },
  ],
};

export const BASERUNNING = {
  id: 'baserunning',
  title: 'Baserunning',
  blurb: 'Steals get the attention; the quiet extra base is worth more.',
  intro: `
    <p>Baserunning value splits into two parts, and the smaller one gets all the
    coverage.</p>
    <p><strong>Stealing bases</strong> is loud, and mostly a wash — the caught
    stealing penalty is brutal enough that most basestealers add near zero.
    <strong>Everything else</strong> — going first to third on a single, scoring
    from second, avoiding double plays, never making an out on the bases — is
    quiet and worth more in total.</p>`,
  stats: [
    {
      id: 'breakeven',
      dist: {
        group: 'hitting', format: 'pct1', label: 'SB%',
        min: { field: 'SB', value: 3 },
        valueFn: (r) => F.sbPct(r),
        note: 'Every player with at least three steals. The break-even point is roughly 67% — everyone to the left of that added nothing, or worse, while taking real injury risk.',
      },
      abbr: 'BE%',
      name: 'Stolen Base Break-Even Rate',
      short: 'You must succeed about 2 in 3 times for stealing to be worth attempting.',
      formula: 'Break-even = loss ÷ (gain + loss) = 0.41 ÷ (0.20 + 0.41) ≈ 67%',
      body: `
        <p>This falls straight out of the run expectancy table. Stealing second
        with nobody out moves you from 0.859 to 1.100 expected runs — a gain of
        about <strong>+0.24</strong>. Getting caught drops you to 0.254 — a loss
        of about <strong>−0.61</strong>.</p>
        <p>Because failure costs roughly twice what success gains, the break-even
        success rate lands around <strong>67–75%</strong> depending on the base/out
        state. Steal below that and you are actively hurting your team.</p>`,
      inputs: [
        { key: 'gain', label: 'Run value of a successful steal', def: 0.2, step: 0.01 },
        { key: 'loss', label: 'Run cost of being caught', def: 0.41, step: 0.01 },
      ],
      compute: ({ gain, loss }) => F.stealBreakEven(gain, loss) * 100,
      format: 'pct1',
      resultLabel: 'Break-even success rate',
    },
    {
      id: 'wsb',
      dist: { group: 'hitting' },
      abbr: 'wSB',
      name: 'Weighted Stolen Base Runs',
      short: 'Steal attempts converted into runs above average.',
      formula: 'wSB = (SB × runSB) + (CS × runCS) − (league wSB rate × opportunities)',
      body: `
        <p>Applies the linear weights to steal attempts: about +0.2 runs per
        steal, −0.41 per caught stealing, then compares to what an average runner
        would have done with the same opportunities.</p>
        <p>The range is narrow. Even the best basestealers top out around +6 runs
        — well under a win. This is the stat that quietly demolishes the romance
        of the stolen base.</p>`,
      inputs: [
        { key: 'SB', label: 'Stolen bases', def: 50 },
        { key: 'CS', label: 'Caught stealing', def: 10 },
        { key: 'PA', label: 'Plate appearances', def: 600 },
        { key: 'BB', label: 'Walks', def: 50 },
        { key: 'IBB', label: 'Intentional walks', def: 2 },
        { key: 'HBP', label: 'Hit by pitch', def: 5 },
      ],
      compute: (v, ctx) => F.wsb(v, ctx?.season ?? 2026),
      format: 'runs',
      resultLabel: 'Stolen base runs',
    },
    {
      id: 'ubr',
      dist: {
        source: 'speed', field: 'sprintSpeed', format: 'one', label: 'Sprint speed',
        note: 'UBR is a FanGraphs metric with no public feed. Sprint speed is the measured physical trait that drives most of it, so this is the population UBR is built from.',
      },
      abbr: 'UBR',
      name: 'Ultimate Base Running',
      short: 'Everything except steals — the extra bases taken on other people\'s hits.',
      formula: 'Run value of advancement decisions versus league average, given the situation',
      body: `
        <p>UBR measures the unglamorous stuff: going first to third on a single,
        scoring from second on a single, tagging up, and — critically — the outs
        made trying.</p>
        <p>For most good baserunners UBR is worth <em>more</em> than wSB. Speed
        matters, but so does reading the ball off the bat and knowing the
        outfielder's arm.</p>`,
    },
    {
      id: 'bsr',
      dist: {
        group: 'hitting', format: 'runs', label: 'wSB',
        min: { field: 'PA', value: 150 },
        valueFn: (r, c) => F.wsb(r, c.season),
        note: 'BsR combines wSB, UBR and wGDP, and only FanGraphs publishes the whole thing. wSB is the component computable from public data — and note how narrow the range is.',
      },
      abbr: 'BsR',
      name: 'Base Running Runs',
      short: 'The complete baserunning package: wSB + UBR + wGDP.',
      formula: 'BsR = wSB + UBR + wGDP',
      body: `
        <p>FanGraphs' total baserunning number, and the one that feeds into WAR.
        <strong>wGDP</strong> is the third component: double plays grounded into,
        compared to opportunities.</p>
        <p>The realistic range is roughly −10 to +10 runs, so baserunning is
        worth about one win at the extremes. Real but small — which is exactly
        the point worth internalising.</p>`,
      benchmarks: [[7, 'Elite'], [3, 'Good'], [0, 'Average'], [-5, 'Poor']],
    },
    {
      id: 'spd',
      dist: {
        group: 'hitting', format: 'two', label: 'Spd',
        min: { field: 'PA', value: 150 },
        valueFn: (r) => F.speedScore(r),
      },
      abbr: 'Spd',
      name: 'Speed Score',
      short: 'Bill James\' pre-tracking attempt to measure speed from the box score.',
      formula: 'Average of six components: SB%, SB attempts, triples, runs scored, GIDP rate, range factor',
      body: `
        <p>Ingenious detective work from an era with no tracking data: infer
        speed from its statistical fingerprints. Triples require speed. Avoiding
        double plays requires speed. Scoring from second requires speed.</p>
        <p>Scaled 0–10, average about 5. Now largely superseded by Statcast
        sprint speed, which just measures the thing directly — but it remains
        the only way to estimate speed for players who retired before 2015.</p>`,
    },
  ],
};
