/*
 * value.js — Modules 10, 11 and 12.
 *
 * Module 10: WAR — putting everything into one currency.
 * Module 11: win probability — measuring what actually happened, moment by moment.
 * Module 12: team-level stats, and knowing when a number is real.
 */

import * as F from '../formulas.js';
import { STABILISATION, POSITION_ADJUSTMENT } from '../constants.js';

/*
 * Offensive WAR, computed live for every hitter.
 *
 * This is batting + position + replacement only. Fielding and baserunning runs
 * are not in any public feed, so they are omitted rather than guessed — which
 * means these values run a little low for good gloves and a little high for
 * bad ones. The shape of the distribution is right; treat individual figures
 * as "WAR from the bat", not full WAR.
 */
const offensiveWar = (r, c) => {
  const runs = F.wraa(r, c.season, c.lgwOBA);
  if (runs == null || !r.PA) return null;
  const posAdj = (POSITION_ADJUSTMENT[r.position] ?? 0) * (r.PA / 600);
  const replacement = 20 * (r.PA / 600);
  return (runs + posAdj + replacement) / 10;
};

const WAR_NOTE = 'Batting, position and replacement level only — fielding and baserunning runs have no public feed, so they are left out rather than guessed. The shape is right; individual values are "WAR from the bat".';

