/*
 * pitching.js — Modules 5 and 6.
 *
 * Module 5: the stats on the back of a baseball card, and why most mislead.
 * Module 6: DIPS theory — the single biggest idea in pitching analysis.
 */

import * as F from '../formulas.js';

const DEGROM_2018 = [
  { key: 'ER', label: 'Earned runs', def: 41 },
  { key: 'IP', label: 'Innings pitched (6.1 = 6⅓)', def: 217, step: 0.1 },
];

export const PITCHING = {
  id: 'pitching',
  title: 'Pitching: The Traditional Stats',
  blurb: 'ERA, wins and saves — what they measure, and what they only appear to measure.',
  intro: `
    <p>Pitching stats have a structural problem that hitting stats don't: a
    pitcher cannot record an out by himself. Eight other men are involved in
    almost every result, and the traditional stats charge the pitcher for all
    of it.</p>
    <p>Learn these because everyone quotes them — then learn Module 6 to
    understand what they actually tell you.</p>`,
  stats: [
    {
      id: 'ip',
      dist: { group: 'pitching' },
      abbr: 'IP',
      name: 'Innings Pitched',
      short: 'Outs recorded, divided by three — written in a notation that trips everyone up.',
      formula: 'IP = outs ÷ 3, displayed as whole.thirds',
      body: `
        <p><strong>Read this carefully, because it causes real bugs.</strong>
        "6.1 IP" does not mean six and one tenth innings. It means six innings
        and <em>one out</em> — six and a third.</p>
        <p>So 6.1 + 6.2 = 13.0, not 12.3. If you ever sum innings pitched, you
        must convert to outs first, add, then convert back. This site's code does
        exactly that in <code>ipToOuts()</code>, and it is the most common
        mistake in amateur baseball analysis.</p>`,
      inputs: [{ key: 'IP', label: 'Innings pitched (e.g. 6.1)', def: 6.1, step: 0.1 }],
      compute: ({ IP }) => F.ipToOuts(IP),
      resultLabel: 'Total outs recorded',
      format: 'int',
    },
    {
      id: 'era',
      dist: { group: 'pitching' },
      abbr: 'ERA',
      name: 'Earned Run Average',
      short: 'Earned runs allowed per nine innings. The traditional headline number.',
      formula: 'ERA = (ER ÷ IP) × 9',
      body: `
        <p>ERA has been the standard since 1912. Its problems are all about the
        word <em>earned</em>:</p>
        <ul>
          <li><strong>The earned/unearned split is decided by an official
          scorer.</strong> A ball a good shortstop reaches and boots is an error
          (unearned); the identical ball a poor shortstop never reaches is a hit
          (earned). Bad defence can literally lower your ERA.</li>
          <li><strong>It charges the pitcher for his fielders.</strong> A pitcher
          behind a bad defence allows more hits and more runs through no fault
          of his own.</li>
          <li><strong>Relievers distort it.</strong> Inherited runners who score
          are charged to the pitcher who put them on.</li>
        </ul>`,
      inputs: DEGROM_2018,
      compute: F.era,
      format: 'era',
      scale: 'era',
      lowerIsBetter: true,
      benchmarks: [[2.75, 'Elite'], [3.50, 'Great'], [4.15, 'Average'], [5.00, 'Poor']],
      liveField: 'mlbEra',
    },
    {
      id: 'ra9',
      dist: { group: 'pitching' },
      abbr: 'RA9',
      name: 'Runs Allowed per 9',
      short: 'Like ERA, but counts every run — no scorer judgement involved.',
      formula: 'RA9 = (R ÷ IP) × 9',
      body: `
        <p>RA9 sidesteps the earned/unearned mess entirely by counting all runs.
        It runs about 8% higher than ERA.</p>
        <p>Baseball-Reference's version of WAR is built on RA9 rather than ERA,
        on the reasoning that a run is a run regardless of what a scorer decided
        about it.</p>`,
      inputs: [
        { key: 'R', label: 'Total runs allowed', def: 48 },
        { key: 'IP', label: 'Innings pitched', def: 217, step: 0.1 },
      ],
      compute: F.ra9,
      format: 'era',
      lowerIsBetter: true,
    },
    {
      id: 'whip',
      dist: { group: 'pitching' },
      abbr: 'WHIP',
      name: 'Walks and Hits per Inning Pitched',
      short: 'Baserunners allowed per inning.',
      formula: 'WHIP = (BB + H) ÷ IP',
      body: `
        <p>A clean measure of traffic on the bases. Elite is around 1.00 — one
        baserunner per inning.</p>
        <p>Two flaws worth knowing: it omits hit batsmen (which are just as much
        a baserunner as a walk), and it weights a walk exactly the same as a home
        run, which is plainly wrong.</p>`,
      inputs: [
        { key: 'BB', label: 'Walks', def: 46 },
        { key: 'H', label: 'Hits allowed', def: 152 },
        { key: 'IP', label: 'Innings pitched', def: 217, step: 0.1 },
      ],
      compute: F.whip,
      format: 'two',
      scale: 'whip',
      lowerIsBetter: true,
      benchmarks: [[1.00, 'Elite'], [1.15, 'Great'], [1.30, 'Average'], [1.45, 'Poor']],
      liveField: 'mlbWhip',
    },
    {
      id: 'wins',
      dist: { group: 'pitching' },
      abbr: 'W-L',
      name: 'Wins and Losses',
      short: 'The most misleading statistic in baseball.',
      formula: 'Awarded by rule, not calculated',
      body: `
        <p>A starting pitcher gets the win if he throws at least 5 innings, his
        team leads when he leaves, and never surrenders that lead. Every part of
        that depends on other people.</p>
        <p>The definitive case is <strong>Jacob deGrom in 2018</strong>: a 1.70
        ERA — the best in baseball by a mile — and a <strong>10-9</strong>
        record, because the Mets scored almost nothing for him. He won the Cy
        Young anyway, which is the moment the voting public formally abandoned
        pitcher wins.</p>
        <p>A pitcher's win-loss record tells you about his offence and his
        bullpen. It tells you very little about him.</p>`,
      inputs: [
        { key: 'W', label: 'Wins', def: 10 },
        { key: 'L', label: 'Losses', def: 9 },
      ],
      compute: F.winPct,
      resultLabel: 'Winning percentage',
      format: 'rate3',
    },
    {
      id: 'saves',
      dist: { group: 'pitching', field: 'saves', format: 'int', min: { field: 'outs', value: 60 } },
      abbr: 'SV / BS / HLD',
      name: 'Saves, Blown Saves, Holds',
      short: 'A statistic that reshaped how bullpens are used — arguably for the worse.',
      formula: 'Awarded by rule',
      body: `
        <p>A save requires finishing a win while: leading by 3 or fewer, or
        facing the tying run, or pitching 3+ effective innings.</p>
        <p>The save was invented by a sportswriter in 1960 and became official in
        1969. Its unintended consequence was enormous: managers began reserving
        their best reliever exclusively for the ninth inning with a lead —
        <em>often the least critical situation in a close game</em>. A three-run
        ninth-inning lead is far safer than a tie game in the seventh with the
        bases loaded, yet the save rule sends your ace to the former.</p>
        <p>Leverage Index, in the value module, is the stat that exposes this.</p>`,
    },
    {
      id: 'qs',
      dist: {
        group: 'pitching', field: 'GS', format: 'int', label: 'Games started',
        min: { field: 'outs', value: 150 },
        note: 'MLB\'s season feed does not publish quality starts, so this is the games-started distribution — the population every QS total is drawn from.',
      },
      abbr: 'QS',
      name: 'Quality Start',
      short: '6+ innings and 3 or fewer earned runs.',
      formula: '6 IP and ≤ 3 ER',
      body: `
        <p>Created by John Lowe in 1985 as a better alternative to wins. The
        standard joke is that the minimum qualifying line — exactly 6 innings and
        3 earned runs — is a 4.50 ERA, which is mediocre.</p>
        <p>That criticism is fair but overstated: in practice the average quality
        start produces an ERA around 2.00, because most of them are much better
        than the bare minimum.</p>`,
    },
    {
      id: 'k9',
      dist: { group: 'pitching' },
      abbr: 'K/9, BB/9, HR/9',
      name: 'Per-Nine Rates',
      short: 'Events per nine innings — the traditional way to express pitcher rates.',
      formula: 'K/9 = (K ÷ IP) × 9',
      body: `
        <p>Intuitive and long-established, but they have a subtle flaw: the
        denominator is <em>innings</em>, and a pitcher who allows lots of
        baserunners faces more batters per inning. That inflates his per-nine
        rates without him doing anything better.</p>
        <p>K% and BB% (per batter faced) are cleaner, which is why analysts have
        largely moved to them.</p>`,
      inputs: [
        { key: 'K', label: 'Strikeouts', def: 269 },
        { key: 'IP', label: 'Innings pitched', def: 217, step: 0.1 },
      ],
      compute: F.kPer9,
      resultLabel: 'K/9',
      format: 'two',
      benchmarks: [[11, 'Elite'], [9, 'Above average'], [8.2, 'Average'], [6.5, 'Poor']],
    },
    {
      id: 'kbbpct',
      dist: { group: 'pitching' },
      abbr: 'K−BB%',
      name: 'Strikeout Minus Walk Rate',
      short: 'The most predictive simple pitching stat there is.',
      formula: 'K−BB% = (K − BB) ÷ BF × 100',
      body: `
        <p>Deceptively powerful. It captures the two outcomes a pitcher most
        controls, per batter faced, in one number — and it predicts future ERA
        better than current ERA does.</p>
        <p>If you only ever look at one pitching stat beyond the basics, this is
        a strong candidate.</p>`,
      inputs: [
        { key: 'K', label: 'Strikeouts', def: 269 },
        { key: 'BB', label: 'Walks', def: 46 },
        { key: 'BF', label: 'Batters faced', def: 835 },
      ],
      compute: F.kMinusBbPct,
      format: 'pct1',
      benchmarks: [[25, 'Elite'], [18, 'Above average'], [13, 'Average'], [8, 'Poor']],
    },
    {
      id: 'lobpct',
      dist: { group: 'pitching' },
      abbr: 'LOB%',
      name: 'Left On Base Percentage (Strand Rate)',
      short: 'Share of baserunners a pitcher prevented from scoring.',
      formula: 'LOB% = (H + BB + HBP − R) ÷ (H + BB + HBP − 1.4×HR)',
      body: `
        <p>League average is about <strong>72%</strong>, and individual pitchers
        vary far less than you'd expect. A pitcher stranding 85% of runners is
        almost certainly running hot, and his ERA will rise; one at 60% is
        pitching better than his ERA suggests.</p>
        <p>Along with BABIP, strand rate is the main reason ERA and FIP diverge.
        Check both before believing a surprising ERA.</p>`,
      inputs: [
        { key: 'H', label: 'Hits allowed', def: 152 },
        { key: 'BB', label: 'Walks', def: 46 },
        { key: 'HBP', label: 'Hit batsmen', def: 5 },
        { key: 'R', label: 'Runs allowed', def: 48 },
        { key: 'HR', label: 'Home runs allowed', def: 10 },
      ],
      compute: F.lobPct,
      format: 'pct1',
      benchmarks: [[80, 'Running hot — expect regression'], [74, 'Above average'], [72, 'League normal'], [65, 'Unlucky']],
    },
  ],
};

