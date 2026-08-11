#!/usr/bin/env python3
"""
smoke-test.py — check the curriculum actually assembles and every calculator runs.

The formula tests (run-tests.py) prove the maths is right. This proves the
*content* is wired up correctly: that every lesson has the fields the renderer
expects, that no two stats collide on the same URL, and — most usefully — that
every calculator produces a real number when fed its own default values.

That last check catches the most common content bug: a stat whose `inputs` list
is missing a key its `compute` function needs, which would show "—" on the page
instead of an answer.

Usage:  python3 scripts/smoke-test.py
"""

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ['hitting.js', 'runs.js', 'pitching.js', 'defense.js', 'statcast.js', 'value.js']


def strip_modules(src: str) -> str:
    src = re.sub(r'^\s*import\s+.*?;\s*$', '', src, flags=re.MULTILINE | re.DOTALL)
    src = re.sub(r'^\s*export\s+\{[^}]*\};?\s*$', '', src, flags=re.MULTILINE)
    src = re.sub(r'^(\s*)export\s+', r'\1', src, flags=re.MULTILINE)
    return src


def exported_names(src: str):
    """Find every name formulas.js exports, so we can rebuild the `F` namespace."""
    names = re.findall(r'^export\s+(?:const|function|let|var)\s+([A-Za-z_$][\w$]*)', src, flags=re.MULTILINE)
    return sorted(set(names))


def main() -> int:
    formulas_src = (ROOT / 'js' / 'formulas.js').read_text()
    names = exported_names(formulas_src)

    parts = [
        strip_modules((ROOT / 'js' / 'constants.js').read_text()),
        strip_modules(formulas_src),
        # Content files call formulas as F.avg(...); rebuild that namespace.
        'var F = {' + ', '.join(f'{n}: {n}' for n in names) + '};',
    ]
    for name in CONTENT:
        parts.append(strip_modules((ROOT / 'js' / 'content' / name).read_text()))

    parts.append(RUNNER)
    bundle = '\n'.join(parts)

    tmp = ROOT / 'scripts' / '.smoke.tmp.js'
    tmp.write_text(bundle)
    try:
        res = subprocess.run(['osascript', '-l', 'JavaScript', str(tmp)],
                             capture_output=True, text=True, timeout=90)
    finally:
        tmp.unlink(missing_ok=True)

    out = (res.stdout or '') + (res.stderr or '')
    print(out.strip())
    return 0 if 'PROBLEMS: 0' in out else 1


RUNNER = r"""
var MODULES = [COUNTING, RATE, RUNS, CONTEXT, PITCHING, DIPS, FIELDING, BASERUNNING, STATCAST, WAR, WINPROB, TEAM];

var problems = [];
var paths = {};
var stats = 0, calcs = 0, dists = 0, noDists = 0, widgets = 0;

var ctx = { season: 2023, lgwOBA: 0.318, lgOBP: 0.318, lgSLG: 0.408, lgRperPA: 0.12, cFIP: 3.15, lgHrFb: 0.13 };

for (var m = 0; m < MODULES.length; m++) {
  var mod = MODULES[m];
  if (!mod || !mod.id) { problems.push('module ' + m + ' has no id'); continue; }
  if (!mod.title) problems.push(mod.id + ': missing title');
  if (!mod.stats || !mod.stats.length) { problems.push(mod.id + ': no stats'); continue; }

  for (var s = 0; s < mod.stats.length; s++) {
    var st = mod.stats[s];
    stats++;
    var path = mod.id + '/' + st.id;

    if (!st.id) problems.push(path + ': missing id');
    if (!st.abbr) problems.push(path + ': missing abbr');
    if (!st.name) problems.push(path + ': missing name');
    if (!st.short) problems.push(path + ': missing short summary');
    if (paths[path]) problems.push('DUPLICATE path: ' + path);
    paths[path] = true;

    if (st.widget) widgets++;

    // Every stat must be able to show a curve, or say why it cannot.
    if (st.dist) {
      dists++;
      var d = st.dist;
      var shapes = (d.values ? 1 : 0) + (d.source ? 1 : 0) + (d.group ? 1 : 0);
      if (shapes === 0) problems.push(path + ': dist has no values, source or group');
      if (d.values && !d.values.length) problems.push(path + ': dist.values is empty');
      if (!d.field && !d.valueFn && !st.compute && !d.values)
        problems.push(path + ': dist has no way to produce a value (no field, valueFn or compute)');
      if (d.valueFn && typeof d.valueFn !== 'function') problems.push(path + ': dist.valueFn is not a function');
      if (d.join && !d.group) problems.push(path + ': dist.join needs a group to join onto');
      // Fixed-value populations can be exercised right now.
      if (d.values) {
        for (var vi = 0; vi < d.values.length; vi++) {
          var vv = d.values[vi];
          var num = typeof vv === 'number' ? vv : vv.value;
          if (typeof num !== 'number' || !isFinite(num))
            problems.push(path + ': dist.values[' + vi + '] is not a finite number');
        }
      }
    } else if (st.noDist) {
      noDists++;
      if (String(st.noDist).length < 40) problems.push(path + ': noDist reason is too terse to be useful');
    } else {
      problems.push(path + ': has neither a dist nor a noDist explanation');
    }

    if (st.quiz) problems.push(path + ': still has a quiz block');

    // The important one: run each calculator with its own defaults.
    if (st.inputs && st.compute) {
      calcs++;
      var vals = {};
      for (var i = 0; i < st.inputs.length; i++) {
        var inp = st.inputs[i];
        if (inp.def === undefined) problems.push(path + ': input "' + inp.key + '" has no default');
        vals[inp.key] = inp.def;
      }
      var result;
      try { result = st.compute(vals, ctx); }
      catch (e) { problems.push(path + ': compute() threw — ' + e.message); continue; }

      if (result === null || result === undefined)
        problems.push(path + ': compute() returned ' + result + ' with its own defaults');
      else if (typeof result === 'number' && !isFinite(result))
        problems.push(path + ': compute() returned ' + result + ' (not finite)');
    } else if (st.inputs && !st.compute) {
      problems.push(path + ': has inputs but no compute()');
    }
  }
}

var out = 'Baseball Stats Lab - content smoke test\n' +
          '=======================================\n' +
          'Modules:      ' + MODULES.length + '\n' +
          'Statistics:   ' + stats + '\n' +
          'Calculators:  ' + calcs + '\n' +
          'Widgets:      ' + widgets + '\n' +
          'Distributions:' + dists + '\n' +
          'Explained gaps: ' + noDists + '\n' +
          'PROBLEMS: ' + problems.length + '\n';
if (problems.length) out += '\n' + problems.join('\n') + '\n';
out;
"""


if __name__ == '__main__':
    sys.exit(main())