export const WAR = {
  id: 'war',
  title: 'WAR: One Number for Everything',
  blurb: 'Hitting, baserunning, fielding, position and playing time — converted to wins.',
  intro: `
    <p>WAR is not really a statistic. It is a <strong>recipe</strong> for
    combining statistics.</p>
    <p>The problem it solves: how do you compare a slugging first baseman to a
    slick-fielding shortstop to an ace starter? They contribute in units that
    don't add up. WAR's answer is to convert everything into <strong>runs</strong>,
    add them, then divide by how many runs buy a win.</p>
    <p>The recipe, in order:</p>
    <ol>
      <li>Batting runs above average (from wRAA)</li>
      <li>Baserunning runs above average (BsR)</li>
      <li>Fielding runs above average (UZR, DRS or OAA)</li>
      <li>Positional adjustment — credit for playing a hard position</li>
      <li>Replacement runs — the cushion over a freely available scrub</li>
      <li>Divide the total by ~10 runs per win</li>
    </ol>`,
  stats: [
    {
      id: 'replacement',
      dist: {
        group: 'hitting', format: 'one', label: 'Offensive WAR',
        min: { field: 'PA', value: 150 },
        valueFn: offensiveWar,
        note: 'Every qualifying hitter\'s value in wins. The whole point of replacement level is that zero on this axis is not "average" — it is what a team could sign for nothing tomorrow.',
      },
      abbr: 'Repl.',
      name: 'Replacement Level',
      short: 'The baseline: what you get for free off the waiver wire.',
      formula: 'A team of replacement-level players wins about 48 games in 162',
      body: `
        <p>This is the conceptual foundation, and the part people find least
        intuitive. WAR does not compare a player to <em>average</em> — it compares
        him to <strong>replacement level</strong>: the quality of player any team
        can acquire for nothing, at any time.</p>
        <p>Why not use average? Because an average player is genuinely valuable
        and quite scarce. A team of literally average players wins 81 games. A
        team of freely available minor-league fillers wins about 48. That 48-win
        floor is the real zero point.</p>
        <p>The 1,000 WAR available across MLB each season is split roughly 57/43
        between position players and pitchers.</p>`,
    },
    {
      id: 'posadj',
      dist: {
        group: 'hitting', format: 'runs', label: 'Positional runs',
        min: { field: 'PA', value: 150 },
        valueFn: (r) => (POSITION_ADJUSTMENT[r.position] ?? 0) * ((r.PA ?? 0) / 600),
        note: 'The positional adjustment every current hitter actually receives, scaled to his playing time. The clusters are the positions.',
      },
      abbr: 'Pos',
      name: 'Positional Adjustment',
      short: 'Credit for playing a difficult position, in runs per 600 PA.',
      formula: 'C +12.5 · SS +7.5 · CF/2B +2.5 · 3B +2.0 · LF/RF −7.5 · 1B −12.5 · DH −17.5',
      body: `
        <p>The same batting line is worth more from a shortstop than a first
        baseman, because far fewer people can play shortstop competently. The
        positional adjustment prices that scarcity.</p>
        <p>The numbers come from measuring how the same players perform when they
        move between positions — if a shortstop moves to second base and his
        fielding metrics jump by 5 runs, that gap is the difficulty difference.</p>
        <p>Note the full spread: catcher to DH is <strong>30 runs</strong>, or
        three wins per season, before anyone swings a bat.</p>`,
      widget: 'positionAdjustmentTable',
    },
    {
      id: 'fwar',
      dist: {
        group: 'hitting', format: 'one', label: 'Offensive WAR',
        min: { field: 'PA', value: 150 },
        valueFn: offensiveWar,
        note: WAR_NOTE,
      },
      abbr: 'WAR',
      name: 'Wins Above Replacement (position players)',
      short: 'The complete value estimate for a hitter.',
      formula: 'WAR = (batting + baserunning + fielding + positional + replacement runs) ÷ runs per win',
      body: `
        <p>Add the components, divide by about 10. The calculator below lets you
        build a player from parts and watch how each contributes — try setting a
        catcher and a DH to identical batting runs and see the gap.</p>
        <p>Rough interpretation of a full season:</p>
        <ul>
          <li><strong>8+</strong> — MVP, historically great</li>
          <li><strong>5–6</strong> — All-Star, MVP candidate</li>
          <li><strong>3–4</strong> — solid everyday regular</li>
          <li><strong>1–2</strong> — role player</li>
          <li><strong>0</strong> — replacement level; freely available</li>
        </ul>`,
      gotcha: `WAR has an error bar of roughly ±1 win, mostly from the fielding
        component. A 4.2 WAR player and a 3.8 WAR player are indistinguishable.
        Never use WAR to make fine distinctions — use it to sort players into
        broad tiers.`,
      inputs: [
        { key: 'battingRuns', label: 'Batting runs above avg (wRAA)', def: 45, step: 1 },
        { key: 'baserunningRuns', label: 'Baserunning runs (BsR)', def: 3, step: 0.5 },
        { key: 'fieldingRuns', label: 'Fielding runs (UZR/DRS)', def: 8, step: 1 },
        { key: 'PA', label: 'Plate appearances', def: 650 },
        { key: 'position', label: 'Position', def: 'SS', type: 'select', options: ['C', 'SS', 'CF', '2B', '3B', 'LF', 'RF', '1B', 'DH'] },
      ],
      compute: F.warBatting,
      format: 'one',
      scale: 'war',
      benchmarks: [[8, 'Historic season'], [5, 'All-Star'], [2, 'Regular'], [0, 'Replacement']],
    },
    {
      id: 'pwar',
      dist: {
        group: 'pitching', format: 'one', label: 'Pitcher WAR',
        min: { field: 'outs', value: 90 },
        valueFn: (r, c) => F.warPitching({
          IP: r.IP,
          playerFip: F.fip(r, c.cFIP ?? 3.15),
          lgFip: c.lgFIP ?? 4.15,
          role: (r.GS ?? 0) >= 5 ? 'SP' : 'RP',
        }),
        note: 'Computed from each pitcher\'s live FIP and innings. Starters and relievers are held to different replacement levels, which is why the two groups separate.',
      },
      abbr: 'WAR (P)',
      name: 'Wins Above Replacement (pitchers)',
      short: 'The pitching version — same currency, different components.',
      formula: 'WAR = ((replacement RA9 − pitcher RA9) ÷ 9 × IP) ÷ runs per win',
      body: `
        <p>Same logic: measure runs prevented versus a replacement-level pitcher,
        convert to wins.</p>
        <p>The major fork in the road: <strong>FanGraphs (fWAR)</strong> builds
        pitcher WAR on FIP, crediting only what the pitcher controls.
        <strong>Baseball-Reference (bWAR)</strong> uses actual runs allowed,
        adjusted for the team's defence.</p>
        <p>Neither is wrong. fWAR asks "how well did he pitch?", bWAR asks "what
        happened while he pitched?". They can differ by 2+ wins for a pitcher with
        an unusual BABIP — and when they do, that gap is itself informative.</p>`,
      inputs: [
        { key: 'IP', label: 'Innings pitched', def: 200, step: 0.1 },
        { key: 'playerFip', label: 'Player FIP', def: 3.0, step: 0.05 },
        { key: 'lgFip', label: 'League FIP', def: 4.15, step: 0.05 },
        { key: 'role', label: 'Role', def: 'SP', type: 'select', options: ['SP', 'RP'] },
      ],
      compute: F.warPitching,
      format: 'one',
      scale: 'war',
    },
    {
      id: 'rar',
      dist: {
        group: 'hitting', format: 'one', label: 'Runs above replacement',
        min: { field: 'PA', value: 150 },
        valueFn: (r, c) => { const w = offensiveWar(r, c); return w == null ? null : w * 10; },
        note: 'The same population as WAR, one step earlier — before dividing by runs per win. Identical information, run units.',
      },
      abbr: 'RAR',
      name: 'Runs Above Replacement',
      short: 'WAR before the final division. Same information, run units.',
      formula: 'RAR = WAR × runs per win',
      body: `
        <p>Some analysts prefer RAR because runs are the natural unit and the
        division by 10 adds a small amount of extra imprecision. A 5.0 WAR season
        is about 50 RAR.</p>`,
      inputs: [{ key: 'war', label: 'WAR', def: 5.0, step: 0.1 }],
      compute: ({ war }) => F.rar(war),
      format: 'one',
      resultLabel: 'Runs above replacement',
    },
    {
      id: 'warflavours',
      dist: {
        group: 'hitting', format: 'one', label: 'Offensive WAR',
        min: { field: 'PA', value: 150 },
        valueFn: offensiveWar,
        note: 'One flavour of WAR, computed here. fWAR, bWAR and WARP would each produce a slightly different curve over the same players — which is the point of this lesson.',
      },
      abbr: 'fWAR / bWAR / WARP',
      name: 'The Three Flavours of WAR',
      short: 'Why the same player has three different WAR values.',
      formula: 'Different fielding inputs, different pitching inputs, different park adjustments',
      body: `
        <table class="data-table">
          <thead><tr><th></th><th>fWAR (FanGraphs)</th><th>bWAR (B-Ref)</th><th>WARP (BP)</th></tr></thead>
          <tbody>
            <tr><td>Pitching basis</td><td>FIP</td><td>Runs allowed</td><td>DRA</td></tr>
            <tr><td>Fielding basis</td><td>UZR / OAA</td><td>DRS</td><td>FRAA</td></tr>
            <tr><td>Asks</td><td>How well did he pitch?</td><td>What happened?</td><td>Best estimate of true talent</td></tr>
          </tbody>
        </table>
        <p>Always state which WAR you mean. The differences are real, defensible,
        and occasionally large. When two versions disagree sharply about a player,
        that disagreement is usually the most interesting thing about him.</p>`,
    },
  ],
};

