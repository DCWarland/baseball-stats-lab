/*
 * hitting.js — Modules 1 and 2: the box score, and the rate stats built on it.
 *
 * HOW A STAT ENTRY WORKS
 * Each stat is a plain object. The renderer reads it and builds the page:
 *   inputs[]  -> becomes a live calculator, automatically
 *   compute() -> the maths, imported from formulas.js
 *   dist{}    -> becomes the league distribution chart and the top-100 table
 * Add an object here and a fully interactive lesson appears. No UI code.
 */

import * as F from '../formulas.js';

/* Reusable input sets, so we don't retype the same fields for every stat. */
const BOX = [
  { key: 'H', label: 'Hits', def: 156 },
  { key: 'AB', label: 'At-bats', def: 476 },
  { key: 'BB', label: 'Walks', def: 177 },
  { key: 'HBP', label: 'Hit by pitch', def: 9 },
  { key: 'SF', label: 'Sacrifice flies', def: 2 },
  { key: 'doubles', label: 'Doubles', def: 32 },
  { key: 'triples', label: 'Triples', def: 2 },
  { key: 'HR', label: 'Home runs', def: 73 },
];

const pick = (...keys) => BOX.filter((i) => keys.includes(i.key));

export const COUNTING = {
  id: 'counting',
  title: 'The Box Score',
  blurb: 'The raw tally marks. Everything else in baseball analytics is built from these.',
  intro: `
    <p>Every statistic on this site — including the ones that take a paragraph to
    define — is assembled from a short list of things somebody counted by hand at
    the ballpark. Learn these and you can rebuild the rest yourself.</p>
    <p>The single most important idea in this module is the difference between a
    <strong>plate appearance</strong> and an <strong>at-bat</strong>. Get that
    wrong and every rate stat you calculate afterwards will be wrong too.</p>`,
  stats: [
    {
      id: 'pa',
      dist: { group: 'hitting' },
      abbr: 'PA',
      name: 'Plate Appearance',
      short: 'Every completed trip to the plate, no exceptions.',
      formula: 'PA = AB + BB + HBP + SF + SH + CI',
      body: `
        <p>A plate appearance is exactly what it sounds like: the batter came up,
        and something conclusive happened. Walk, strikeout, home run, sacrifice
        bunt, hit by pitch — all plate appearances.</p>
        <p>PA is the honest denominator. If you want to know how often a hitter
        does something <em>per opportunity</em>, this is the number of
        opportunities he had.</p>`,
      gotcha: `If the inning ends while he's still batting — say a runner is caught
        stealing for the third out — that at-bat carries over to the next inning and
        is not a plate appearance.`,
      inputs: [
        { key: 'AB', label: 'At-bats', def: 476 },
        { key: 'BB', label: 'Walks', def: 177 },
        { key: 'HBP', label: 'Hit by pitch', def: 9 },
        { key: 'SF', label: 'Sacrifice flies', def: 2 },
        { key: 'SH', label: 'Sacrifice bunts', def: 0 },
        { key: 'CI', label: "Catcher's interference", def: 0 },
      ],
      compute: F.plateAppearances,
      format: 'int',
    },
    {
      id: 'ab',
      dist: { group: 'hitting' },
      abbr: 'AB',
      name: 'At-Bat',
      short: 'A plate appearance minus walks, hit-by-pitches and sacrifices.',
      formula: 'AB = PA − BB − HBP − SF − SH − CI',
      body: `
        <p>The at-bat is a 19th-century invention designed to measure "did the
        batter get a hit when he tried to". It deliberately removes outcomes
        considered outside the batter's control or not an attempt to hit:
        walks, hit-by-pitches, and sacrifices.</p>
        <p>That decision made sense in 1876. It is the root cause of most of the
        problems modern analytics spent a century fixing, because it treats
        drawing a walk as though it never happened.</p>`,
      gotcha: `A sacrifice fly is not an at-bat, but it IS charged against on-base
        percentage. There is no principled reason for this — it is an accident of
        rule-making history.`,
      inputs: [
        { key: 'PA', label: 'Plate appearances', def: 664 },
        { key: 'BB', label: 'Walks', def: 177 },
        { key: 'HBP', label: 'Hit by pitch', def: 9 },
        { key: 'SF', label: 'Sacrifice flies', def: 2 },
        { key: 'SH', label: 'Sacrifice bunts', def: 0 },
      ],
      compute: ({ PA, BB, HBP, SF, SH }) => PA - BB - HBP - SF - SH,
      format: 'int',
    },
    {
      id: 'h',
      dist: { group: 'hitting' },
      abbr: 'H',
      name: 'Hit',
      short: 'A batted ball that lets the batter reach base safely without an error or fielder\'s choice.',
      formula: 'H = 1B + 2B + 3B + HR',
      body: `
        <p>Hits divide into singles, doubles, triples and home runs. Note that
        <strong>singles are almost never printed anywhere</strong> — you derive
        them by subtracting the extra-base hits from the total.</p>
        <p>Whether a batted ball is a hit or an error is decided by an official
        scorer, a human being with an opinion. This is the softest data point in
        the box score, and it silently contaminates batting average, ERA and
        fielding percentage all at once.</p>`,
      inputs: pick('H', 'doubles', 'triples', 'HR'),
      compute: F.singles,
      resultLabel: 'Singles (1B)',
      format: 'int',
    },
    {
      id: 'tb',
      dist: { group: 'hitting' },
      abbr: 'TB',
      name: 'Total Bases',
      short: 'Bases earned on hits: 1 for a single, 4 for a home run.',
      formula: 'TB = 1B + (2 × 2B) + (3 × 3B) + (4 × HR)',
      body: `
        <p>Total bases is the first stat on this site that <em>weights</em>
        outcomes rather than just counting them. It says a double is worth twice
        a single and a home run four times as much.</p>
        <p>That is an improvement on treating all hits alike — but it is still a
        guess. A home run is not really worth four singles; measured against
        actual run scoring it's worth closer to 2.3. Fixing that guess is what
        leads to linear weights and wOBA later on.</p>`,
      inputs: pick('H', 'doubles', 'triples', 'HR'),
      compute: F.totalBases,
      format: 'int',
    },
    {
      id: 'rbi',
      dist: { group: 'hitting', field: 'RBI', format: 'int' },
      abbr: 'RBI',
      name: 'Runs Batted In',
      short: 'Runs that scored as a direct result of the batter\'s action.',
      formula: 'Counted, not calculated',
      body: `
        <p>An RBI is credited when a runner scores because of what the batter
        did — a hit, a sacrifice, a groundout, a walk with the bases loaded.</p>
        <p>RBI was the premier "run production" stat for most of a century and
        is still quoted constantly. It has one fatal flaw: <strong>you cannot
        drive in runners who are not on base</strong>. A great hitter batting
        behind two players who never reach base will post modest RBI totals
        through no fault of his own.</p>
        <p>RBI is best understood as a measure of <em>opportunity</em> that is
        partly influenced by skill — not a measure of skill.</p>`,
      gotcha: `No RBI is awarded when a run scores on a double play ground-out,
        or when the run scores because of an error.`,
    },
    {
      id: 'r',
      dist: { group: 'hitting', field: 'R', format: 'int' },
      abbr: 'R',
      name: 'Runs Scored',
      short: 'The player crossed home plate.',
      formula: 'Counted, not calculated',
      body: `
        <p>Runs scored has the mirror-image problem of RBI: it depends on the
        hitters batting <em>behind</em> you driving you in. Scoring runs requires
        two skills that belong to two different people — getting on base
        (yours) and being knocked in (theirs).</p>
        <p>Runs and RBI together are the classic example of <strong>context-
        dependent</strong> stats: they describe what happened to a team, not how
        good an individual is.</p>`,
    },
    {
      id: 'bb',
      dist: { group: 'hitting', field: 'BB', format: 'int' },
      abbr: 'BB / IBB',
      name: 'Walk (Base on Balls)',
      short: 'Four balls; the batter is awarded first base.',
      formula: 'Counted. uBB = BB − IBB',
      body: `
        <p>Historically dismissed as passive, the walk is now understood as a
        genuine and highly repeatable skill — walk rate stabilises faster than
        almost any other offensive stat.</p>
        <p><strong>Intentional walks (IBB)</strong> are stripped out of advanced
        stats and counted separately, giving <em>unintentional walks (uBB)</em>.
        The logic: an intentional walk reflects the pitcher's fear and the game
        situation, not the batter's plate discipline in that at-bat.</p>`,
    },
    {
      id: 'so',
      dist: { group: 'hitting', field: 'K', format: 'int', lowerIsBetter: true },
      abbr: 'SO / K',
      name: 'Strikeout',
      short: 'Three strikes; the batter is out.',
      formula: 'Counted, not calculated',
      body: `
        <p>Written "K" by tradition (from the last letter of "struck"). A
        backwards K conventionally means called strike three.</p>
        <p>Strikeouts are only slightly worse than other outs — an out is an out,
        and a strikeout at least never becomes a double play. The old idea that
        strikeouts are uniquely damaging is roughly, but only slightly, true.</p>
        <p>Strikeout rate is the fastest-stabilising stat in baseball: about
        <strong>60 plate appearances</strong> tells you something real.</p>`,
    },
    {
      id: 'sbcs',
      dist: { group: 'hitting' },
      abbr: 'SB / CS',
      name: 'Stolen Base / Caught Stealing',
      short: 'Advancing a base on your own, successfully or otherwise.',
      formula: 'SB% = SB ÷ (SB + CS)',
      body: `
        <p>Steals are the most over-celebrated event in baseball. A successful
        steal gains about <strong>0.2 runs</strong>; getting caught costs about
        <strong>0.41 runs</strong> — you lose a baserunner and an out at once.</p>
        <p>That asymmetry means you need to succeed roughly <strong>two out of
        three times just to break even</strong>. A player with 30 steals and 15
        caught has contributed almost nothing.</p>`,
      inputs: [
        { key: 'SB', label: 'Stolen bases', def: 30 },
        { key: 'CS', label: 'Caught stealing', def: 6 },
      ],
      compute: F.sbPct,
      resultLabel: 'Stolen base success rate',
      format: 'pct1',
      benchmarks: [[85, 'Elite'], [75, 'Worth doing'], [67, 'Break even'], [60, 'Actively harmful']],
    },
    {
      id: 'gidp',
      dist: { group: 'hitting', field: 'GIDP', format: 'int', lowerIsBetter: true },
      abbr: 'GIDP',
      name: 'Grounded Into Double Play',
      short: 'One swing, two outs.',
      formula: 'Counted, not calculated',
      body: `
        <p>The most damaging single non-home-run event in baseball, costing
        roughly <strong>0.8 runs</strong>. It requires a specific set-up — runner
        on first, fewer than two out — so opportunity matters enormously.</p>
        <p>Slow right-handed ground-ball hitters lead these lists. Advanced
        baserunning metrics include a <strong>wGDP</strong> component that
        compares a hitter's double plays to his opportunities.</p>`,
    },
    {
      id: 'lob',
      dist: { group: 'hitting', field: 'LOB', format: 'int' },
      abbr: 'LOB',
      name: 'Left On Base',
      short: 'Runners still standing on the bases when the inning ended.',
      formula: 'Counted, not calculated',
      body: `
        <p>For hitters, LOB is nearly pure noise — it depends entirely on how
        often teammates reached base ahead of you.</p>
        <p>For <em>pitchers</em> the related <strong>LOB%</strong> (strand rate)
        is genuinely useful, and appears in the pitching module. League average
        is about 72%; pitchers far above it usually regress.</p>`,
    },
  ],
};

