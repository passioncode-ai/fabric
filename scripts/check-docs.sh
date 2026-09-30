#!/usr/bin/env bash
# Documentation structure gate for Fabric.
#
# Scope: checks one decision home, unique ADR numbers, required canonical files,
# and relative Markdown links in repository and docs Markdown. It does not check
# prose meaning, external URLs, protocol currency, or semantic propagation.

set -u

REPO_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
FAIL=0

ok() { printf 'ok: %s\n' "$*"; }
err() { printf 'ERR: %s\n' "$*"; FAIL=1; }

if [ -f "$REPO_ROOT/docs/DECISIONS.md" ]; then
  err "two decision-home shapes are present; Fabric uses docs/adr/ only"
elif find "$REPO_ROOT/docs/adr" -type f -name '[0-9][0-9][0-9][0-9]-*.md' -print -quit | grep -q .; then
  ok "decision home is docs/adr/"
else
  err "no ADR entries found"
fi

DUPES=$(find "$REPO_ROOT/docs/adr" -type f -name '[0-9][0-9][0-9][0-9]-*.md' -print 2>/dev/null \
  | sed 's|.*/||; s|-.*||' | sort | uniq -d | tr '\n' ' ')
if [ -n "$DUPES" ]; then
  err "duplicate ADR numbers: $DUPES"
else
  ok "ADR numbers are unique"
fi

for REQUIRED in README.md CONTEXT.md docs/DOCMAP.md docs/vision.md \
  docs/adr/README.md docs/ux/scenarios.md docs/evidence/backlog.md; do
  if [ ! -f "$REPO_ROOT/$REQUIRED" ]; then
    err "missing canonical document: $REQUIRED"
  fi
done
[ "$FAIL" -ne 0 ] || ok "canonical documentation homes exist"

if bash "$REPO_ROOT/scripts/check-narrative.sh"; then
  ok "public narrative gate passes"
else
  err "public narrative gate failed"
fi

if python3 "$REPO_ROOT/docs/brand/lint.py"; then
  ok "brand contract gate passes"
else
  err "brand contract gate failed"
fi

# THE UX REGISTER LINTER, WHICH NOTHING RAN (UX28-15).
#
# `docs/ux/lint.py` checks the questions this card is about — whether a
# scenario's Coverage cites a file that exists, whether a Status is one of the
# declared four, whether every scenario has an index row. It was in the tree,
# it was correct, and no gate invoked it: `ci.sh` and this script ran only
# `docs/brand/lint.py`. So its findings were a backlog nobody saw, and its
# ERRORS could not fail anything.
#
# Measured on wiring it: 0 errors and 41 warnings, of which 14 were scenarios
# missing from their own index and 2 were citations naming no resolvable file.
# It also caught an invented Status token the moment one was written — which is
# the whole argument for running it: a rule keyed on a status silently stops
# applying when the status is not one it knows.
#
# Errors fail. Warnings print and do not, because 23 of them are future flows
# with no implementing screen and blocking on those would mean inventing
# screens to satisfy prose — which is the one thing the card excludes.
if python3 "$REPO_ROOT/docs/ux/lint.py"; then
  ok "UX register gate passes (warnings are advisory — see docs/evidence/backlog.md for their causes)"
else
  err "UX register gate failed"
fi

if python3 - "$REPO_ROOT" <<'PY'
import pathlib
import re
import sys
import urllib.parse

root = pathlib.Path(sys.argv[1])
files = list(root.glob("*.md")) + list((root / "docs").rglob("*.md"))
bad = []
pattern = re.compile(r"\[[^\]]*\]\(([^)]+)\)")
# A link into a submodule that is not checked out cannot be resolved HERE: `workspace` is
# private and a public clone cannot initialise it (scripts/lib/submodules.mjs says why). Such
# links are counted and named, not passed; where the submodule is checked out they are checked.
gitmodules = root / ".gitmodules"
unchecked = [
    (root / m).resolve()
    for m in (re.findall(r"^\s*path\s*=\s*(.+?)\s*$", gitmodules.read_text(encoding="utf-8"), re.M) if gitmodules.exists() else [])
    if not (root / m / ".git").exists()
]
not_checked = {}
for source in files:
    text = source.read_text(encoding="utf-8")
    in_fence = False
    for line_no, line in enumerate(text.splitlines(), 1):
        if line.lstrip().startswith(("```", "~~~")):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        for raw in pattern.findall(line):
            target = raw.strip().split()[0].strip("<>")
            if not target or target.startswith(("#", "http://", "https://", "mailto:")):
                continue
            path = urllib.parse.unquote(target.split("#", 1)[0])
            if not path:
                continue
            resolved = (source.parent / path).resolve()
            sub = next((u for u in unchecked if resolved == u or u in resolved.parents), None)
            if sub is not None:
                name = sub.relative_to(root.resolve()).as_posix()
                not_checked[name] = not_checked.get(name, 0) + 1
            elif not resolved.exists():
                bad.append(f"{source.relative_to(root)}:{line_no}: {target}")
if bad:
    print("broken relative Markdown links:")
    for item in bad:
        print(f"  {item}")
    raise SystemExit(1)
for name, count in not_checked.items():
    print(f"NOT CHECKED: {count} relative link(s) into the submodule '{name}', which is not checked out here (private; a public clone cannot initialise it)")
print(f"relative Markdown links resolve ({len(files)} files inspected)")
PY
then
  ok "relative Markdown links resolve"
else
  err "relative Markdown link check failed"
fi

if [ "$FAIL" -eq 0 ]; then
  echo "PASS: Fabric documentation structure"
  exit 0
fi

echo "FAIL: Fabric documentation structure"
exit 1