export const WINPROB = {
  id: 'winprob',
  title: 'Win Probability & Leverage',
  blurb: 'Not how well he played — how much his plays mattered to winning.',
  intro: `
    <p>Everything in the WAR module is context-neutral: a home run counts the
    same in a blowout as in a tie game.</p>
    <p>Win probability statistics take the opposite view. They ask, at every
    moment: given the score, inning, outs and baserunners, what percentage of
    historical games in this exact situation were won? Then they credit the
    player with the change he caused.</p>
    <p>These stats are excellent <strong>descriptions</strong> of what happened
    and poor <strong>predictions</strong> of what will happen — because timing
    doesn't repeat.</p>`,
  stats: [
    {
      id: 'we',
      noDist: 'Win expectancy is a property of a game state, not of a player, so there is no season-long population to plot. The run expectancy table in Module 3 is the closest thing this site can show you, and it works the same way.',
      abbr: 'WE',
      name: 'Win Expectancy',
      short: 'The probability the team wins from this exact game state.',
      formula: 'Historical win rate for this inning / score / base / out combination',
      body: `
        <p>Built from decades of play-by-play data. A home team leading by one in
        the bottom of the ninth wins about 85% of the time; trailing by three in
        the ninth with two out and nobody on, under 1%.</p>`,
    },
    {
      id: 'wpa',
      noDist: 'FanGraphs publishes WPA but exposes no open feed for it, and it cannot be rebuilt from season totals — WPA needs every plate appearance in sequence. The wRAA curve is the context-neutral equivalent.',
      abbr: 'WPA',
      name: 'Win Probability Added',
      short: 'The sum of every swing in win expectancy a player caused.',
      formula: 'WPA = Σ (win expectancy after − win expectancy before)',
      body: `
        <p>A walk-off grand slam can be worth <strong>+0.85 WPA</strong> in a
        single swing. The identical grand slam in a 12–1 blowout is worth about
        +0.01.</p>
        <p>This is the "story of the game" stat — perfect for describing who won
        a game and useless for projecting next season, because clutch timing shows
        almost no year-to-year persistence.</p>`,
    },
    {
      id: 'li',
      noDist: 'Leverage Index is measured per plate appearance and has no public season-long feed. Nothing in MLB\'s or Savant\'s open data reconstructs it.',
      abbr: 'LI',
      name: 'Leverage Index',
      short: 'How much is riding on this moment? 1.0 = average.',
      formula: 'LI = (swing in win probability available here) ÷ (average swing)',
      body: `
        <p>A tie game in the ninth with the bases loaded has an LI above
        <strong>5</strong>. A 10-run lead in the eighth has an LI near
        <strong>0.1</strong>.</p>
        <p>Variants: <strong>pLI</strong> (average leverage a player faced),
        <strong>gmLI</strong> (leverage when a reliever entered the game).</p>
        <p>gmLI is the number that exposes the save rule's damage: closers
        typically enter at gmLI around 1.8, while the highest-leverage moments of
        a game often occur in the seventh inning with a setup man on the mound.</p>`,
      benchmarks: [[2.0, 'High leverage'], [1.0, 'Average'], [0.85, 'Medium'], [0.5, 'Low leverage']],
    },
    {
      id: 'clutch',
      noDist: 'Clutch is derived from WPA and leverage, neither of which has an open feed. It is also the least predictive statistic on this site, so a curve would tell you very little anyway.',
      abbr: 'Clutch',
      name: 'Clutch Score',
      short: 'Did he perform better or worse than himself when it mattered?',
      formula: 'Clutch = (WPA ÷ pLI) − WPA/LI context-neutral',
      body: `
        <p>Crucially, Clutch does not measure whether a player is <em>good</em> in
        big spots — it measures whether he was <strong>better than his own
        baseline</strong> in them.</p>
        <p>The research finding is consistent and unpopular: clutch performance
        shows almost no year-to-year correlation. A player who was clutch last
        season is no more likely than anyone else to be clutch this season. It is
        real when it happens and essentially unpredictable.</p>`,
    },
    {
      id: 'rew',
      noDist: 'Like WPA, this needs play-by-play sequencing rather than season totals, and no public endpoint serves it.',
      abbr: 'REW / RE24',
      name: 'Run Expectancy Wins',
      short: 'The middle ground: context for baserunners, but not for the score.',
      formula: 'REW = RE24 converted to wins',
      body: `
        <p>A useful compromise. RE24 counts the base/out situation (so a grand
        slam beats a solo shot) but ignores the score and inning (so a blowout
        counts the same as a tie game).</p>
        <p>The three-way comparison is the clearest way to see what each family
        of stats is doing: <strong>wRC+</strong> ignores all context,
        <strong>RE24</strong> counts baserunners, <strong>WPA</strong> counts
        everything including the scoreboard.</p>`,
    },
  ],
};

