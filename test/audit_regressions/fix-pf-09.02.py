#!/usr/bin/env python3
"""FIX-PF-09.02 — immutable accepted outputs; resource scope apart from the
task lease (sherlock audit, PF-09, second leaf).

The fix under test (agentSurface.ts, pure helpers via node):
* handoffDisposition: first / replace (nothing consumed) / revision naming
  the stale downstream once a follower left backlog — a late edit never
  mutates a consumed output in place;
* writeScopeConflicts: prefix-or-equal overlap in either direction; a task
  lease never protects a file;
* the handoff tool journals the disposition + stale set; the claim tool
  reports scope conflicts instead of implying file protection.

Standard library + node only.
"""
import json
import os
import subprocess
import sys

sys.dont_write_bytecode = True

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SURF = os.path.join(ROOT, "apps", "desktop", "src", "main", "agentSurface.ts")

failures = []


def case(name, fn):
    try:
        fn()
        print(f"  ok  {name}")
    except AssertionError as e:
        failures.append(f"{name}: {e}")
        print(f"FAIL  {name}: {e}")


def call(fn, *args):
    js = (f"import(process.argv[1]).then(m => {{"
          f"  console.log(JSON.stringify(m.{fn}(...JSON.parse(process.argv[2]))));"
          f"}});")
    r = subprocess.run(["node", "-e", js, SURF, json.dumps(list(args))],
                       capture_output=True, text=True, timeout=120)
    assert r.returncode == 0, f"node failed: {r.stderr[:300]}"
    return json.loads(r.stdout.strip().splitlines()[-1])


def t_first_and_replace():
    assert call("handoffDisposition", False, []) == {"kind": "first"}
    v = call("handoffDisposition", True, [{"id": "B", "status": "backlog"}])
    assert v == {"kind": "replace"}, \
        "an unconsumed correction was not a plain replace"


def t_late_edit_is_a_revision():
    v = call("handoffDisposition", True,
             [{"id": "B", "status": "running"}, {"id": "C", "status": "backlog"}])
    assert v["kind"] == "revision" and v["staleDownstream"] == ["B"], \
        "a consumed output was mutated in place — the finding"
    v2 = call("handoffDisposition", True,
              [{"id": "B", "status": "done"}, {"id": "C", "status": "review"}])
    assert sorted(v2["staleDownstream"]) == ["B", "C"]


def t_scope_overlap_both_directions():
    n = [{"work_id": "T2", "owner_session": "s2",
          "write_scopes": ["src/auth/login.ts"]}]
    assert call("writeScopeConflicts", ["src/auth/"], n), \
        "a directory scope did not collide with a file inside it"
    n2 = [{"work_id": "T2", "owner_session": "s2", "write_scopes": ["src/auth/"]}]
    assert call("writeScopeConflicts", ["src/auth/login.ts"], n2), \
        "a file did not collide with its parent scope"
    assert call("writeScopeConflicts", ["docs/"], n2) == [], \
        "disjoint scopes collided"


def t_tools_wired():
    with open(SURF, encoding="utf-8") as fh:
        s = fh.read()
    hand = s[s.index("'fabric_task_handoff'"):s.index("'fabric_task_claim'")]
    assert "handoffDisposition(" in hand and "stale_downstream" in hand, \
        "the handoff tool does not journal the disposition"
    assert "lands as a new revision" in hand
    claim = s[s.index("'fabric_task_claim'"):s.index("'fabric_task_release'")]
    assert "writeScopeConflicts(" in claim and "scope_conflicts" in claim, \
        "the claim tool does not report scope conflicts"
    assert "a task lease does not protect a file" in claim


def main():
    case("first and unconsumed-replace dispositions", t_first_and_replace)
    case("a late edit is a revision naming the stale downstream",
         t_late_edit_is_a_revision)
    case("scope overlap is prefix-or-equal in both directions",
         t_scope_overlap_both_directions)
    case("both tools are wired (disposition journal, conflict report)",
         t_tools_wired)
    if failures:
        print(f"\n{len(failures)} failure(s)")
        return 1
    print("\nall green")
    return 0


if __name__ == "__main__":
    sys.exit(main())
