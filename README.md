# Baseball Stats Lab

An interactive reference covering **every baseball statistic** — from batting
average to wRC+, FIP, WAR and Statcast barrel rate. Each stat comes with a live
calculator, the real league distribution showing what actually counts as good, and
a sortable top-100 table of current major leaguers.

No build step. No server. No API keys. It's plain HTML, CSS and JavaScript, so you
can drop it on GitHub Pages and it just works.

---

## What's in it

| | |
|---|---|
| **12 modules** | Ordered so each stat exists to fix a flaw in the one before it |
| **93 lessons** | Covering 150+ individual statistics |
| **49 calculators** | Every stat with a formula gets a live calculator |
| **86 league curves** | The real distribution for that stat across every qualifying MLB player |
| **86 top-100 tables** | Sortable, filterable, computed from live data |
| **Player search** | Look up any major leaguer on any stat — his live line loads into the calculator |
| **Six tier bands** | Elite / Great / Above average / Average / Below average / Poor, shaded onto every curve |
| **30 team views** | Every player on a club, each cell coloured by league percentile |
| **4 scatter plots** | How stats relate to each other, with correlation |
| **8 interactive widgets** | Run expectancy matrix, linear weights, park factors, RE24 pricer |

**Every one of the 93 statistics has a distribution**, except seven that
genuinely have no public per-player feed (catcher framing, Stuff+, WPA,
Leverage Index, Clutch, REW and projection systems). Those seven say so on the
page and explain why, rather than showing an invented curve.

### What a stat page gives you

1. **The explanation** — what it measures, why it exists, what it gets wrong
2. **A calculator** — real season defaults, edit any number
3. **The league curve** — a histogram of every qualifying major leaguer this
   season, with a smoothed curve over it, percentile guides, and a marker
   showing where your value lands
4. **Tier bands** shaded onto the curve — you can see where "elite" starts
   rather than having to infer it, with a legend giving each band's range in
   that stat's own units
5. **Player search** — type any name. His card shows his line, his value, his
   rank, his percentile and his tier; his real numbers load into the calculator
   so you can then change them and see what would have happened
6. **A percentile ladder** — 1st through 99th, so "good" is a number, not a vibe
7. **A leaderboard** with a percentile column and a tier badge on every row,
   sortable by any column, filterable by name, **by club** or **by tier**

The distribution and the leaderboard are not hardcoded. They are produced by
running *the same `compute()` function the lesson just taught you* over every
player in MLB. If the formula is right, the chart is right — they cannot drift
apart.

### The course

1. **The Box Score** — PA, AB, H, TB, RBI, R, BB, SO, SB/CS, GIDP, LOB
2. **Rate Stats** — AVG, OBP, SLG, OPS, ISO, BABIP, BB%, K%, BB/K, AB/HR, qualifying
3. **Linear Weights & Run Estimation** — run expectancy, wOBA, wRAA, wRC, RC, RE24, BaseRuns
4. **Context & Adjustment** — park factors, wRC+, OPS+, ERA−/FIP−, stabilisation
5. **Pitching: Traditional** — IP, ERA, RA9, WHIP, W-L, saves, QS, K/9, K−BB%, LOB%
6. **Defence-Independent Pitching** — FIP, xFIP, SIERA, kwERA, batted-ball profile
7. **Fielding** — FPCT, range factor, DRS, UZR, OAA, framing, pop time, DER
8. **Baserunning** — break-even steal rate, wSB, UBR, BsR, speed score
9. **Statcast** — exit velocity, launch angle, barrels, xBA/xSLG/xwOBA, xERA, sprint speed, spin, Stuff+, bat tracking
10. **WAR** — replacement level, positional adjustment, fWAR/bWAR/WARP, RAR
11. **Win Probability & Leverage** — WE, WPA, LI, Clutch, REW
12. **Team & Season Analysis** — Pythagorean, PythagenPat, run differential, third-order wins, projection systems

---

## Running it locally

The site uses **ES modules** (the modern `import` / `export` system for splitting
JavaScript into files). Browsers refuse to load modules from a `file://` path for
security reasons, so you can't just double-click `index.html` — you need to serve
it over HTTP. Python does this in one command, with no installation:

```bash
cd baseball-stats-lab
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

To stop the server, press `Ctrl+C` in that terminal.

---

## Publishing to GitHub Pages

GitHub Pages hosts static sites for free straight from a repository.

```bash
git init
git add .
git commit -m "Initial commit: Baseball Stats Lab"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/baseball-stats-lab.git
git push -u origin main
```

Then, in the repository on github.com:

1. **Settings** → **Pages**
2. Under *Build and deployment*, set **Source** to `Deploy from a branch`
3. Set **Branch** to `main` and the folder to `/ (root)`
4. **Save**

After a minute or two your site is live at
`https://YOUR-USERNAME.github.io/baseball-stats-lab/`.

