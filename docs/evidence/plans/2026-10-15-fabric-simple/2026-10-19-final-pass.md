# Fabric 0.3.7: the final pass to a usable ecosystem (2026-10-19)

The operator, 2026-10-19: finish, in one last pass, everything the ecosystem needs to be used in its final form; ask
the other projects what they need from Fabric, read Fabric's backlog for what is critical, write the plan and follow it
until everything is done. This page is that plan. Its order is the order of work; each step lands on `main` through the
hosted `ci` before the next one is called done.

## What the other projects need from Fabric (asked 2026-10-19)

Fabric's board door was closed to this session at the time (the installed 0.3.6 evicted and rate limited it, the
defect CO-334 fixed on `main`), so the question went to each project's live session directly, and its answer is
recorded here; the board thread `bd1c9611` holds the morning's reports.

| Project | Blocking Fabric 0.3.7? | Needed later |
|---|---|---|
| project-observatory | no | `fabric.project.resolve` on Fabric's hub, the contract sent 2026-10-19 (CO-331), for its engine's alias `fabric:<uuid>` |
| fabric-switchboard | no | the attribution capability's name and shape (DEC-0089, SB-141); the runner catalogue as the contract's data (CT-60, agreed); COM-03 for SB-47 |
| fabric-agent-adapter | no: FAA-26, FAA-27 and FAA-29 do not block; today's paths work | FAA-26 (`fabric.agent.create`), FAA-27, FAA-29 later; Fabric as a job caller reads DEC-0087's answers (CO-336) once the kits emit them (0.36.0) |
| fabric-dashboards | no | a fabric-service/0.1 descriptor for Fabric itself in the services folder (FD-12, FD-68): its health, events and dashboard beside the other agents; carried by F7 |
| passioncode-platform | no | the 0.3.7 publish time on thread `0cc62467`, to copy Fabric's analytics delta (FAB-H01); later MA-05 needs the platform's API keys (TD-11) |
| fabric-inbox | no | B-83 (the hub's delegation-token issuer, ADR-0144 wave 4) and B-20 (memory search, MEM-P2), both later |
| fabric-agent-contract | **yes, two**: (1) the attribution capability's tool name, answering `folder-attribution.schema.json#/$defs/answer` of DEC-0089 (refusals `transient`, `tombstoned`, `container`, `tool`, `ambiguous`, `input-invalid`, plus a "not attributable yet" state); (2) CT-26, a hub-call revision's `contentHash` is computed over a joined string, not RFC 8785 of the object (`main/hubCall.ts`), so another verifier's hash differs | the runner catalogue's data shape (CT-60) by 2026-10-21, read once it lands; CT-19, CT-35, CT-36, CT-41 at Fabric's pace |
| passioncode-vesta | **yes, by 2026-10-24**: (1) share grants into an `org:<orgId>` context in DEC-0086's form (`urn:fabric:share:<32 lower-case hex>` from a CSPRNG, times with at most 3 fraction digits, one `agentRef` kept across revisions; FAC-SEM-117 before the passkey signs); (2) an agent placed in the organization's context so its usage is collected for that organization (TA-04, RM-28 D8). Sending the share registration is Observatory's node, not Fabric's (thread `9880d1c7`) | PA-02 in 0.4.0; «Create organization» can link to the org server until Vesta's TA-03 |
| fabric-workspace | **yes**: CO-322 in 0.3.7, the always-on lifecycle and the self-updater; the row on thread `cb31a510` flips with Fabric's commit | row ids for SD-1 PA-02 (CO-338), SD-2 TA-04 (CO-337), SD-3 MA-06; the attribution capability's name for the knowledge page |

## The plan

| Step | What | Rows | Status |
|---|---|---|---|
| F1 | Consoles inside Fabric as tabs along the top; a console opens there, not in its own window | OF-03 | done 2026-10-19 (`3dc58e10`, SCN-172) |
| F2 | One clean header; a compact projects rail | OF-05, OF-04 | done 2026-10-19 (`agent/header-rail-compact`, SCN-162) |
| F3 | Every coding agent of the catalogue listed and launchable as a console, fewer prompts by default, with a Settings default; OpenCode as its own runner | OF-11, CO-305, CO-304 | done 2026-10-19 (`agent/catalogue-consoles`, ADR-0168) |
| F4 | Sessions Fabric starts carry the operator's own setup: Claude's user and plugin MCP servers (Observatory among them), Codex's `AGENTS.md`, skills and trust, Hermes's key and the right binaries | CO-325, CO-324, CO-326 | done 2026-10-19 except Hermes's key (`agent/operator-setup`, ADR-0169); the key stays open in CO-326 |
| F5 | A task whose agent run ended is not held for good: the person's recorded «работа закончена» frees it, undoable | CO-327 | needs its ADR (HAR-R0-04 forbids inferring it) |
| F6 | An agent's page as its flow, newest first, with its console one press away | OF-09 | after F2 |
| F7 | Fabric's own lifecycle: launch at login by default, closing the window keeps it running, permissions said at launch; the self-updater with the five-minute check, so no later fix needs a manual install; Fabric's own fabric-service/0.1 descriptor for Dashboards | CO-322, P-12, FD-12 | after F3 |
| F9 | The attribution capability on Fabric's hub: `fabric.project.resolve`, answering DEC-0089's `answer` (pinned contract), read-only; and CT-26, revision hashes in RFC 8785 | CO-331, CT-26 | CT-26 done 2026-10-19 (`7fde6e54`); the tool after F4 |
| F10 | Share grants in DEC-0086's form and an agent placed in an organization's context, for Vesta's per-agent meter | CO-337, RM-28 | by 2026-10-24; measure what Fabric writes today first |
| F8 | Release: three verification iterations, CHANGELOG, tag `v0.3.7`, published, installed on the operator's Mac, OF-08 measured there; the publish time posted for FAB-H01 (thread `0cc62467`) | P-19 | last |

Already on `main` for 0.3.7 (2026-10-19): waves 1 to 3, OF-01, OF-02, OF-06, OF-07, OF-12, CO-333, CO-334, the hosted
verdict for the workspace publication, FAB-H01.

After 0.3.7, in 0.3.8: the rest of CO-331 (Fabric recording `observatory:` and `switchboard:` aliases), CO-329, CO-336 (DEC-0087), CO-335, the
adapter's FAA-26/27/29 if they do not block now, and the remaining 0.3.7 rows that are hardening rather than use:
CO-277, CO-284, CO-293, CO-306, CO-307, CO-308, CO-310 to CO-315.
