#!/usr/bin/env python3
"""
run-tests.py — run the formula tests from the command line.

WHY THIS EXISTS
tests.html runs the same checks in a browser, which is the friendly way to use
them. But it is useful to also run them from a terminal (and from CI) without
installing Node.js. macOS ships a JavaScript engine inside `osascript`, so this
script:

  1. reads js/constants.js and js/formulas.js
  2. strips the ES module `import`/`export` keywords, which that engine
     does not support, and concatenates the files
  3. appends the assertions from scripts/assertions.js
  4. runs the result and reports pass/fail

Usage:  python3 scripts/run-tests.py
Exit code is 0 if everything passed, 1 otherwise — so CI can use it directly.
"""

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def strip_modules(source: str) -> str:
    """Remove import statements and the `export` keyword."""
    source = re.sub(r'^\s*import\s+.*?;\s*$', '', source, flags=re.MULTILINE | re.DOTALL)
    source = re.sub(r'^\s*export\s+\{[^}]*\};?\s*$', '', source, flags=re.MULTILINE)
    source = re.sub(r'^(\s*)export\s+', r'\1', source, flags=re.MULTILINE)
    return source


def main() -> int:
    parts = [
        strip_modules((ROOT / 'js' / 'constants.js').read_text()),
        strip_modules((ROOT / 'js' / 'formulas.js').read_text()),
        strip_modules((ROOT / 'js' / 'tiers.js').read_text()),
        strip_modules((ROOT / 'js' / 'api.js').read_text()),
        strip_modules((ROOT / 'js' / 'charts.js').read_text()),
        (ROOT / 'scripts' / 'assertions.js').read_text(),
    ]
    bundle = '\n'.join(parts)

    tmp = ROOT / 'scripts' / '.bundle.tmp.js'
    tmp.write_text(bundle)
    try:
        result = subprocess.run(
            ['osascript', '-l', 'JavaScript', str(tmp)],
            capture_output=True, text=True, timeout=60,
        )
    finally:
        tmp.unlink(missing_ok=True)

    output = (result.stdout or '') + (result.stderr or '')
    print(output.strip())
    return 0 if 'FAILED: 0' in output else 1


if __name__ == '__main__':
    sys.exit(main())