export const RATE = {
  id: 'rate',
  title: 'Rate Stats',
  blurb: 'Counting stats reward playing time. Rate stats ask: how good was he, per opportunity?',
  intro: `
    <p>A counting stat rewards durability — 40 home runs is partly a statement
    about staying healthy. A <strong>rate stat</strong> divides by opportunity to
    isolate quality.</p>
    <p>Every rate stat is a fraction, and the entire argument of modern baseball
    analytics is about <strong>choosing the right numerator and denominator</strong>.
    Watch what each one includes and, more importantly, what it quietly leaves out.</p>`,
  stats: [
    {
      id: 'avg',
      dist: { group: 'hitting' },
      abbr: 'AVG / BA',
      name: 'Batting Average',
      short: 'Hits per at-bat. The most famous — and least useful — rate stat.',
      formula: 'AVG = H ÷ AB',
      body: `
        <p>Batting average has been baseball's headline number since the 1870s.
        It has three serious defects:</p>
        <ul>
          <li><strong>It ignores walks entirely.</strong> They aren't in the
          numerator or the denominator, so drawing 100 walks is invisible.</li>
          <li><strong>It treats all hits as equal.</strong> A bunt single and a
          grand slam both add exactly 1.</li>
          <li><strong>It is heavily luck-driven.</strong> Whether a line drive
          finds a glove is largely random, and it takes about 910 at-bats before
          batting average tells you more signal than noise.</li>
        </ul>
        <p>It is not worthless — it is a component of OBP and SLG. But as a
        standalone judgement of a hitter it is close to obsolete.</p>`,
      inputs: pick('H', 'AB'),
      compute: F.avg,
      format: 'rate3',
      scale: 'avg',
      benchmarks: [[0.320, 'Elite'], [0.300, 'Great'], [0.260, 'Average'], [0.230, 'Poor']],
    },
    {
      id: 'obp',
      dist: { group: 'hitting' },
      abbr: 'OBP',
      name: 'On-Base Percentage',
      short: 'How often a hitter avoids making an out. The single most important traditional stat.',
      formula: 'OBP = (H + BB + HBP) ÷ (AB + BB + HBP + SF)',
      body: `
        <p>A team gets 27 outs. That is the only truly finite resource in
        baseball. On-base percentage measures how well a hitter protects it.</p>
        <p>OBP correlates with team run scoring far better than batting average
        does — this insight is the entire premise of <em>Moneyball</em>. When
        the Oakland A's bought undervalued high-OBP hitters in the early 2000s,
        they were exploiting the fact that the rest of the industry was still
        paying for batting average.</p>
        <p>Note the strange denominator: sacrifice flies count against you, but
        sacrifice bunts do not. There's no good reason — just history.</p>`,
      inputs: pick('H', 'BB', 'HBP', 'AB', 'SF'),
      compute: F.obp,
      format: 'rate3',
      scale: 'obp',
      benchmarks: [[0.400, 'Elite'], [0.360, 'Great'], [0.320, 'Average'], [0.290, 'Poor']],
      liveField: 'mlbObp',
    },
    {
      id: 'slg',
      dist: { group: 'hitting' },
      abbr: 'SLG',
      name: 'Slugging Percentage',
      short: 'Total bases per at-bat. A power measure, not an average.',
      formula: 'SLG = TB ÷ AB',
      body: `
        <p>Despite the name, slugging is not a percentage — it can exceed 1.000
        (Barry Bonds slugged .863 in 2001, and four players have topped .800).</p>
        <p>SLG shares batting average's blindness to walks, and adds its own
        problem: the 1-2-3-4 weighting is wrong. It overvalues home runs relative
        to their true run impact and undervalues the single.</p>`,
      inputs: pick('H', 'doubles', 'triples', 'HR', 'AB'),
      compute: F.slg,
      format: 'rate3',
      scale: 'slg',
      benchmarks: [[0.550, 'Elite'], [0.480, 'Great'], [0.410, 'Average'], [0.360, 'Poor']],
      liveField: 'mlbSlg',
    },
    {
      id: 'ops',
      dist: { group: 'hitting' },
      scatter: {
        title: 'Is OPS a good stand-in for wOBA?',
        group: 'hitting',
        min: { field: 'PA', value: 150 },
        note: 'OPS is mathematically improper, but look how tightly it tracks the properly weighted stat. This plot is the honest defence of OPS: crude, and about 95% right.',
        x: { label: 'OPS', format: 'rate3z', fn: (r) => F.ops(r) },
        y: { label: 'wOBA', format: 'rate3', fn: (r, c) => F.woba(r, c.season) },
      },
      abbr: 'OPS',
      name: 'On-Base Plus Slugging',
      short: 'OBP + SLG. Statistically improper, but genuinely useful.',
      formula: 'OPS = OBP + SLG',
      body: `
        <p>OPS adds two fractions that have <em>different denominators</em>,
        which is mathematically illegitimate — you would never do this in any
        other field.</p>
        <p>And yet it works. OPS correlates with team runs at about r = 0.95,
        far better than either component alone, and you can compute it in your
        head. It became popular precisely because it is 90% as good as the
        sophisticated stats at 5% of the effort.</p>
        <p>Its real flaw is weighting: OBP is worth roughly <strong>1.8×</strong>
        as much as SLG per point, but OPS weights them equally. wOBA exists to
        fix exactly this.</p>`,
      inputs: pick('H', 'BB', 'HBP', 'AB', 'SF', 'doubles', 'triples', 'HR'),
      compute: F.ops,
      format: 'rate3z',
      scale: 'ops',
      benchmarks: [[1.000, 'MVP level'], [0.900, 'Great'], [0.740, 'Average'], [0.650, 'Poor']],
      liveField: 'mlbOps',
    },
    {
      id: 'iso',
      dist: { group: 'hitting' },
      abbr: 'ISO',
      name: 'Isolated Power',
      short: 'Extra bases per at-bat — power with the singles stripped out.',
      formula: 'ISO = SLG − AVG',
      body: `
        <p>Subtracting batting average from slugging removes the "one base per
        hit" floor, leaving only the <em>extra</em> bases. It answers: when this
        man hits the ball, how far does it go?</p>
        <p>ISO separates two very different .280 hitters — a singles-slapping
        contact man (ISO .090) from a masher (ISO .260).</p>`,
      inputs: pick('H', 'doubles', 'triples', 'HR', 'AB'),
      compute: F.iso,
      format: 'rate3',
      scale: 'iso',
      benchmarks: [[0.250, 'Elite power'], [0.180, 'Above average'], [0.140, 'Average'], [0.100, 'Slap hitter']],
    },
    {
      id: 'babip',
      dist: { group: 'hitting' },
      scatter: {
        title: 'How much does BABIP drag batting average around?',
        group: 'hitting',
        min: { field: 'PA', value: 150 },
        note: 'BABIP and batting average move together almost lockstep — which is precisely why a hot batting average so often turns out to be a hot BABIP that will not last.',
        x: { label: 'BABIP', format: 'rate3', fn: (r) => F.babip(r) },
        y: { label: 'Batting average', format: 'rate3', fn: (r) => F.avg(r) },
      },
      abbr: 'BABIP',
      name: 'Batting Average on Balls In Play',
      short: 'How often batted balls became hits. The single best luck detector in baseball.',
      formula: 'BABIP = (H − HR) ÷ (AB − K − HR + SF)',
      body: `
        <p>Strip out home runs (no fielder can touch them) and strikeouts (never
        in play), and ask: of the balls that fielders actually had a chance at,
        how many fell in?</p>
        <p>League BABIP is remarkably stable at about <strong>.300</strong>. When
        a hitter is far above his own career norm, some of it is skill — hard
        contact and speed genuinely raise BABIP — but much of it is luck that
        will regress.</p>
        <p>For <strong>pitchers</strong> BABIP is far more dramatic. Voros
        McCracken's 1999 finding that pitchers have very little control over
        BABIP was the discovery that launched modern pitching analysis and led
        directly to FIP.</p>`,
      inputs: [
        { key: 'H', label: 'Hits', def: 156 },
        { key: 'HR', label: 'Home runs', def: 73 },
        { key: 'AB', label: 'At-bats', def: 476 },
        { key: 'K', label: 'Strikeouts', def: 93 },
        { key: 'SF', label: 'Sacrifice flies', def: 2 },
      ],
      compute: F.babip,
      format: 'rate3',
      benchmarks: [[0.350, 'Very lucky / elite contact'], [0.310, 'Above average'], [0.300, 'League normal'], [0.270, 'Unlucky / weak contact']],
      liveField: 'mlbBabip',
    },
    {
      id: 'bbpct',
      dist: { group: 'hitting' },
      abbr: 'BB%',
      name: 'Walk Rate',
      short: 'Share of plate appearances ending in a walk.',
      formula: 'BB% = BB ÷ PA × 100',
      body: `
        <p>Note the denominator is <strong>PA, not AB</strong> — using at-bats
        would be circular, since walks aren't at-bats.</p>
        <p>Walk rate stabilises at roughly 120 PA, making it one of the earliest
        trustworthy signals about a young hitter. It reflects both patience and
        the respect pitchers show him.</p>`,
      inputs: [
        { key: 'BB', label: 'Walks', def: 177 },
        { key: 'PA', label: 'Plate appearances', def: 664 },
      ],
      compute: F.bbPct,
      format: 'pct1',
      scale: 'bbpct',
      benchmarks: [[15, 'Elite'], [10, 'Above average'], [8, 'Average'], [5, 'Poor']],
    },
    {
      id: 'kpct',
      dist: { group: 'hitting' },
      scatter: {
        title: 'Do strikeouts actually stop you hitting?',
        group: 'hitting',
        min: { field: 'PA', value: 150 },
        note: 'The relationship is far weaker than the folklore suggests. Plenty of high-strikeout hitters produce enormous value, because the power that causes the strikeouts more than pays for them.',
        x: { label: 'Strikeout rate (%)', format: 'one', fn: (r) => F.kPct(r) },
        y: { label: 'wOBA', format: 'rate3', fn: (r, c) => F.woba(r, c.season) },
      },
      abbr: 'K%',
      name: 'Strikeout Rate',
      short: 'Share of plate appearances ending in a strikeout.',
      formula: 'K% = K ÷ PA × 100',
      body: `
        <p>Preferred over the older "K per AB" for the same reason as walk rate:
        PA is the honest denominator.</p>
        <p>League strikeout rate has climbed relentlessly — from about 12% in the
        1970s to over 22% today. That drift means you must always compare a
        hitter to <em>his own era</em>, not to an absolute standard.</p>`,
      inputs: [
        { key: 'K', label: 'Strikeouts', def: 93 },
        { key: 'PA', label: 'Plate appearances', def: 664 },
      ],
      compute: F.kPct,
      format: 'pct1',
      scale: 'kpct',
      lowerIsBetter: true,
      benchmarks: [[12, 'Elite contact'], [18, 'Above average'], [22, 'Average'], [30, 'Very high']],
    },
    {
      id: 'bbk',
      dist: { group: 'hitting' },
      abbr: 'BB/K',
      name: 'Walk-to-Strikeout Ratio',
      short: 'A quick read on plate discipline.',
      formula: 'BB/K = BB ÷ K',
      body: `
        <p>Above 1.00 means more walks than strikeouts — rare and excellent in
        the modern game. Barry Bonds posted 2.68 in 2004.</p>
        <p>Useful as a shorthand, but it hides <em>volume</em>: a hitter with
        5 BB and 5 K has the same ratio as one with 100 and 100.</p>`,
      inputs: [
        { key: 'BB', label: 'Walks', def: 177 },
        { key: 'K', label: 'Strikeouts', def: 93 },
      ],
      compute: F.bbPerK,
      format: 'two',
      benchmarks: [[1.0, 'Elite discipline'], [0.6, 'Good'], [0.4, 'Average'], [0.25, 'Poor']],
    },
    {
      id: 'abhr',
      dist: { group: 'hitting' },
      abbr: 'AB/HR',
      name: 'At-Bats Per Home Run',
      short: 'How many swings between home runs.',
      formula: 'AB/HR = AB ÷ HR',
      body: `
        <p>A rare stat where <strong>lower is better</strong>. Elite power sits
        under 15; the all-time single-season record is Barry Bonds' 6.52 in 2001.</p>`,
      inputs: [
        { key: 'AB', label: 'At-bats', def: 476 },
        { key: 'HR', label: 'Home runs', def: 73 },
      ],
      compute: F.abPerHr,
      format: 'two',
      lowerIsBetter: true,
      benchmarks: [[10, 'Elite'], [16, 'Good'], [25, 'Average'], [45, 'Little power']],
    },
    {
      id: 'qualify',
      dist: {
        group: 'hitting', field: 'PA', format: 'int', label: 'PA',
        min: { field: 'PA', value: 1 },
        note: 'Every hitter who came to the plate this season. The cliff on the right is the qualifying line — 3.1 PA per team game. Notice how few players clear it.',
      },
      abbr: 'Qual.',
      name: 'Qualifying for a Rate Title',
      short: 'You need 3.1 plate appearances per team game to appear on a leaderboard.',
      formula: 'Qualified PA = 3.1 × team games played',
      body: `
        <p>Over a 162-game season that is <strong>502 plate appearances</strong>.
        For pitchers it's 1 inning per team game — 162 innings.</p>
        <p>The rule exists to stop a player with 40 great PA from winning a
        batting title. It's why leaderboards suddenly change shape in April, and
        why you must always check the minimum before comparing rate stats.</p>`,
      inputs: [
        { key: 'G', label: 'Team games played', def: 162 },
      ],
      compute: ({ G }) => G * 3.1,
      resultLabel: 'PA needed to qualify',
      format: 'int',
    },
  ],
};
