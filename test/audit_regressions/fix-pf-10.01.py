#!/usr/bin/env python3
"""FIX-PF-10.01 — the Codex capability adapter (sherlock audit, PF-10).

The finding: the Codex descriptor was connectsToSurface=false, adapter 'none';
launching a Codex terminal did not prove access to claim/handoff/memory, so it
could not be treated as a peer of the Claude executor.

The fix under test (agents.ts executorReadiness + sessionBundle gate, driven
through node type-stripping):
* a resultChannel capability (surface / packet / none) is checked, not assumed
  from a spawn;
* Claude (surface + real adapter) is ready; a surface claim with a 'none'
  adapter is refused;
* a session that wants the surface is refused for a non-ready executor; a
  packet-only mode is a separate trusted transport (ready on its own terms).

Amended 2026-10-11: the return trigger on the Codex row was executed — the probe
in docs/reports/2026-10-11-codex-kimi-surface-probes measured what Codex 0.162.1
takes, and Codex is now a ready SURFACE executor through the codex-config-home
adapter. The not-ready witness moves to Cline, whose ACP session still demands a
sign-in no probe has passed; the rule under test is unchanged: readiness follows
the capability, never the spawn.

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
BUNDLE = os.path.join(ROOT, "apps", "desktop", "src", "main", "sessionBundle.ts")

failures = []


def case(name, fn):
    try:
        fn()
        print(f"  ok  {name}")
    except AssertionError as e:
        failures.append(f"{name}: {e}")
        print(f"FAIL  {name}: {e}")


def readiness(agent_id):
    js = ("import(process.argv[1]).then(m => {"
          "console.log(JSON.stringify(m.executorReadiness(process.argv[2])))})")
    r = subprocess.run(["node", "-e", js, AGENTS, agent_id],
                       capture_output=True, text=True, timeout=60)
    assert r.returncode == 0, f"node failed: {r.stderr[:300]}"
    return json.loads(r.stdout.strip().splitlines()[-1])


def t_claude_is_ready_surface():
    r = readiness("claude-code")
    assert r["ready"] is True and r["channel"] == "surface"


def t_codex_is_ready_surface():
    r = readiness("codex")
    assert r["ready"] is True and r["channel"] == "surface", \
        "Codex was probed 2026-10-11 (codex-config-home); ready by capability, not by spawn"


def t_cline_is_not_ready():
    r = readiness("cline")
    assert r["ready"] is False, "a Cline terminal was treated as a ready executor"
    assert "cannot publish a claim" in r["reason"]


def t_shell_and_unknown_not_ready():
    assert readiness("shell")["ready"] is False
    assert readiness("nope")["ready"] is False


def t_descriptor_declares_result_channel():
    with open(AGENTS, encoding="utf-8") as fh:
        s = fh.read()
    assert "resultChannel: 'surface' | 'packet' | 'none'" in s, \
        "the descriptor does not declare a result channel"
    assert "resultChannel: 'surface'" in s and "resultChannel: 'none'" in s
    # the packet transport is described as a separate trusted transport
    assert "separate TRUSTED transport" in s


def t_bundle_gates_the_surface():
    with open(BUNDLE, encoding="utf-8") as fh:
        s = fh.read()
    assert "executorReadiness(optionId)" in s, "the bundle does not check readiness"
    assert "not a ready Fabric executor" in s
    assert "adapter !== 'none'" in s, \
        "the gate should only fire for sessions that want the surface"
    # model preferences are inherited: the bundle does not force a model,
    # so the agent's own model choice flows through (no model override here)
    assert "--model" not in s or "append-system-prompt" in s


def main():
    case("Claude Code is a ready surface executor", t_claude_is_ready_surface)
    case("Codex is a ready surface executor since the 2026-10-11 probe", t_codex_is_ready_surface)
    case("Cline is NOT a ready executor (sign-in blocker, unprobed)", t_cline_is_not_ready)
    case("the shell and an unknown agent are not ready", t_shell_and_unknown_not_ready)
    case("the descriptor declares a result channel; packet is a trusted transport",
         t_descriptor_declares_result_channel)
    case("the bundle gates the surface on readiness, not on a spawn",
         t_bundle_gates_the_surface)
    if failures:
        print(f"\n{len(failures)} failure(s)")
        return 1
    print("\nall green")
    return 0


if __name__ == "__main__":
    sys.exit(main())
