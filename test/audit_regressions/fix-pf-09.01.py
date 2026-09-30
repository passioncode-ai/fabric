#!/usr/bin/env python3
"""FIX-PF-09.01 — authenticated publication (sherlock audit, PF-09).

The finding: fabric_task_handoff accepted any taskId in the project — no live
lease, no attempt check — so a foreign or stale session could publish a result
over the current owner, and apply_handoffs would replace the value.

The fix under test (agentSurface.ts, mayPublishHandoff driven through node):
* a foreign session with no claim is refused;
* a foreign session against a LIVE lease is refused with the holder named;
* the caller's own EXPIRED lease is refused as stale (re-claim first);
* the current live owner publishes; the session's own task publishes — unless
  another session's live lease has taken it over;
* the tool wires the gate before the append and re-reads after (arbitration).

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


NOW = 1_800_000_000_000
LIVE = "2100-01-01T00:00:00Z"
DEAD = "2000-01-01T00:00:00Z"


def verdict(scope, task_id, lease):
    js = ("import(process.argv[1]).then(m => {"
          "  console.log(JSON.stringify(m.mayPublishHandoff("
          "    JSON.parse(process.argv[2]), process.argv[3],"
          "    JSON.parse(process.argv[4]), Number(process.argv[5]))));"
          "});")
    r = subprocess.run(["node", "-e", js, SURF, json.dumps(scope), task_id,
                        json.dumps(lease), str(NOW)],
                       capture_output=True, text=True, timeout=120)
    assert r.returncode == 0, f"node failed: {r.stderr[:300]}"
    return json.loads(r.stdout.strip().splitlines()[-1])


def t_foreign_unclaimed_refused():
    v = verdict({"sessionId": "s1", "taskId": "T-own"}, "T-other", None)
    assert v["ok"] is False and "authenticated owner" in v["reason"], \
        "an arbitrary project task accepted a foreign result — the finding"


def t_foreign_live_lease_refused_with_holder():
    v = verdict({"sessionId": "s1", "taskId": "T-own"}, "T-other",
                {"owner_session": "s2", "expires_at": LIVE})
    assert v["ok"] is False and v.get("heldBy") == "s2"


def t_stale_own_lease_refused():
    v = verdict({"sessionId": "s1", "taskId": "T-own"}, "T-other",
                {"owner_session": "s1", "expires_at": DEAD})
    assert v["ok"] is False and "stale attempt" in v["reason"], \
        "an expired attempt published"


def t_current_owner_accepted():
    v = verdict({"sessionId": "s1", "taskId": "T-own"}, "T-other",
                {"owner_session": "s1", "expires_at": LIVE})
    assert v["ok"] is True, "the live owner was refused"
    own = verdict({"sessionId": "s1", "taskId": "T-mine"}, "T-mine", None)
    assert own["ok"] is True, "the session's own task was refused"


def t_own_task_taken_over_refused():
    v = verdict({"sessionId": "s1", "taskId": "T-mine"}, "T-mine",
                {"owner_session": "s2", "expires_at": LIVE})
    assert v["ok"] is False and v.get("heldBy") == "s2", \
        "a live takeover did not block the original session"


def t_tool_wires_gate_and_rereads():
    with open(SURF, encoding="utf-8") as fh:
        s = fh.read()
    body = s[s.index("'fabric_task_handoff'"):s.index("'fabric_task_claim'")]
    assert "mayPublishHandoff(" in body, "the tool does not call the gate"
    assert body.index("mayPublishHandoff(") < body.index("appendRedacted"), \
        "the gate runs after the append"
    assert "ownership moved mid-publication" in body, \
        "the post-append arbitration read is missing"
    assert "fence:" in body, "the append does not carry the fence"


def main():
    case("a foreign unclaimed task is refused", t_foreign_unclaimed_refused)
    case("a foreign live lease refuses with the holder named",
         t_foreign_live_lease_refused_with_holder)
    case("the caller's expired lease is a stale attempt", t_stale_own_lease_refused)
    case("the current owner (and the session's own task) publish",
         t_current_owner_accepted)
    case("a live takeover blocks even the task's own session",
         t_own_task_taken_over_refused)
    case("the tool gates before the append and re-reads after",
         t_tool_wires_gate_and_rereads)
    if failures:
        print(f"\n{len(failures)} failure(s)")
        return 1
    print("\nall green")
    return 0


if __name__ == "__main__":
    sys.exit(main())