export const DIPS = {
  id: 'dips',
  title: 'Defence-Independent Pitching',
  blurb: 'The 1999 discovery that broke pitching analysis open, and the stats built from it.',
  intro: `
    <p>In 1999 an amateur analyst named <strong>Voros McCracken</strong> posted a
    finding that professional baseball initially refused to believe: pitchers
    have <em>remarkably little control</em> over whether a ball put in play
    becomes a hit.</p>
    <p>Strikeout rates are stable year to year. Walk rates are stable. Home run
    rates are fairly stable. But BABIP allowed bounces around almost randomly for
    the same pitcher, season to season — because once the ball is in play, the
    outcome belongs mostly to the fielders, the park, and luck.</p>
    <p>The conclusion: to judge a pitcher, look only at the outcomes no fielder
    can influence — <strong>strikeouts, walks, and home runs</strong>. That idea
    is called <strong>DIPS</strong>, and every stat in this module descends from it.</p>`,
  stats: [
    {
      id: 'fip',
      dist: { group: 'pitching' },
      scatter: {
        title: 'Does FIP track ERA in real life?',
        group: 'pitching',
        min: { field: 'outs', value: 150 },
        note: 'Every pitcher with 50+ innings this season. Points far off the line are the ones whose results and peripherals disagree — usually because of an extreme BABIP or strand rate.',
        x: { label: 'FIP (computed here)', format: 'era', fn: (r, c) => F.fip(r, c.cFIP ?? 3.15) },
        y: { label: 'Actual ERA', format: 'era', fn: (r) => F.era(r) },
      },
      abbr: 'FIP',
      name: 'Fielding Independent Pitching',
      short: 'What a pitcher\'s ERA would be if he had league-average luck and defence.',
      formula: 'FIP = (13×HR + 3×(BB+HBP) − 2×K) ÷ IP + constant',
      body: `
        <p>The coefficients are the linear-weight run values of each event,
        simplified: a home run costs about 13 times as much as… well, the units
        cancel out into an ERA scale. The constant (around 3.15) is chosen each
        season so that league FIP equals league ERA — it exists purely to put FIP
        on a familiar scale.</p>
        <p>FIP predicts a pitcher's <em>next</em> season ERA better than his
        current ERA does. When ERA and FIP diverge sharply, bet on FIP.</p>`,
      gotcha: `FIP assumes league-average results on balls in play. A genuine
        soft-contact specialist, or a pitcher in front of an elite defence, can
        legitimately beat his FIP year after year. Treat a large gap as a
        question to investigate, not an automatic verdict.`,
      inputs: [
        { key: 'HR', label: 'Home runs allowed', def: 10 },
        { key: 'BB', label: 'Walks', def: 46 },
        { key: 'HBP', label: 'Hit batsmen', def: 5 },
        { key: 'K', label: 'Strikeouts', def: 269 },
        { key: 'IP', label: 'Innings pitched', def: 217, step: 0.1 },
      ],
      compute: (v, ctx) => F.fip(v, ctx?.cFIP ?? 3.15),
      format: 'era',
      scale: 'fip',
      lowerIsBetter: true,
      benchmarks: [[2.90, 'Elite'], [3.50, 'Great'], [4.15, 'Average'], [4.90, 'Poor']],
    },
    {
      id: 'xfip',
      dist: {
        group: 'pitching', join: 'statcastPitch', format: 'era', lowerIsBetter: true,
        min: { field: 'outs', value: 120 },
        valueFn: (r, c) => F.xfip({ FB: r.FBLD * 0.62, BB: r.BB, HBP: r.HBP, K: r.K, IP: r.IP }, c.lgHrFb ?? 0.13, c.cFIP ?? 3.15),
        note: 'MLB does not publish fly balls separately, so fly balls are estimated as 62% of Savant\'s combined fly-ball-plus-line-drive count. Treat the shape as exact and individual values as close approximations.',
      },
      abbr: 'xFIP',
      name: 'Expected Fielding Independent Pitching',
      short: 'FIP, but with home runs normalised to a league-average rate.',
      formula: 'xFIP = (13×(FB × lgHR/FB) + 3×(BB+HBP) − 2×K) ÷ IP + constant',
      body: `
        <p>Home run totals are surprisingly noisy. Whether a fly ball clears the
        fence depends on a few feet, the wind and the park — and a pitcher's
        HR-per-fly-ball rate swings wildly year to year around the league norm of
        about 13%.</p>
        <p>xFIP replaces actual home runs allowed with the number he "should"
        have allowed given his fly ball count. For most pitchers this is the
        better forecast; for genuine extreme cases — a real home-run suppressor,
        or someone pitching half his games in Coors — it overcorrects.</p>`,
      inputs: [
        { key: 'FB', label: 'Fly balls allowed', def: 180 },
        { key: 'BB', label: 'Walks', def: 46 },
        { key: 'HBP', label: 'Hit batsmen', def: 5 },
        { key: 'K', label: 'Strikeouts', def: 269 },
        { key: 'IP', label: 'Innings pitched', def: 217, step: 0.1 },
      ],
      compute: (v, ctx) => F.xfip(v, ctx?.lgHrFb ?? 0.13, ctx?.cFIP ?? 3.15),
      format: 'era',
      scale: 'fip',
      lowerIsBetter: true,
    },
    {
      id: 'siera',
      dist: {
        group: 'pitching', join: 'statcastPitch', format: 'era', lowerIsBetter: true,
        min: { field: 'outs', value: 120 },
        valueFn: (r) => F.siera({ K: r.K, BB: r.BB, GB: r.GB, FB: r.FBLD, LD: 0, BF: r.BF }),
        note: 'SIERA needs the net ground-ball rate, which is exactly what Savant\'s ground-ball and fly-ball/line-drive counts give us — so this is computed properly, not approximated.',
      },
      abbr: 'SIERA',
      name: 'Skill-Interactive ERA',
      short: 'The most sophisticated ERA estimator — adds batted-ball types and interaction terms.',
      formula: 'A regression on K%, BB%, and net ground ball rate, with squared and interaction terms',
      body: `
        <p>SIERA accepts DIPS but argues it goes too far. Two refinements:</p>
        <ul>
          <li><strong>Ground balls matter.</strong> They rarely become extra-base
          hits and often become double plays, so a heavy ground-ball pitcher
          genuinely suppresses runs beyond what FIP sees.</li>
          <li><strong>The effects interact.</strong> Walks hurt a high-strikeout
          pitcher less, because he is more likely to escape the inning himself.
          The squared and cross terms in the formula capture this.</li>
        </ul>
        <p>SIERA is marginally the best ERA predictor of the public estimators,
        at the cost of being impossible to compute mentally.</p>`,
      inputs: [
        { key: 'K', label: 'Strikeouts', def: 269 },
        { key: 'BB', label: 'Walks', def: 46 },
        { key: 'GB', label: 'Ground balls', def: 250 },
        { key: 'FB', label: 'Fly balls', def: 180 },
        { key: 'LD', label: 'Line drives', def: 110 },
        { key: 'BF', label: 'Batters faced', def: 835 },
      ],
      compute: F.siera,
      format: 'era',
      scale: 'fip',
      lowerIsBetter: true,
    },
    {
      id: 'kwera',
      dist: { group: 'pitching' },
      abbr: 'kwERA',
      name: 'Strikeout-Walk ERA',
      short: 'The simplest useful estimator — strikeouts and walks only.',
      formula: 'kwERA = 5.40 − 12 × ((K − BB) ÷ BF)',
      body: `
        <p>Strips DIPS to its bones by dropping home runs entirely, on the
        grounds that HR rate is the least stable of the three. Remarkably
        competitive with far more complex estimators, and you can compute it on
        a napkin.</p>`,
      inputs: [
        { key: 'K', label: 'Strikeouts', def: 269 },
        { key: 'BB', label: 'Walks', def: 46 },
        { key: 'BF', label: 'Batters faced', def: 835 },
      ],
      compute: F.kwEra,
      format: 'era',
      lowerIsBetter: true,
    },
    {
      id: 'battedball',
      dist: {
        group: 'pitching', join: 'statcastPitch', format: 'pct1', label: 'GB%',
        min: { field: 'outs', value: 120 },
        valueFn: (r) => (r.GB + r.FBLD > 0 ? (r.GB / (r.GB + r.FBLD)) * 100 : null),
        note: 'Ground balls as a share of all batted balls, from Statcast tracking. The spread here is the single biggest stylistic difference between pitchers.',
      },
      abbr: 'GB% / FB% / LD%',
      name: 'Batted Ball Profile',
      short: 'What kinds of contact a pitcher allows — or a hitter produces.',
      formula: 'Each type ÷ total balls in play × 100',
      body: `
        <p>Typical league splits: about <strong>44% ground balls, 35% fly balls,
        21% line drives</strong>.</p>
        <p>Expected outcomes differ enormously. Line drives produce a BABIP
        around <strong>.680</strong>; ground balls about <strong>.240</strong>;
        fly balls about <strong>.130</strong> — but fly balls are the only ones
        that leave the park.</p>
        <p>This creates the fundamental pitching trade-off: ground-ball pitchers
        allow more hits but fewer home runs; fly-ball pitchers the reverse.
        Neither is inherently better, and the right choice depends on the park
        and the defence behind you.</p>`,
    },
    {
      id: 'cfip',
      dist: {
        group: 'team', format: 'two', label: 'cFIP',
        valueFn: (r) => F.fipConstant({ ER: r.ER, IP: r.IP, HR: r.hrAgainst, BB: r.bbAgainst, HBP: r.hbpAgainst, K: r.kAgainst }),
        note: 'The constant is normally one league-wide number. Here it is derived separately for each of the 30 clubs, which shows how much the adjustment varies with the staff you happen to have.',
      },
      abbr: 'cFIP',
      name: 'The FIP Constant (derived live)',
      short: 'How the FIP constant is actually calculated — from real league totals.',
      formula: 'cFIP = league ERA − (13×lgHR + 3×(lgBB+lgHBP) − 2×lgK) ÷ lgIP',
      body: `
        <p>The "constant" in FIP isn't arbitrary. Each season you compute what
        the raw FIP formula returns for the entire league, then add whatever it
        takes to make that equal the actual league ERA.</p>
        <p>This site calculates it <strong>live</strong>: it fetches all 30
        teams' pitching totals from the MLB API, sums them, and derives the
        current constant. Open the Live Data page to see the real number for this
        season rather than a hardcoded guess.</p>`,
      widget: 'fipConstantLive',
    },
  ],
};
