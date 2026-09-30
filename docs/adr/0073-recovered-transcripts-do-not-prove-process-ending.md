# ADR-0073 — Recovered transcripts do not prove process ending

**Status:** accepted architecture; pre-release implementation under test, no live migration.
**Date:** 2026-09-27. **Extends:** ADR-0032, ADR-0069. **Source:** authorized R0 harness delivery and reproducible recovery/Stop race review.

## Decision

1. Preserve historical `transcript.captured@1` payloads. Add `transcript.captured@2` for a strictly validated recovered capture, through `recover_transcript` and the existing single journal writer.
2. `captured_at` is the database receipt time. `started_at` and `ended_at` may be null. Provenance is `legacy`, `observed` or `unknown`; an old endpoint is not proof it was observed. Unknown ending requires partial retained output, null end and null exit code.
3. Validate original session/Project/Task/provider against history, UTF-8 content digest and metadata. Same intent returns the original receipt; conflicting scope/body/command refuses. An existing legacy or stronger capture is not overwritten. Replay validates the event independently of ephemeral authorization.
4. Only an exact verified receipt permits local cleanup. Deadline or lost reply retains the source. Read at most eight bodies per page; advance past corrupt entries and retry later. Current application-owned session generations, including exited sessions with pending Stop/finalization, are excluded before reading recovery bodies.
5. Recovery has no Run completion, Task, Stop, lease or execution authority. Memory and digest readers label capture separately from termination. Future context compiler revision 3 orders captures by journal sequence and exposes ending provenance; already finalized packs remain byte-for-byte unchanged.
6. No parallel authoritative transcript store. The existing projection gains nullable endpoints and capture provenance; ephemeral authorization rows are neither exported memory nor restorable runtime authority.

## Rollout and rollback

This pre-release schema requires a coordinated maintenance window: stop old app writers, take a verified backup, install upgraded reader code without starting it, apply the migration, then start and verify the upgraded app. New readers require the new columns; old readers must not read @2 null endpoints. This branch does **not** perform that rollout. After @2 events exist, do not downgrade only the schema/readers: fix forward or restore the complete pre-migration backup with writers stopped. Never manufacture timestamps to make rollback pass.

## Evidence and next boundary

See [recovery packet and checks](../launch/harness-r0/recovery.md), [checks](../launch/harness-r0/checks.md). Concrete code: `supabase/migrations/20260927000063_transcript_recovery.sql#recover_transcript`, `apps/desktop/src/main/transcriptRecovery.ts#createTranscriptRecovery`, `apps/desktop/src/main/pty.ts#recoverTranscriptFinalizations`. SQL restore and actual disk/coordinator receipt composition are tested separately from native provider Stop. A full Electron crash/return/continuation walkthrough remains required before capability acceptance.
