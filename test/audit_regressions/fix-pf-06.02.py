#!/usr/bin/env python3
"""FIX-PF-06.02 — single-authority dispatch over immutable projections
(sherlock audit, PF-06).

The fix under test (pipelineAdapters/taskPipeline.ts + chainAdvance.ts):
* DISPATCH_AUTHORITY is fabric — graph.py hands the queue over, it is not a
  second scheduler;
* taskIdFor(node@revision) is deterministic and immutable: importing the same
  node twice yields the SAME identity, so two systems (or two imports) cannot
  dispatch it twice;
* nodeFor() is the exact inverse; a Fabric-native task projects to null;
* projectNodes() dedupes inside one import; a result routes back to the node
  REVISION it was built against (a new revision is a new identity);
* chainAdvance stamps the projected node identity on the dispatch event.

Standard library + node only.
"""
import json
import os
import subprocess
import sys

sys.dont_write_bytecode = True

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
ADAPTER = os.path.join(ROOT, "apps", "desktop", "src", "main",
                       "pipelineAdapters", "taskPipeline.ts")
ADV = os.path.join(ROOT, "apps", "desktop", "src", "main", "chainAdvance.ts")

failures = []


def case(name, fn):
    try:
        fn()
        print(f"  ok  {name}")
    except AssertionError as e:
        failures.append(f"{name}: {e}")
        print(f"FAIL  {name}: {e}")


def run_js(body):
    js = "import(process.argv[1]).then(m => {" + body + "});"
    r = subprocess.run(["node", "-e", js, ADAPTER],
                       capture_output=True, text=True, timeout=60)
    assert r.returncode == 0, f"node failed: {r.stderr[:300]}"
    return json.loads(r.stdout.strip().splitlines()[-1])


def t_identity_is_deterministic():
    out = run_js(
        "const a = m.taskIdFor({runId:'run1', nodeId:'N-7', revision:3});"
        "const b = m.taskIdFor({runId:'run1', nodeId:'N-7', revision:3});"
        "const c = m.taskIdFor({runId:'run1', nodeId:'N-7', revision:4});"
        "console.log(JSON.stringify({a, b, c, authority: m.DISPATCH_AUTHORITY}));")
    assert out["a"] == out["b"], "the same node@revision minted two identities"
    assert out["a"] != out["c"], "a new revision reused the old identity"
    assert out["authority"] == "fabric"


def t_round_trip_and_native_null():
    out = run_js(
        "const id = m.taskIdFor({runId:'run1', nodeId:'N-7', revision:3});"
        "console.log(JSON.stringify({back: m.nodeFor(id), native: m.nodeFor('9f0e-uuid')}));")
    assert out["back"] == {"runId": "run1", "nodeId": "N-7", "revision": 3}
    assert out["native"] is None, "a Fabric-native task id parsed as a projection"


def t_reimport_cannot_double_dispatch():
    out = run_js(
        "const nodes = [{nodeId:'N-1', revision:2, instruction:'x'},"
        "               {nodeId:'N-1', revision:2, instruction:'x again'}];"
        "const first = m.projectNodes('run1', nodes);"
        "const second = m.projectNodes('run1', [{nodeId:'N-1', revision:2, instruction:'x'}]);"
        "console.log(JSON.stringify({first: first.map(t=>t.id), second: second.map(t=>t.id)}));")
    assert len(out["first"]) == 1, "one node produced two rows inside one import"
    assert out["first"] == out["second"], \
        "a re-import minted a rival identity — two systems could dispatch twice"


def t_result_routes_to_the_built_revision():
    out = run_js(
        "const id3 = m.taskIdFor({runId:'r', nodeId:'N', revision:3});"
        "console.log(JSON.stringify({target: m.nodeFor(id3)}));")
    assert out["target"]["revision"] == 3, \
        "the result did not route to the revision it was built against"


def t_advance_stamps_and_doctrine():
    with open(ADV, encoding="utf-8") as fh:
        s = fh.read()
    assert "nodeFor(follower.id as string)" in s, \
        "chainAdvance does not project the follower id"
    assert "...(projected ? { node: projected } : {})" in s, \
        "the dispatch event does not carry the node identity"
    with open(ADAPTER, encoding="utf-8") as fh:
        a = " ".join(fh.read().split())
    assert "not a second scheduler" in a
    assert "staleness is the coordinator's verdict" in a


def main():
    case("the identity is deterministic; a new revision is a new identity",
         t_identity_is_deterministic)
    case("nodeFor round-trips; a native task projects to null",
         t_round_trip_and_native_null)
    case("a re-import cannot double-dispatch", t_reimport_cannot_double_dispatch)
    case("a result routes to the revision it was built against",
         t_result_routes_to_the_built_revision)
    case("chainAdvance stamps the node; the single-authority doctrine is written",
         t_advance_stamps_and_doctrine)
    if failures:
        print(f"\n{len(failures)} failure(s)")
        return 1
    print("\nall green")
    return 0


if __name__ == "__main__":
    sys.exit(main())
