# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.0] - 2026-08-11

### Changed
- **Visual redesign: 1950s baseball annual.** The previous pass was clean to the
  point of clinical — one flat neutral, an identical black header on every panel,
  no colour, no texture, no ornament. Uniformity is what reads as machine-made.
  - Cream stock with an SVG grain texture over every surface (screen-blended in
    dark mode so it still reads as texture rather than dirt).
  - Two spot inks — scorecard red and outfield green — over warm black `#231d15`.
  - A proper nameplate: drawn baseball with stitching, display-serif wordmark,
    standfirst, double rule.
  - Stitch rules (hairlines with slanted red dashes) dividing major sections.
  - Drop caps opening each lesson; pull-quote treatment for key ideas.
  - Larger, more confident numerals; headline sizes that jump rather than step;
    module numbers set as large display figures.

### Added
- `scripts/check-css.py` — brace balance, undefined `var()` references,
  malformed colour values, and coverage of every class the JavaScript emits.
  Verified by deliberately breaking a variable and confirming it is caught.

## [1.3.1] - 2026-08-11

### Fixed
- **Every "all players" request was silently returning only qualified players.**
  `leaders({ qualified: false })` omitted the `playerPool` parameter entirely,
  and MLB's default for that parameter is `QUALIFIED` — so the app received 142
  hitters instead of 696, and 60 pitchers instead of 794. Symptoms: team views
  showed ~5 hitters per club, player search could not find anyone outside the
  qualified pool, and every curve was drawn from a needlessly thin population.
- URL building moved into an exported `leadersUrl()` so it can be tested without
  a network call, with five checks asserting the pool is always stated.
- `check-live-pipeline.py` now asks `api.js` to build its request URLs instead of
  hand-writing them. Writing them separately is precisely why this bug survived
  verification: the script requested the full pool while the app did not.
- Response cache is now versioned (`bsl:v2:`), so the stale short responses are
  discarded rather than served for another six hours. Old-version entries are
  cleared on load.

## [1.3.0] - 2026-08-11

### Added
- **Tier system** (`js/tiers.js`). Six percentile bands — Elite, Great, Above
  average, Average, Below average, Poor — computed from this season's live
  players rather than fixed thresholds, so they never go stale.
  - Shaded tier regions behind every histogram, with labels.
  - A tier legend under each curve giving every band's range in that stat's units.
  - A percentile column and a tier badge on every leaderboard row.
- **Player search on every stat page.** Replaces the dropdown. Type any name and
  pick from live results; the search covers every player with a stat line, not
  just qualifiers (unqualified players are shown and flagged).
- **Player card**: name, club, position, raw line, value, rank, percentile and
  tier. The player's real numbers load into the calculator, so you can then edit
  them and watch the marker move — the card says when you have done so.
- **Team views** (`js/team.js`, route `#/team/:id`). Every hitter and pitcher on
  a club across 13 hitting and 11 pitching columns, each cell coloured by that
  player's percentile against the whole league.
- Leaderboard filters by **club** and by **tier**, alongside the name filter.
  Selecting a club or tier lifts the 100-row cap so the whole group is visible.
- `teamList()` in api.js; `allRows` on every population so search can reach
  players below the playing-time floor.
- 14 new tests covering the tier logic, including the lower-is-better flip.

## [1.2.0] - 2026-08-11

### Added
- **A league curve for every statistic.** Coverage went from 41 stats to 86 of
  93. The seven without one have no public per-player feed and now say so on the
  page, with an explanation, instead of being silently omitted.
- **Player picker on every stat page.** Choose any player and he is pinned to the
  curve with his rank and percentile. Where the stat has a calculator, his real
  season line is loaded into the inputs, so the numbers that produce the value are
  visible — not just the value.
- Clicking any row in the top-100 table also pins that player to the curve.
- Five new Baseball Savant sources: pitcher expected stats (xERA), pitcher
  batted-ball splits, arm strength, catcher pop time, bat tracking and active spin.
