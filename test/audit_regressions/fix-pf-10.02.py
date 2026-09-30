#!/usr/bin/env python3
"""FIX-PF-10.02 — a real two-session handoff, verified not simulated (sherlock
audit, PF-10, second leaf).

The fix under test (agents.ts verifyHandoff, driven through node type-stripping):
* on a supported host, a verified handoff records the actual LOADED digest, the
  tool CALL and a current result;
* the executor is INDEPENDENT — a different session that did NOT read the
  planner's transcript (no transcript dependency);
* the result must arrive on a TRUSTED channel (surface | packet), never 'none';
* an unready host, or a ready host with no recorded evidence, is NOT_RUN —
  never a green from a spawn.

Standard library + node only.
"""
import json
import os
import subprocess
import sys

sys.dont_write_bytecode = True

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
AGENTS = os.path.join(ROOT, "apps", "desktop", "src", "shared", "agents.ts")

failures = []


def case(name, fn):
    try:
        fn()
        print(f"  ok  {name}")
    except AssertionError as e:
        failures.append(f"{name}: {e}")
        print(f"FAIL  {name}: {e}")


def verify(host, evidence):
    js = ("import(process.argv[1]).then(m => {"
          "console.log(JSON.stringify(m.verifyHandoff(process.argv[2], JSON.parse(process.argv[3]))))})")
    r = subprocess.run(["node", "-e", js, AGENTS, host, json.dumps(evidence)],
                       capture_output=True, text=True, timeout=60)
    assert r.returncode == 0, f"node failed: {r.stderr[:300]}"
    return json.loads(r.stdout.strip().splitlines()[-1])


GOOD = {"packetDigest": "abc", "executorSession": "s-exec", "plannerSession": "s-plan",
        "loadedDigest": "abc", "readPlannerTranscript": False, "toolCall": "fabric_task_handoff",
        "resultChannel": "surface"}


def t_verified_records_all_three():
    v = verify("claude-code", GOOD)
    assert v["status"] == "verified", f"a real handoff was not verified: {v}"
    assert v["actualLoad"] == "abc" and v["toolCall"] == "fabric_task_handoff"
    assert v["result"] == "current"


def t_unready_host_is_not_run():
    v = verify("codex", GOOD)
    assert v["status"] == "NOT_RUN" and "not a ready executor" in v["reason"], \
        "an unready host was not NOT_RUN"


def t_ready_but_no_evidence_is_not_run():
    v = verify("claude-code", {})
    assert v["status"] == "NOT_RUN", "a ready host with no evidence passed as a run"


def t_same_session_fails():
    ev = dict(GOOD, executorSession="s-x", plannerSession="s-x")
    v = verify("claude-code", ev)
    assert v["status"] == "failed" and "same session" in v["reason"]


def t_transcript_dependency_fails():
    ev = dict(GOOD, readPlannerTranscript=True)
    v = verify("claude-code", ev)
    assert v["status"] == "failed" and "read the planner transcript" in v["reason"], \
        "a transcript-dependent result was accepted as a packet handoff"


def t_wrong_load_and_untrusted_channel_fail():
    ev = dict(GOOD, loadedDigest="different")
    assert verify("claude-code", ev)["status"] == "failed"
    ev2 = dict(GOOD, resultChannel="none")
    v = verify("claude-code", ev2)
    assert v["status"] == "failed" and "untrusted channel" in v["reason"]


def t_packet_channel_is_trusted():
    ev = dict(GOOD, resultChannel="packet")
    assert verify("claude-code", ev)["status"] == "verified"


def main():
    case("a verified handoff records load, tool call, current result",
         t_verified_records_all_three)
    case("an unready host is NOT_RUN", t_unready_host_is_not_run)
    case("a ready host with no evidence is NOT_RUN", t_ready_but_no_evidence_is_not_run)
    case("planner == executor session fails", t_same_session_fails)
    case("a transcript-dependent result fails (no transcript dependency)",
         t_transcript_dependency_fails)
    case("a wrong loaded digest or untrusted channel fails",
         t_wrong_load_and_untrusted_channel_fail)
    case("the packet channel is a trusted result channel", t_packet_channel_is_trusted)
    if failures:
        print(f"\n{len(failures)} failure(s)")
        return 1
    print("\nall green")
    return 0


if __name__ == "__main__":
    sys.exit(main())
