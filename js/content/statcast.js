/*
 * statcast.js — Module 9: the tracking era.
 *
 * Everything before this module infers what happened from outcomes. Statcast
 * measures the physical event itself — how hard, at what angle, how fast the
 * fielder ran. This is a genuinely different kind of data.
 */

export const STATCAST = {
  id: 'statcast',
  title: 'Statcast: Measuring the Process',
  blurb: 'Since 2015, every pitch and batted ball is tracked. This is what that unlocked.',
  intro: `
    <p>Every stat so far measures <strong>outcomes</strong>. Did the ball fall in?
    Did the run score? Outcomes are what matter, but they are noisy — a scorched
    line drive caught at the wall and a bloop single count identically in the box
    score, and only one of them tells you about the hitter.</p>
    <p>Statcast — radar and high-speed camera tracking installed in every MLB
    park since 2015 — measures the <strong>process</strong> instead: exactly how
    hard the ball was hit, at what angle, how fast the fielder ran, how much the
    pitch spun.</p>
    <p>Because process stabilises much faster than outcome, these numbers tell
    you what a player is doing long before the results show it.</p>`,
  stats: [
    {
      id: 'ev',
      dist: { source: 'statcast', field: 'avgEV' },
      abbr: 'EV',
      name: 'Exit Velocity',
      short: 'How fast the ball leaves the bat, in mph.',
      formula: 'Measured directly by radar',
      body: `
        <p>League average exit velocity is about <strong>88–89 mph</strong>. Elite
        hitters average 93+; the hardest-hit balls on record exceed 122 mph.</p>
        <p><strong>Average EV alone is a weak stat</strong> — it includes weak
        defensive contact and mis-hits, which drag it down for aggressive
        hitters. Better versions: <strong>EV50</strong> (average of the hardest
        half of batted balls) and <strong>Hard Hit %</strong>.</p>`,
      scale: 'ev',
      benchmarks: [[93, 'Elite'], [90.5, 'Above average'], [88.5, 'Average'], [86, 'Weak']],
    },
    {
      id: 'la',
      dist: { source: 'statcast', field: 'avgLaunchAngle' },
      abbr: 'LA',
      name: 'Launch Angle',
      short: 'The vertical angle the ball leaves the bat, in degrees.',
      formula: 'Measured directly',
      body: `
        <p>The rough taxonomy:</p>
        <ul>
          <li>Below 10° — ground ball</li>
          <li>10° to 25° — line drive (the <strong>sweet spot</strong>)</li>
          <li>25° to 50° — fly ball</li>
          <li>Above 50° — pop up, an almost automatic out</li>
        </ul>
        <p>Home runs cluster tightly between <strong>25° and 30°</strong> when
        struck at high speed. The "launch angle revolution" of the late 2010s was
        hitters deliberately swinging with a slight uppercut to move ground balls
        into that band — and it is the direct cause of the modern
        home-run-and-strikeout game.</p>
        <p><strong>Sweet Spot %</strong> is the share of batted balls in the
        8°–32° window. League average is about 33%.</p>`,
    },
    {
      id: 'barrel',
      dist: { source: 'statcast', field: 'barrelPctPA' },
      abbr: 'Barrel',
      name: 'Barrel Rate',
      short: 'The perfect combination of exit velocity and launch angle.',
      formula: 'EV ≥ 98 mph with a launch angle in the range that historically produces ≥ .500 AVG and ≥ 1.500 SLG',
      body: `
        <p>A "barrel" is defined by outcome, working backwards: Statcast found the
        combinations of speed and angle that historically produce at least a .500
        batting average and 1.500 slugging, and named that zone the barrel.</p>
        <p>The window starts at 98 mph and 26–30°, and widens as exit velocity
        increases — hit it hard enough and a wider range of angles still works.</p>
        <p>Barrel rate is one of the best predictors of power going forward, and
        it stabilises much faster than home run totals.</p>`,
      scale: 'barrel',
      benchmarks: [[13, 'Elite'], [9, 'Above average'], [6.5, 'Average'], [4, 'Poor']],
    },
    {
      id: 'hardhit',
      dist: { source: 'statcast', field: 'hardHitPct' },
      abbr: 'HardHit%',
      name: 'Hard Hit Rate',
      short: 'Share of batted balls hit at 95 mph or harder.',
      formula: 'Hard Hit % = (batted balls ≥ 95 mph) ÷ total batted balls × 100',
      body: `
        <p>The 95 mph threshold is where batted ball outcomes improve sharply.
        League average is around <strong>40%</strong>; elite hitters exceed 50%.</p>
        <p>More stable than exit velocity average and easier to interpret than
        barrel rate. A good first stop when you want to know whether a hot streak
        is real.</p>`,
      benchmarks: [[50, 'Elite'], [44, 'Above average'], [40, 'Average'], [33, 'Weak']],
    },
    {
      id: 'xstats',
      dist: { source: 'expected', field: 'xwoba', minPA: 100 },
      abbr: 'xBA / xSLG / xwOBA',
      name: 'Expected Statistics',
      short: 'What the contact quality deserved, independent of where fielders were standing.',
      formula: 'For each batted ball, look up the historical outcome rate for its exit velocity and launch angle, then average',
      body: `
        <p>The idea is elegant. Take every batted ball a hitter produced. For
        each, ask the historical database: across all batted balls hit at this
        speed and this angle, what fraction became hits? What was the average
        slugging?</p>
        <p>Sum those probabilities and you get <strong>expected</strong> stats
        that ignore where fielders happened to be standing and how the wind was
        blowing. Strikeouts and walks are included in xwOBA, since those aren't
        batted balls at all.</p>
        <p>The gap between actual and expected is the single most useful
        "regression alert" in modern analysis. A hitter with a .250 AVG and a
        .295 xBA has been genuinely unlucky.</p>`,
      gotcha: `Expected stats do NOT account for sprint speed. A very fast hitter
        legitimately beats his xBA year after year by outrunning ground balls,
        and a plodding slugger legitimately underperforms his.`,
    },
    {
      id: 'xera',
      dist: { source: 'expectedPitcher', field: 'xera', format: 'era', lowerIsBetter: true, label: 'xERA' },
      abbr: 'xERA',
      name: 'Expected ERA',
      short: 'The pitching version — ERA implied by the quality of contact allowed.',
      formula: 'Derived from xwOBA allowed, converted to an ERA scale',
      body: `
        <p>Where FIP ignores balls in play entirely, xERA uses the tracking data
        to judge <em>how well struck</em> those balls were. This is a meaningful
        upgrade: a pitcher who genuinely induces weak contact gets credit that
        FIP refuses him.</p>
        <p>Use both. FIP tells you about the outcomes he fully controls; xERA
        adds what the contact quality suggests.</p>`,
    },
    {
      id: 'sprint',
      dist: { source: 'speed', field: 'sprintSpeed', minRuns: 10 },
      abbr: 'Sprint Speed',
      name: 'Sprint Speed',
      short: 'Feet per second in the fastest one-second window of a maximum-effort run.',
      formula: 'Measured directly; averaged over "competitive" runs only',
      body: `
        <p>League average is <strong>27 ft/s</strong>. Elite is 30+; the fastest
        players reach about 31. Below 25 is genuinely slow.</p>
        <p>Only "competitive" runs count — a home run trot or a jog to first on a
        walk would ruin the average, so those are excluded.</p>
        <p>A <strong>Bolt</strong> is any run at 30 ft/s or faster. Counting bolts
        gives you top-end speed rather than average speed.</p>`,
      scale: 'speed',
      benchmarks: [[29.5, 'Elite'], [28, 'Above average'], [27, 'Average'], [25.5, 'Slow']],
    },
    {
      id: 'spin',
      dist: { source: 'activeSpin', field: 'fourseam', format: 'one', label: 'Active spin, 4-seam (%)' },
      abbr: 'Spin Rate',
      name: 'Spin Rate and Active Spin',
      short: 'How fast the pitch rotates, in RPM — and how much of that spin actually moves it.',
      formula: 'Measured directly',
      body: `
        <p>Typical fastball spin is about <strong>2,300 rpm</strong>; elite
        exceeds 2,600. High spin on a four-seamer creates more backspin lift, so
        the pitch drops less than the hitter expects — the "rising fastball"
        illusion.</p>
        <p><strong>Active spin</strong> is the crucial refinement: only spin
        perpendicular to the direction of travel actually moves the ball.
        Gyroscopic spin — like a bullet — contributes nothing. Two pitchers with
        identical spin rates can get very different movement.</p>
        <p>Spin rate became famous in 2021 when MLB began enforcing rules against
        grip-enhancing substances, and league-wide spin dropped visibly overnight.</p>`,
    },
    {
      id: 'stuffplus',
      dist: {
        source: 'pitchTracking', field: 'whiffPerSwing', format: 'one', label: 'Whiff% per swing',
        note: 'Stuff+ is a proprietary model with no public feed. Whiff rate per swing is the openly published measurement it is built to predict, so this is the closest honest stand-in.',
      },
      abbr: 'Stuff+ / Location+ / Pitching+',
      name: 'The Pitch Quality Models',
      short: 'Grading each pitch on its physical characteristics alone. 100 = average.',
      formula: 'Model output scaled so 100 = league average',
      body: `
        <ul>
          <li><strong>Stuff+</strong> — judges velocity, movement, spin axis and
          release point, <em>ignoring where the pitch went</em>. Pure physical
          nastiness.</li>
          <li><strong>Location+</strong> — judges command: was the pitch in a
          good spot for that count and batter?</li>
          <li><strong>Pitching+</strong> — the two combined.</li>
        </ul>
        <p>These stabilise extraordinarily fast — a few starts, because you get
        90+ observations per game rather than one. That makes them the best early
        signal that a pitcher has genuinely changed something.</p>`,
      benchmarks: [[130, 'Elite'], [110, 'Above average'], [100, 'Average'], [85, 'Poor']],
    },
    {
      id: 'batspeed',
      dist: { source: 'batTracking', field: 'batSpeed', format: 'one', label: 'Bat speed (mph)' },
      abbr: 'Bat Speed / Swing Length',
      name: 'Bat Tracking (2024+)',
      short: 'The newest frontier: measuring the swing itself.',
      formula: 'Measured directly at the sweet spot of the bat',
      body: `
        <p>Added publicly in 2024. Average bat speed is about <strong>71
        mph</strong>; elite exceeds 75.</p>
        <p><strong>Swing length</strong> measures the path travelled in feet — a
        long swing generates speed but costs adjustability. <strong>Squared-up
        rate</strong> measures how much of the possible exit velocity was
        actually achieved, and <strong>Blast rate</strong> combines fast and
        squared-up.</p>
        <p>This finally quantifies the oldest trade-off in hitting: bat speed
        versus bat control.</p>`,
    },
    {
      id: 'arm',
      dist: { source: 'arm', field: 'maxArm', format: 'one', label: 'Max arm strength (mph)' },
      abbr: 'Arm Strength / Pop Time',
      name: 'Throwing Measurements',
      short: 'How hard fielders throw, and how fast catchers release.',
      formula: 'Measured directly',
      body: `
        <p><strong>Arm strength</strong> — maximum throw velocity. Elite
        outfielders exceed 95 mph; the record is above 105.</p>
        <p><strong>Pop time</strong> — for catchers, glove-to-glove time on a
        throw to second base. Elite is under 1.90 seconds, average about 2.00.
        It decomposes into <em>exchange time</em> and <em>arm strength</em>,
        and the exchange usually matters more.</p>`,
    },
  ],
};