No workflow file or build configuration is needed — the repository *is* the website.

---

## Where the data comes from

Two public sources, both of which send the `Access-Control-Allow-Origin: *`
header. That header is a website's way of granting permission for another site's
JavaScript to read its data — without it, browsers block the request. Because both
sources grant it, this site needs no backend of its own.

| Source | Provides |
|---|---|
| [MLB Stats API](https://statsapi.mlb.com) | Raw counting stats, team and league totals, player search |
| [Baseball Savant](https://baseballsavant.mlb.com) | Statcast: exit velocity, barrels, xwOBA, xERA, sprint speed, OAA, arm strength, pop time, bat tracking, active spin, batted-ball splits |

**Neither source publishes wOBA, wRC+, FIP or WAR.** Those are computed in your
browser by `js/formulas.js` from the raw counting stats — which is the entire point
of the project. The *Live Data* page shows a wRC+ leaderboard calculated on the fly
using this season's real league context, derived by summing all thirty teams'
totals.

Some stats need both sources at once. SIERA, xFIP and batted-ball profiles
combine MLB's counting stats (walks, strikeouts, innings) with Savant's ground-ball
and fly-ball counts, merged by player id — that join is what makes them computable
at all.

What is *not* live, and why:
- **Seven statistics have no public per-player feed** — catcher framing, Stuff+,
  WPA, Leverage Index, Clutch, REW and projection systems. Each says so on its own
  page and explains what would be needed. No curve is invented for them.
- **xFIP uses an estimated fly-ball count.** MLB doesn't publish fly balls
  separately, so they're estimated at 62% of Savant's combined fly-ball-plus-
  line-drive figure. The page says so. SIERA, by contrast, needs exactly the
  ground-ball-minus-air-ball figure Savant *does* publish, so it is computed properly.
- **WAR here is offence only** for hitters — batting, position and replacement
  level. Fielding and baserunning runs aren't publicly available, so they're
  omitted rather than guessed. Pitcher WAR is complete.
- **wOBA linear weights** are FanGraphs' published season constants, stored in
  `js/constants.js`. League *averages* are computed live; the weights themselves
  change slowly and are versioned by season.

---

## Testing

Two test suites, neither of which needs Node.js installed. They use the JavaScript
engine that ships with macOS (via `osascript`).

```bash
python3 scripts/run-tests.py           # 88 formula and tier checks against real published seasons
python3 scripts/smoke-test.py          # curriculum integrity + every calculator runs
python3 scripts/check-live-pipeline.py # fetches real MLB data and checks the distributions
python3 scripts/check-css.py           # stylesheet structure and class coverage
```

You can also open <http://localhost:8000/tests.html> in a browser for the same
formula checks with nicer output.

**`run-tests.py`** verifies the maths against real seasons — Bonds 2001, Judge 2022,
deGrom 2018 — so a failure means a formula genuinely drifted, not that a
self-referential check broke.

**`smoke-test.py`** verifies the *content*: no duplicate URLs, every stat has
either a working `dist` or an `noDist` explanation, and — most usefully — that
every calculator returns a finite number when fed its own default values. That
last check catches the most common content bug, where a stat's input list is
missing a key its formula needs.

**`check-live-pipeline.py`** is the closest thing to loading the site without a
browser. It fetches real current-season data from the MLB API, runs it through the
exact `normalise()` and `compute()` path the website uses, and prints the resulting
distribution for each stat — then fails if any league median falls outside the band
baseball says it should occupy. It also exercises the Savant join, the team-level
population and BaseRuns (checking it lands within a few percent of the runs clubs
actually scored). It is what proves the curves and leaderboards are trustworthy.

---

## How the code is organised

```
index.html              the shell — everything else is loaded as modules
tests.html              browser version of the formula tests
css/style.css           all styling, light and dark themes
js/
  constants.js          wOBA weights, run expectancy, park factors, grading scales
  formulas.js           every statistic as a pure function
  api.js                MLB + Savant fetching, with caching and CSV parsing
  charts.js             hand-built SVG: histograms, scatter plots, percentile bars
  tiers.js              percentile bands — the shared "what counts as elite" logic
  population.js         builds the league-wide distribution for any stat
  leaderboard.js        the sortable, filterable leaderboard
  team.js               the club view, every player coloured by league percentile
  render.js             turns a stat object into an interactive page
  quiz.js               quiz engine and progress tracking
  sandbox.js            the "drag a slider, watch everything move" explorer
  app.js                router and shell wiring
  content/              the curriculum — one file per pair of modules
scripts/                command-line test runners
```

### The one idea worth stealing

Every statistic is a **plain data object**:

```js
{
  id: 'obp',
  abbr: 'OBP',
  name: 'On-Base Percentage',
  formula: 'OBP = (H + BB + HBP) ÷ (AB + BB + HBP + SF)',
  body: `<p>...the explanation...</p>`,
  inputs: [ { key: 'H', label: 'Hits', def: 156 }, ... ],
  compute: F.obp,
  format: 'rate3',
  scale: 'obp',
  dist: { group: 'hitting' },   // <- this one line adds the curve, the player
}                               //    picker AND the sortable top 100
```

`dist` supports five shapes, which between them cover every statistic:

```js
{ group: 'hitting' }                     // run compute() over every hitter
{ group: 'hitting', field: 'RBI' }       // read a column straight off the row
{ group: 'pitching', valueFn: fn }       // custom function
{ group: 'pitching', join: 'statcastPitch', valueFn: fn }  // MLB + Savant merged
{ source: 'statcast', field: 'avgEV' }   // a Baseball Savant leaderboard
{ values: [...] }                        // a fixed set (park factors, run expectancy)
```

`render.js` reads that shape and builds the page. It contains no knowledge of any
specific statistic. Adding a new stat to `js/content/` gives you a lesson, a working
calculator, automatic grading, a live league curve, a player picker and a
sortable top-100 table — with **zero** changes to the UI code.

That's the difference between maintaining 93 hand-written pages and maintaining one
renderer.

---

## Tiers: what "good" actually means

Every statistic uses the same six bands, computed from **this season's actual
players** rather than fixed cutoffs:

| Band | Percentile | |
|---|---|---|
| Elite | 95th+ | top 5% of the league |
| Great | 85–95 | top 15% |
| Above average | 60–85 | better than most regulars |
| Average | 40–60 | the middle fifth |
| Below average | 15–40 | bottom 40% |
| Poor | under 15th | bottom 15% |

Percentiles rather than fixed thresholds, because a .300 batting average meant
something different in 1930, 1968 and today. The bands are recomputed from live
data every time you load a page, so "elite" always means the top 5% *right now*.

They appear as shaded regions on every curve, as badges in every leaderboard
row, and as cell colours across the team grid — one colour language for the
whole site.

---

## Team views

`#/team/<id>`, or the **Teams** link in the header. Every hitter and pitcher on a
club, with 13 hitting and 11 pitching columns.

The key detail: each cell is coloured by that player's percentile **against the
whole league**, not against his teammates. A roster of green cells is a good
team, and you can see instantly which positions are carrying it and which are
sinking it. Players below the playing-time floor are shown but not coloured,
because rate stats on tiny samples are noise.

---

## Design

The look is a **1950s baseball annual**, not a web app.

Uniformity is what makes a page read as machine-made, so the design deliberately
breaks it up: headline sizes jump rather than step, panels vary, and there is
ornament that serves no function except pleasure.

- **Cream stock with visible grain** — an SVG turbulence texture at 5% opacity
  over every surface. You feel it more than see it, and it is what stops large
  flat areas looking like a screen.
- **Two spot inks over warm black** — scorecard red and outfield green, as an
  annual would actually have been printed. The ink is `#231d15`, never `#000`.
- **A nameplate**, not a logo bar: drawn baseball with stitching, wordmark in a
  display serif, standfirst beneath, double rule under the whole thing.
- **Stitch rules** between sections — two hairlines with slanted red dashes, the
  seam of a baseball.
- **Drop caps** opening every lesson, and **pull quotes** set large across the
  measure for the key idea.
- **Numerals set confidently** — the calculator result is 2.9rem of monospace in
  red, because the number is the point of the page.

Dark mode inverts the stock rather than restyling it, and flips the grain from
multiply to screen so it still reads as texture.

`scripts/check-css.py` guards the stylesheet: balanced braces, no `var()`
pointing at an undefined property, no malformed colour values, and every class
the JavaScript emits has a matching rule. That last check is the important one —
renaming a class in the CSS but not the JS produces an unstyled page rather than
an error.

---

## Accuracy notes

- WAR here is a **simplified but structurally honest** version of FanGraphs' fWAR.
  Real WAR adds league corrections and daily-updated run environments, so expect to
  land within a few tenths of the published figure, not exactly on it.
- Park factors are multi-year regressed run factors, rounded. Real ones differ
  slightly between sources and by batter handedness.
- Fielding metrics (UZR, DRS) need about three years of data to stabilise. The site
  says so in the lessons, and it's worth repeating here.

---

## Licence

MIT — see [LICENSE](LICENSE).

Statistics data is fetched live from MLB Advanced Media's public endpoints and is
subject to [their terms](http://gdx.mlb.com/components/copyright.txt). This project
is not affiliated with or endorsed by MLB.
