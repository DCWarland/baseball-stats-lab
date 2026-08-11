#!/usr/bin/env python3
"""
check-css.py — structural checks on the stylesheet.

There is no CSS compiler to catch mistakes, and a single malformed rule can
silently kill every rule after it. This checks the things that actually break:

  1. Balanced braces
  2. Every `var(--x)` refers to a custom property that is defined somewhere
  3. Every class the JavaScript emits has a rule in the stylesheet
  4. No class is styled that nothing ever emits (dead CSS)

Point 3 is the important one — renaming a class in the CSS without renaming it
in the JS produces an unstyled page rather than an error.

Usage:  python3 scripts/check-css.py
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSS = ROOT / 'css' / 'style.css'

# State hooks toggled by JavaScript rather than written into a template.
DYNAMIC = {
    'nav-open', 'active', 'sorted', 'sortable', 'clickable', 'open',
    'hl-tile', 'prev', 'next', 'neg', 'under', 'med', 'accent',
}

# Structural wrappers that deliberately carry no styling of their own — they
# exist to group children or to be targeted by a descendant selector.
KNOWN_UNSTYLED = {
    'home', 'lesson', 'calc', 'hist-bars', 'tier-bands',
}


def strip_comments(css: str) -> str:
    return re.sub(r'/\*.*?\*/', '', css, flags=re.DOTALL)


def main() -> int:
    raw = CSS.read_text()
    css = strip_comments(raw)
    problems = []

    # 1. Braces -------------------------------------------------------------
    opens, closes = css.count('{'), css.count('}')
    if opens != closes:
        problems.append(f'Unbalanced braces: {opens} open, {closes} close')

    # A `@media` may only appear at the top level, never inside a rule body.
    depth = 0
    for i, ch in enumerate(css):
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth < 0:
                problems.append(f'Stray closing brace near character {i}')
                depth = 0
        elif css.startswith('@media', i) and depth > 1:
            problems.append(f'@media nested {depth} levels deep near character {i}')

    # 2. Custom properties --------------------------------------------------
    defined = set(re.findall(r'(--[\w-]+)\s*:', css))
    used = set(re.findall(r'var\(\s*(--[\w-]+)', css))
    missing = sorted(used - defined)
    for m in missing:
        problems.append(f'var({m}) is used but never defined')

    # Catch values that are not valid colours/lengths, e.g. a typo like "#cba busy"
    for prop, value in re.findall(r'(--[\w-]+)\s*:\s*([^;{}]+);', css):
        v = value.strip()
        if v.startswith('#') and not re.fullmatch(r'#[0-9a-fA-F]{3,8}', v):
            problems.append(f'{prop} has a malformed colour value: "{v}"')

    # 3/4. Classes: emitted by JS vs styled in CSS ---------------------------
    js_text = '\n'.join(p.read_text() for p in ROOT.glob('js/**/*.js'))
    js_text += (ROOT / 'index.html').read_text()

    emitted = set()
    for m in re.finditer(r'class="([^"]*)"', js_text):
        # Drop `${...}` template expressions first, then keep only tokens that
        # actually look like class names. Without this the checker "finds"
        # fragments of JavaScript such as `?` and `??`.
        literal = re.sub(r'\$\{[^}]*\}', ' ', m.group(1))
        emitted.update(w for w in literal.split() if re.fullmatch(r'[a-z][a-z0-9-]*', w))
    for m in re.finditer(r"classList\.(?:add|toggle)\('([\w-]+)'", js_text):
        emitted.add(m.group(1))

    styled = set(re.findall(r'\.([a-zA-Z][\w-]*)', css))

    def is_dynamic(name: str) -> bool:
        return (name in DYNAMIC or name in KNOWN_UNSTYLED
                or any(name.startswith(p) for p in ('g-', 't-')))

    unstyled = sorted(c for c in emitted - styled if not is_dynamic(c))
    for c in unstyled:
        problems.append(f'class "{c}" is emitted by the app but has no CSS rule')

    print('CSS structural check')
    print('====================')
    print(f'Rules (approx):     {opens}')
    print(f'Custom properties:  {len(defined)}')
    print(f'Classes styled:     {len(styled)}')
    print(f'Classes emitted:    {len(emitted)}')
    print(f'PROBLEMS: {len(problems)}')
    if problems:
        print()
        for p in problems:
            print(f'  - {p}')
    return 0 if not problems else 1


if __name__ == '__main__':
    sys.exit(main())
