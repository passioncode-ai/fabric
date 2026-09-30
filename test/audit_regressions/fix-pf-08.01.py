#!/usr/bin/env python3
"""FIX-PF-08.01 — all-prerequisite fan-in (sherlock audit, PF-08).

The finding: chainAdvance judged one incoming edge at a time and dispatched on
the first finished predecessor — in a diamond A(done, report)→B ← C(running,
schema), B started with "{schema}" unfilled; once both finished, one tick
could start B once per edge.

The fix under test:
* chain.ts mayStartFanIn — every predecessor `done` or no start (unknown /
  cancelled refuse with their own message); values are the UNION of hand-offs
  against the union of needs; an empty fan-in refuses;
* chainAdvance.ts groups edges by follower, holds the fan-in on ONE
  unfinished predecessor, and keys the dispatch over the COMPLETE sorted
  predecessor set so a diamond cannot double-start in one tick.

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
ADV = os.path.join(ROOT, "apps", "desktop", "src", "main", "chainAdvance.ts")

failures = []


def case(name, fn):
    try:
        fn()
        print(f"  ok  {name}")
    except AssertionError as e:
        failures.append(f"{name}: {e}")
        print(f"FAIL  {name}: {e}")


def fan_in(outcomes, produced, needs=("report", "schema")):
    js = (
        "import(process.argv[1]).then(m => {"
        "  const r = m.mayStartFanIn({taskId:'B', needs: JSON.parse(process.argv[4])},"
        "    JSON.parse(process.argv[2]), JSON.parse(process.argv[3]));"
        "  console.log(JSON.stringify(r));"
        "});"
    )
    r = subprocess.run(["node", "-e", js, CHAIN, json.dumps(outcomes),
                        json.dumps(produced), json.dumps(list(needs))],
                       capture_output=True, text=True, timeout=60)
    assert r.returncode == 0, f"node failed: {r.stderr[:300]}"
    return json.loads(r.stdout.strip().splitlines()[-1])


def t_first_of_two_does_not_start():
    v = fan_in(["done", "running"], {"report": "the report"})
    assert v["start"] is False, "half a diamond started the consumer — the finding"


def t_second_makes_ready_with_union():
    v = fan_in(["done", "done"], {"report": "the report", "schema": "the schema"})
    assert v["start"] is True
    assert v["values"] == {"report": "the report", "schema": "the schema"}, \
        "the union of hand-offs did not fill the union of needs"


def t_cancelled_or_empty_refuses():
    assert fan_in(["done", "cancelled"], {"report": "r", "schema": "s"})["start"] is False
    assert fan_in([], {})["start"] is False, "an empty fan-in started"


def t_missing_union_value_blocks():
    v = fan_in(["done", "done"], {"report": "r"})   # schema missing though both done
    assert v["start"] is False and v["missing"] == ["schema"]


def t_advance_groups_and_keys_by_set():
    with open(ADV, encoding="utf-8") as fh:
        s = fh.read()
    assert "byFollower" in s and "for (const [followerId, incoming] of byFollower)" in s, \
        "chainAdvance does not group edges by follower"
    assert "incoming.some((l) => !terminal.has(" in s, \
        "one unfinished predecessor no longer holds the fan-in"
    assert "mayStartStep(" not in s, "a per-edge verdict path survived"
    assert s.count(".sort().join('+')") >= 2, \
        "the dispatch key is not over the complete sorted predecessor set"
    assert "chain:${follower.id}:${link.target_id}" not in s, \
        "a per-edge idempotency key survived"


def main():
    case("the first of two producers does not start the consumer",
         t_first_of_two_does_not_start)
    case("the second makes it ready, with the union of hand-offs",
         t_second_makes_ready_with_union)
    case("a cancelled predecessor or an empty fan-in refuses",
         t_cancelled_or_empty_refuses)
    case("a missing union value still blocks", t_missing_union_value_blocks)
    case("chainAdvance groups by follower and keys over the predecessor set",
         t_advance_groups_and_keys_by_set)
    if failures:
        print(f"\n{len(failures)} failure(s)")
        return 1
    print("\nall green")
    return 0


if __name__ == "__main__":
    sys.exit(main())
