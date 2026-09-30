#!/usr/bin/env python3
"""FIX-PF-04.02 — Fabric's chain preserves the satisfaction distinction and an
unknown predicate fails closed (sherlock audit, PF-04).

graph.py's PF-04.01 made a parked producer block its consumer. Fabric's shared
chain model already distinguishes done from cancelled/abandoned — but a PORTED
graph can hand `mayStartStep` a status the Outcome union never named (a
task-pipeline `parked`, a future state) and a produced value of an unknown
SHAPE (an object where a hand-off string belongs).

The fix under test (apps/desktop/src/shared/chain.ts, driven through node's
native type-stripping):
* an unknown outcome (`parked`, `weird`) fails CLOSED with the status named —
  a parked required edge never becomes ready;
* a non-string produced value is MISSING, not a crash;
* done/cancelled/missing-input semantics are unchanged.

Standard library + node only.
"""
import json
import os
import subprocess
import sys

sys.dont_write_bytecode = True

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
CHAIN = os.path.join(ROOT, "apps", "desktop", "src", "shared", "chain.ts")

failures = []


def case(name, fn):
    try:
        fn()
        print(f"  ok  {name}")
    except AssertionError as e:
        failures.append(f"{name}: {e}")
        print(f"FAIL  {name}: {e}")


def may_start(previous, produced):
    js = (
        "import(process.argv[1]).then(m => {"
        "  const r = m.mayStartStep({taskId:'B', needs:['report']},"
        "    JSON.parse(process.argv[2]), JSON.parse(process.argv[3]));"
        "  console.log(JSON.stringify(r));"
        "});"
    )
    r = subprocess.run(["node", "-e", js, CHAIN, json.dumps(previous), json.dumps(produced)],
                       capture_output=True, text=True, timeout=60)
    assert r.returncode == 0, f"node failed: {r.stderr[:300]}"
    return json.loads(r.stdout.strip().splitlines()[-1])


def t_parked_required_edge_is_not_ready():
    v = may_start("parked", {"report": "a perfectly good report"})
    assert v["start"] is False, "a PARKED predecessor made the follower ready — the finding"
    assert "parked" in v["why"] and "fail closed" in v["why"], v["why"]


def t_any_unknown_outcome_fails_closed():
    for weird in ("running", "dispatching", "weird-future-state", ""):
        v = may_start(weird, {"report": "x"})
        assert v["start"] is False, f"unknown outcome {weird!r} started the follower"


def t_unknown_shape_is_missing_not_a_crash():
    v = may_start("done", {"report": {"an": "object"}})
    assert v["start"] is False and v["missing"] == ["report"], \
        "a non-string produced value did not fail closed as missing"
    v2 = may_start("done", {"report": 42})
    assert v2["start"] is False and v2["missing"] == ["report"]


def t_existing_semantics_unchanged():
    assert may_start("done", {"report": "the report"})["start"] is True
    assert may_start("cancelled", {"report": "x"})["start"] is False
    assert may_start("done", {})["missing"] == ["report"]
    assert may_start("done", {"report": "   "})["missing"] == ["report"]


def main():
    case("a parked required edge is not ready", t_parked_required_edge_is_not_ready)
    case("every unknown outcome fails closed", t_any_unknown_outcome_fails_closed)
    case("an unknown-shaped input is missing, not a crash",
         t_unknown_shape_is_missing_not_a_crash)
    case("done/cancelled/missing semantics unchanged", t_existing_semantics_unchanged)
    if failures:
        print(f"\n{len(failures)} failure(s)")
        return 1
    print("\nall green")
    return 0


if __name__ == "__main__":
    sys.exit(main())
