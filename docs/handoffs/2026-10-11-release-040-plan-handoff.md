# Handoff · 2026-10-11 · Fabric 0.4.0 plan (P-16), wave 0 begins

**Objective.** Fabric 0.4.0 — agents first, planned in wave mode over the whole board:
[plan](../evidence/plans/2026-10-11-release-040-agents-first.md) (decisions D-01…D-04, R-01…R-10; canvas C1…C12;
REQ-01…REQ-36; waves 0–8; questions Q-01…Q-05; Q-05 answered: the owner pays), [inventory](../evidence/plans/2026-10-11-release-040-inventory.json)
(701 items with `node`, `wave`, `release`), assignment rule
[`scripts/plan/release-040-waves.py`](../../scripts/plan/release-040-waves.py).

**Done (this run, 2026-10-10/11).**
- The live review of the new user's path on 0.3.4 (four walks, en/ru, ~80 screens, disposable stack, fresh profile,
  isolated home) — findings F-01…F-18 in the plan; screenshots stay local (media out of Git).
- Two audits (scenarios vs code; how a plain-terminal agent reaches Fabric) and three harvests (decisions and plans,
  code extension points, the family's asks) — their facts are cited in the plan's canvas.
- The operator's batch of four decisions (2026-10-11): amend the vision; everything as 0.4.0; a terminal agent gets
  the full working set in a project on consent; setup runs in the person's coding agent.
- P-16 added to the plan (lane 2) and the Now line; the design map entry `iteration-2026-10-11-release-040-plan`.
- Coordination: fabric-dashboards-76 agreed `session-handoff/1` (schema in fabric-agent-contract), the declared
  fields `lifetime`, `mcp.strict`, `brief.delivery`, `mcp.auth`, the joined `--mcp-config=<path>`, and the setup order
  living in `knowledge/agents-first.md`; the spend-policy defaults are dynamic per project (operator 2026-10-11,
  fabric-dashboards PR #72) — REQ-36; the payer of a share grant is open — Q-05.
- Wave mode for task-pipeline: the doctrine draft exists; the implementing agent stopped on a session limit before
  writing anything. sshlg-skills-e6 (family round `feat/family-round-1010`, task-pipeline v1.91.0, PR
  ssheleg/task-pipeline#105) asked to build wave mode on top of v1.91.0 once its hub 1.55.0 lands; the routing block
  has 44 characters of headroom. Clone ready at `/Users/sshlg/DATA/task-pipeline-waves`, branch `feat/wave-mode`
  (rebase it onto the v1.91.0 tag first).

**Open.** Everything in the waves table, starting with wave 0.

**Prerequisites.** None for wave 0. Wave 1 merges `agent/windows-linux-035` into this release's base (align the
workspace submodule pin after the merge; remove the temporary push trigger from `.github/workflows/platforms.yml`).

**Checks run.** `node scripts/check-plan-ids.mjs` exit 0; `node scripts/check-design-map.mjs` exit 0;
`bash scripts/ci.sh fast` — see the commit for its exit.

**Known defects found on the way (not Fabric's).**
- agent-sync 1.21.4's guard hook does not see a lease acquired from a plain shell: the shell lacks
  `CLAUDE_SESSION_ID`, so `acquire` lands under the shared fallback identity; acquiring with
  `CLAUDE_SESSION_ID=<session>` exported makes the hook agree. Reported to the family's owner.
- The disk filled to 122 MiB free during this run (other sessions' temp data: pytest 3.5 GB, foundry-gate 2.1 GB,
  `~/.cache` 10 GB); a full disk makes every hook fail closed.

**Next task.** Wave 0: reserve ADR ids from the counter and write ADRs 1–8 of the plan (move the ADR-0132 pipeline
reservation past them, `fix-pf-06.03.py`), amend `docs/ux/vision.md` §1/§3/§7 and CONTEXT.md (R-001 propagation),
close the 33 wave-0 stale rows with receipts, expand CO-215/CO-216 into ids (REQ-34), give NOID-01…10 ids — then
the wave's verification pass, the map, the registers, land, re-run `scripts/plan/release-040-waves.py`.
