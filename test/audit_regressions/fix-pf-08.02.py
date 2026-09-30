#!/usr/bin/env python3
"""FIX-PF-08.02 — namespaced input merge; collisions are explicit (sherlock
audit, PF-08, second leaf).

The finding: the fan-in union wrote hand-offs into one flat map — two
predecessors producing the same output name silently last-writer-won, and the
overwritten half was somebody's input.

The fix under test (chainAdvance.ts, driven through node type-stripping):
* mergeHandoffs() namespaces every value as <producer>.<name>; a bare name
  resolves only while unambiguous;
* two different values under one name are an explicit collision error, never
  a silent overwrite; identical duplicates merge;
* the advance loop pauses the follower naming the collision and the
  namespaced remedy; interpolation runs only after the validated verdict;
* the input set is claimed once (the CAS + set-key from PF-07/08 kept).

Standard library + node only.
"""
import json
import os
import subprocess
import sys

sys.dont_write_bytecode = True

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
ADV = os.path.join(ROOT, "apps", "desktop", "src", "main", "chainAdvance.ts")

failures = []


def case(name, fn):
    try:
        fn()
        print(f"  ok  {name}")
    except AssertionError as e:
        failures.append(f"{name}: {e}")
        print(f"FAIL  {name}: {e}")


def merge(rows):
    js = ("import(process.argv[1]).then(m => {"
          "  console.log(JSON.stringify(m.mergeHandoffs(JSON.parse(process.argv[2]))));"
          "});")
    r = subprocess.run(["node", "-e", js, ADV, json.dumps(rows)],
                       capture_output=True, text=True, timeout=60)
    assert r.returncode == 0, f"node failed: {r.stderr[:300]}"
    return json.loads(r.stdout.strip().splitlines()[-1])


def t_namespaced_and_bare():
    out = merge([{"producer": "A", "name": "report", "value": "r1"},
                 {"producer": "C", "name": "schema", "value": "s1"}])
    assert out["ok"] is True
    v = out["values"]
    assert v["A.report"] == "r1" and v["C.schema"] == "s1", "namespaced keys missing"
    assert v["report"] == "r1" and v["schema"] == "s1", "unambiguous bare names missing"


def t_collision_is_explicit():
    out = merge([{"producer": "A", "name": "report", "value": "r1"},
                 {"producer": "C", "name": "report", "value": "r2"}])
    assert out["ok"] is False and out["collisions"] == ["report"], \
        "two different values under one name did not error — the silent overwrite"


def t_identical_duplicates_merge():
    out = merge([{"producer": "A", "name": "report", "value": "same"},
                 {"producer": "C", "name": "report", "value": "same"}])
    assert out["ok"] is True and out["values"]["report"] == "same", \
        "an idempotent re-emit was treated as a conflict"
    assert out["values"]["A.report"] == "same" and out["values"]["C.report"] == "same"


def t_advance_wires_the_merge():
    with open(ADV, encoding="utf-8") as fh:
        s = fh.read()
    assert "const merged = mergeHandoffs(rows)" in s, \
        "the advance loop does not use the namespaced merge"
    assert "reference the input namespaced" in s, \
        "the collision pause does not name the remedy"
    assert "merged.values" in s and "values[h.name as string] = h.value as string" not in s, \
        "the flat last-writer-wins map survived"
    assert s.index("Interpolation happens strictly AFTER") < s.index("fillBrief("), \
        "interpolation is not documented/ordered after validation"


def main():
    case("values are namespaced; unambiguous bare names kept", t_namespaced_and_bare)
    case("a collision is an explicit error, never a silent overwrite",
         t_collision_is_explicit)
    case("identical duplicates merge", t_identical_duplicates_merge)
    case("the advance loop wires the merge, names the remedy, interpolates last",
         t_advance_wires_the_merge)
    if failures:
        print(f"\n{len(failures)} failure(s)")
        return 1
    print("\nall green")
    return 0


if __name__ == "__main__":
    sys.exit(main())