- Cross-source joins: SIERA, xFIP and batted-ball profiles now merge MLB counting
  stats with Savant ground-ball/fly-ball counts by player id.
- Team-level populations for Pythagorean wins, PythagenPat, run differential,
  runs per win, DER, BaseRuns and per-club FIP constants.
- `speedScore()` (Bill James Speed Score) and `baseRuns()` in formulas.js.
- Live offensive WAR and pitcher WAR distributions.
- `check-live-pipeline.py` extended to exercise the Savant join, team level and
  BaseRuns accuracy; now sends a User-Agent, which Savant requires.

### Removed
- **The quiz**, entirely — all 44 questions, the quiz engine, the mixed-quiz
  route, progress tracking and the associated styling.

### Fixed
- Speed Score's triples component was scaled wrong by a factor of 100, pulling
  every score down. Caught by the live pipeline check.

## [1.1.0] - 2026-08-11

### Added
- **League distribution charts.** Every stat page now shows a histogram of that
  statistic across every qualifying major leaguer this season, with a smoothed
  curve, 10th/median/90th percentile guides, and a live marker tracking the
  calculator value and its percentile.
- **Sortable top-100 leaderboards** on every stat page — click any column to
  re-sort, filter by player or club, with inline data bars and a sticky header.
- **Percentile ladder** table per stat (1st through 99th) plus league median,
  mean, standard deviation and range.
- Four **scatter plots** with Pearson correlation: FIP vs ERA, BABIP vs AVG,
  OPS vs wOBA, and K% vs wOBA.
- `js/charts.js` — dependency-free SVG histogram, scatter, percentile bar and
  data bar rendering.
- `js/population.js` — builds a league-wide population for any stat by running
  its own `compute()` over live MLB data.
- `js/leaderboard.js` — the sortable, filterable table component.
- Pitching leaderboard on the Live Data page, with an ERA-minus-FIP gap column.
- `scripts/check-live-pipeline.py` — fetches real MLB data and verifies every
  computed league median falls inside a plausible band.

### Changed
- **Complete visual redesign** from a generic card-and-pill layout to a printed
  statistical annual: square corners, hairline rules, no drop shadows, serif
  body text, monospace numerals, dense zebra-striped tables, newsprint palette.
- Emoji removed; the masthead mark is now a drawn SVG.
- Statcast lessons moved from one-off "live leaderboard" panels to the same
  distribution + top-100 treatment as every other stat.

### Fixed
- `pythagoreanWins` received the render context as its exponent argument, so the
  Pythagorean calculator returned blank. Wrapped, and the smoke test now catches
  this class of bug for every calculator.
- Strikeout rate is now correctly flagged as lower-is-better, so its percentile
  and leaderboard sort in the right direction.

## [1.0.0] - 2026-08-11

### Added
- Twelve-module interactive course covering 93 lessons and 150+ individual statistics.
- 49 live calculators, generated automatically from each stat's declared inputs.
- 44 quiz questions attached to lessons, plus a shuffled mixed quiz drawn from the whole course.
- Interactive widgets: run expectancy matrix, linear weights explorer, RE24 play pricer,
  park factor table, positional adjustment table, stabilisation table, live FIP constant.
- Stat Sandbox — slider-driven explorer showing every rate stat respond at once,
  loadable with any current-season hitter.
- Live data layer reading the MLB Stats API and Baseball Savant directly from the
  browser, with in-memory and localStorage caching.
- Live wRC+ leaderboard computed in-browser from raw counting stats using league
  context derived by summing all thirty teams' totals.
- A–Z glossary, full-text search with `/` shortcut, light and dark themes,
  responsive layout, and hash-based routing so every lesson has a shareable URL.
- Formula test suite (69 checks) verified against real published seasons.
- Content smoke test verifying curriculum integrity and that every calculator
  returns a finite result from its own defaults.
