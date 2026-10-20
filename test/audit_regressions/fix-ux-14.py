#!/usr/bin/env python3
"""FIX-UX-14 — the UX lint's comment stripper does not start at an opener named
in an inline code span (0.3.7 release review, iteration 1, UX-14).

docs/ux/lint.py#read strips HTML comments across lines. AGENTS.md names the
opener in prose (`<!--`) and later carries a real comment block; the strip ran
from the prose to that block's close and removed the vision heading between
them, so U033 ("no vision rule block") fired while the rule was in the file.

The fixture holds both shapes: a code-span opener followed by a heading and a
real comment, and a real multi-line comment that must still go.

Standard library only.
"""
import importlib.util
import os
import sys
import tempfile
from pathlib import Path

sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("ux_lint", ROOT / "docs" / "ux" / "lint.py")
lint = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lint)

FIXTURE = """# Working here

Any comment leader works (`//`, `#`, `--`, `/*`, `<!--`). The reference resolves.

## Vision alignment — hard rule (super-ux)

Check the anti-vision first.

<!-- a template example
## Not a real heading
-->

<!-- BLOCK:BEGIN managed -->
text
<!-- BLOCK:END -->
"""

with tempfile.TemporaryDirectory() as d:
    p = Path(d) / "AGENTS.md"
    p.write_text(FIXTURE, encoding="utf-8")
    out = lint.read(p)

failures = []
if "## Vision alignment" not in out:
    failures.append("the heading after a code-span `<!--` was stripped")
if "`<!--`" not in out:
    failures.append("the code span naming the opener was stripped")
if "Not a real heading" in out:
    failures.append("a real multi-line comment was kept")
if "BLOCK:BEGIN" in out or "BLOCK:END" in out:
    failures.append("a real one-line comment was kept")
if "text" not in out:
    failures.append("the text between two comments was stripped")

if failures:
    for f in failures:
        print(f"FAIL fix-ux-14: {f}")
    sys.exit(1)
print("ok fix-ux-14: inline-code openers are kept; real comments are stripped")