export const TEAM = {
  id: 'team',
  title: 'Team & Season Analysis',
  blurb: 'Which teams are good, which are lucky, and how to tell the difference.',
  intro: `
    <p>Team records lie more than you'd think. A 90-win team and an 84-win team
    can be identical in true quality, separated only by how their one-run games
    happened to fall.</p>
    <p>These stats strip out that noise.</p>`,
  stats: [
    {
      id: 'pythag',
      dist: {
        group: 'team', format: 'one', label: 'Expected wins',
        valueFn: (r) => F.pythagoreanWins(r),
        note: 'All 30 clubs\' Pythagorean win totals from their real runs scored and allowed. Compare a club here with its actual record — the gap is one-run-game luck.',
      },
      abbr: 'Pythag',
      name: 'Pythagorean Expectation',
      short: 'The record a team "should" have, from runs scored and allowed.',
      formula: 'Win% = RS^1.83 ÷ (RS^1.83 + RA^1.83)',
      body: `
        <p>Bill James noticed the resemblance to the Pythagorean theorem and the
        name stuck. The exponent 1.83 was found empirically.</p>
        <p>It is startlingly accurate — usually within 3–4 wins of a team's real
        record. Teams that <em>beat</em> their Pythagorean record are typically
        lucky in one-run games rather than specially clutch, and they reliably
        regress the following season.</p>
        <p>This makes it one of the better simple predictors: a team's
        Pythagorean record predicts next year better than its actual record does.</p>`,
      inputs: [
        { key: 'RS', label: 'Runs scored', def: 750 },
        { key: 'RA', label: 'Runs allowed', def: 680 },
        { key: 'G', label: 'Games played', def: 162 },
      ],
      // Wrapped so the renderer's second argument (ctx) is not mistaken for
      // the exponent parameter — see the note in render.js on the compute contract.
      compute: (v) => F.pythagoreanWins(v),
      format: 'one',
      resultLabel: 'Expected wins',
    },
    {
      id: 'pythagenpat',
      dist: {
        group: 'team', format: 'two', label: 'Exponent',
        valueFn: (r) => F.pythagenpatExponent(r),
        note: 'The exponent each club\'s own run environment implies. They cluster tightly near 1.83, which is exactly why the fixed value worked so well for so long.',
      },
      abbr: 'PythagenPat',
      name: 'PythagenPat',
      short: 'Pythagorean expectation with the exponent derived from the run environment.',
      formula: 'exponent = ((RS + RA) ÷ G) ^ 0.287',
      body: `
        <p>The fixed 1.83 exponent breaks down in extreme run environments — 1968
        (very low scoring) or a Coors Field team (very high). PythagenPat derives
        the exponent from actual runs per game instead.</p>
        <p>In a normal environment it returns something very close to 1.83, so
        you rarely notice the difference — which is exactly what a good
        refinement should do.</p>`,
      inputs: [
        { key: 'RS', label: 'Runs scored', def: 750 },
        { key: 'RA', label: 'Runs allowed', def: 680 },
        { key: 'G', label: 'Games played', def: 162 },
      ],
      compute: F.pythagenpatExponent,
      format: 'two',
      resultLabel: 'Derived exponent',
    },
    {
      id: 'rundiff',
      dist: {
        group: 'team', format: 'int', label: 'Run differential',
        valueFn: (r) => r.RS - r.RA,
      },
      abbr: 'RD',
      name: 'Run Differential',
      short: 'Runs scored minus runs allowed. Crude, and better than the standings.',
      formula: 'RD = RS − RA',
      body: `
        <p>Roughly <strong>10 runs of differential equals 1 win</strong>. That
        single fact lets you sanity-check any trade or signing in your head.</p>
        <p>Run differential predicts future winning percentage better than
        current winning percentage does — which is worth sitting with for a
        moment, because it means the standings are a worse guide to team quality
        than a simple subtraction.</p>`,
      inputs: [
        { key: 'RS', label: 'Runs scored', def: 750 },
        { key: 'RA', label: 'Runs allowed', def: 680 },
      ],
      compute: ({ RS, RA }) => RS - RA,
      format: 'int',
      resultLabel: 'Run differential',
    },
    {
      id: 'rpw',
      dist: {
        group: 'team', format: 'two', label: 'Runs per win',
        valueFn: (r) => F.runsPerWin(r),
      },
      abbr: 'RPW',
      name: 'Runs Per Win',
      short: 'How many runs it takes to buy a win — it depends on the era.',
      formula: 'RPW ≈ 10 × √(total runs per game ÷ 9)',
      body: `
        <p>In a high-scoring era runs are cheap, so you need more of them to gain
        a win. In 1968 a run was worth much more than in 2000.</p>
        <p>This is why WAR calculations must use era-appropriate conversion rates
        rather than a flat 10.</p>`,
      inputs: [
        { key: 'RS', label: 'Runs scored', def: 750 },
        { key: 'RA', label: 'Runs allowed', def: 680 },
        { key: 'G', label: 'Games played', def: 162 },
      ],
      compute: F.runsPerWin,
      format: 'two',
      resultLabel: 'Runs per win',
    },
    {
      id: 'thirdorder',
      dist: {
        group: 'team', format: 'int', label: 'BaseRuns',
        valueFn: (r) => F.baseRuns(r),
        note: 'Third-order wins is a Baseball Prospectus product. This is the second-order idea it builds on: runs implied by each club\'s underlying events rather than by the runs it happened to score.',
      },
      abbr: '3rd Order',
      name: 'Third-Order Wins',
      short: 'Baseball Prospectus\' deepest luck-stripping: what a team truly deserved.',
      formula: 'Wins implied by underlying events, adjusted for strength of schedule',
      body: `
        <p>A ladder of increasing scepticism:</p>
        <ul>
          <li><strong>First-order</strong> — wins from actual runs scored/allowed
          (Pythagorean).</li>
          <li><strong>Second-order</strong> — wins from the underlying
          <em>events</em> (hits, walks, home runs) rather than actual runs,
          stripping out sequencing luck.</li>
          <li><strong>Third-order</strong> — second-order, adjusted for strength
          of schedule.</li>
        </ul>
        <p>Third-order wins is the best available estimate of how good a team
        genuinely was, and the best simple predictor of next season.</p>`,
    },
    {
      id: 'projections',
      noDist: 'Projections are forecasts rather than measurements, and the systems that produce them (ZiPS, Steamer, THE BAT) are published as static tables with no open API. Every other curve on this site describes what has already happened.',
      abbr: 'ZiPS / Steamer',
      name: 'Projection Systems',
      short: 'How the future is actually forecast.',
      formula: 'Weighted multi-year history + aging curve + regression to the mean',
      body: `
        <p>Every serious projection system does the same three things:</p>
        <ol>
          <li><strong>Weight recent seasons more heavily</strong> — typically
          something like 5/4/3 for the last three years.</li>
          <li><strong>Apply an aging curve</strong> — hitters peak around 26–27
          and decline steadily after 30; pitchers are less predictable.</li>
          <li><strong>Regress toward the mean</strong> — pull extreme performances
          back toward league average by an amount that depends on sample size.</li>
        </ol>
        <p><strong>Marcel</strong> is the deliberately simple baseline ("the
        monkey"), and it is surprisingly hard to beat. <strong>ZiPS</strong> adds
        comparable-player matching; <strong>Steamer</strong> and
        <strong>THE BAT X</strong> add batted-ball and Statcast inputs.</p>
        <p>If a fancy system cannot beat Marcel, it isn't adding anything — which
        is a useful standard to hold any model to.</p>`,
      widget: 'stabilisationTable',
    },
  ],
};

export { STABILISATION };
