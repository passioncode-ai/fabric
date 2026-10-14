# ADR-0158 — The specification flow and the project timeline (RM-29) are built in Fabric, after Fabric starts stably on a Mac

**Status:** accepted · 2026-10-14 · records the operator's answers of 2026-10-14 to the founders' call
(fabric-workspace `docs/reports/2026-10-14-call-serge-khurs/README.md` §4a, PRs #223 and #225), relayed to this
repository on the project board by fabric-workspace · places roadmap track RM-29 among the waves of
[the 0.4.0 plan](../evidence/plans/2026-10-11-release-040-agents-first.md#waves) · rows CO-294…CO-302 of the
[carry-over ledger](../evidence/specs/2026-08-16-software-fabric-carryover.md).

## Context

The call agreed a new first priority for Serge Khurs (CALL-02, CALL-03): a step-by-step way to write a specification —
short business requirements → keep/remove iterations → vision → full specification → phases → run, steps instead of a
free prompt, a coding agent underneath — and a project timeline: phases, done and ahead, release notes, the commits and
tickets inside each item. The operator answered on 2026-10-14 that it is built in this repository (В-03), as roadmap
track RM-29, starting once Fabric runs stably on a Mac (CALL-01: it did not start on the demo, and moving an account
between pools hit a conflict); where it sits among 0.4.0's waves is Fabric's call. The same answers make Fabric the one
app people get, with Switchboard, Dashboards, Inbox and Observatory as its modules installed from it (В-01).

## Decision

1. **Gate.** RM-29 starts when CALL-01 is closed: Fabric opens on a Mac whose Docker was stopped or is still starting
   (built 2026-10-14: `env.ts#startStack` waits out a stack still starting, `stackStartRetry.ts`), and the pool move has
   no conflict (Switchboard's half, CALL-07). Until then RM-29 is designed, not built.
2. **The specification flow is a lane of 0.4.0 wave 3** (Setup console and first run): it is a guided start of a
   project, it runs a coding agent through the harness of wave 1 and hands it the pack of wave 2, and its first step
   is the same project-start screen wave 3 rebuilds. It is built as its own lane, owned by Serge Khurs, beside wave 3's
   other rows rather than queued behind them.
3. **The project timeline is a lane of wave 6** (Screens). It is a projection of what the journal already holds —
   tasks done and ahead, releases, goals — and starts from the project page's «Откуда пришли и куда идём» built on
   2026-10-14 (SCN-159, `projectPath.ts`); commits and tickets inside an item join when the timeline lands.
4. **The interface base stays Fabric's own** (CALL-21): Fabric already renders its own editor and terminal; no fork of
   Orca or VS Code is taken. A component it needs is adopted as a dependency, never as a fork of a whole IDE.
5. **The home screen of CALL-04 is built** (2026-10-14, SCN-158): the board, working agents and projects, details on a
   click. RM-29's screens extend it rather than replace it.

## Consequences

- The spec flow and the timeline get scenarios before code (super-ux): a new feature group in `docs/ux/scenarios.md`
  when the lane starts.
- Packaging (В-01) changes how modules are installed, not where RM-29 lives; it is recorded in the carry-over ledger
  as its own row.
- Isolation level 3 (CALL-16, a VM per task or agent, the knowledge base outside) joins the RM-28 pilot; the hypervisor
  and agents needing the machine's own browser are D8's decisions, not this record's.
- A hand-over to a weaker model is the agent's own risk call at hand-over time (В-02), recorded in RM-20 with
  Switchboard, not as a static label in Fabric.
