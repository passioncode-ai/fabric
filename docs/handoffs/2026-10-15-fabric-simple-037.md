# Fabric 0.3.7 "simple" — handoff (2026-10-15)

**Objective.** The operator, 2026-10-15: Fabric is too complex and written for agents, not people. Keep what serves the
person, remove the rest, make Fabric the place where everything starts (consoles of coding agents, agents, setup,
projects, questions in plain words, create a project or an agent), with no confirmations or pop-ups and every act
recorded and undoable. Entry point: [the 0.3.7 plan](../evidence/plans/2026-10-15-fabric-simple/README.md).

**Done (branch `agent/fabric-simple-037`, stacked on `main` after 0.3.6).**

- The canvas: the renderer inventory, five places on the rail, the act-log-undo rule, words for people, the cut
  list, six waves. It absorbs the onboarding plan (P-19).
- [ADR-0160](../adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md), with
  amendments to ADR-0134 and ADR-0115 that take effect with wave 3. The task-pipeline ADR reservation moved to
  ADR-0161 (`fix-pf-06.03.py` green).
- Carry-over rows for work handed to Fabric the same day: CO-317 (contract DEC-0083, open-vendor models for lanes that
  read user content, at the next contract pin) and CO-318…CO-321 (RM-21 stage 1: P1 the D3 ADR and ADR-0016
  amendment, P2 the hub on the always-on Mac, P3 the network ceremonies, P8 placements).

**Before this: Fabric 0.3.6 is released** (2026-10-15, [v0.3.6](https://github.com/passioncode-ai/fabric/releases/tag/v0.3.6),
`verifiedCommit` `29515003`, [ledger](../evidence/plans/2026-10-14-release-036-verification.md)). It is installed in
`/Applications` on the operator's Mac. The running app restarts into it only when the operator quits and reopens it:
the lifecycle broker does not stop an app the person started.

**Open.**

- Wave 0: the operator reads the canvas; nothing in it is built.
- Waves 1–5 as the plan lists them.
- The carried 0.3.6 rows: CO-277, CO-284, CO-293, CO-304, CO-305…CO-316.

**Decisions.**

- 0.3.6 shipped as reviewed; the simplification is 0.3.7, not folded into a release under review.
- The dated onboarding plan is not rewritten; P-19 and this plan are its homes.

**Checks run.** On the canvas branch: `docs/ux/lint.py`, `check-registers`, `check-plan-ids`, `check-docs.sh`,
`check-design-map`, `fix-pf-06.03.py`. On 0.3.6, the complete local `ci.sh fast` and hosted `ci` were green on every
landed commit, and `release.yml` passed all of its jobs.

**Exact next task.** Wave 1 of the plan: write the scenarios for the five places and История's undo; retire the
scenarios of the cut list with ADR-0160 as the reason; draw them in the prototype (`scripts/product/`,
`node scripts/sync-product-ux.mjs`, `node scripts/build-product-report.mjs`). Start from SCN-158…SCN-161 and the
inventory in the plan's §1. Show the prototype to the operator before wave 2.
