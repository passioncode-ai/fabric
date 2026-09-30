# ADR-0077 — Restored history does not grant membership

**Status:** accepted architecture for the authorized R0 work; A0 implementation is pending.
**Date:** 2026-09-27. **Extends:** ADR-0075; corrects an unintended restore consequence of migration58.

## Evidence and problem

At [source193d9f57](https://github.com/passioncode-ai/fabric/tree/193d9f57f74c5ce756b8d62b20878a82da716d33),
[migration56](../../supabase/migrations/20260910000056_restore_estate.sql) projects
archived events into a new Estate. [Migration58](../../supabase/migrations/20260910000058_subject_resolution.sql),
`apply_estate_and_projects`, retained in the latest definition in
[migration59](../../supabase/migrations/20260910000059_project_configured.sql), inserts owner membership for an existing Person named
by `estate.created@1`. Thus excluding membership tables from an archive does not
prevent history from recreating authority. Rebuild can repeat that grant after
independent revocation. Source inspection establishes the path; the A0 packet must
retain an actual full-schema failing regression and the corrected passing result.

## Decision

1. Importing historical events restores data only. Destination membership must be
   independently established. Preserve independently assigned owner/member roles;
   never silently upgrade them from an archival founder field.
2. Before projecting any restored event, the trusted restore transaction records
   a durable, immutable boundary naming the destination, source and exact restored
   event range. Projectors suppress archival owner assignment on the initial restore
   and every later rebuild. Preserve original journal bytes and ordinary fresh
   Estate bootstrap. A mutable session variable, renderer flag or ordinary event
   cannot establish this boundary.
3. The current service-only legacy restore and the future verified private recovery
   share this boundary. Legacy markers are explicitly unverified and cannot qualify
   private imports or be promoted merely by submitting a checksum later. A verified
   wrapper must check a current independent destination owner and exact archive bytes.
4. Marker, journal and projections commit atomically or roll back together. Retain
   the marker outside rebuilt projections and ordinary exported data. Rebuild must
   never delete or recreate it. Direct access to its write helper/table is denied.
5. Historical restores made before this boundary cannot be inferred reliably from
   normal journal rows. Do not fabricate provenance or revoke existing memberships
   automatically. Until explicit trusted reconciliation exists, they have no verified
   private recovery status. This limitation is a release-review item, not an implicit
   migration-success claim.
6. Private restore creates historical content and receipts only, never queued work,
   session ownership, agent credentials or execution grants. Each verified Person
   restores their own companion; ordinary restore authority grants no access to another
   Person's private conversation. Detailed format remains proposed in the
   [private archive packet](../launch/harness-r0/ceo-private-archive.md).

## Delivery and acceptance

A0 owns one additive migration, `20260927000065_restore_authority_boundary.sql`,
reserved but not integrated by this record. Applied migrations stay unchanged.
The current schema range remains64 until actual A0 code/readers/checks are integrated.
Unexecuted pipeline reservations move to66/67 and ADR-0078 using the existing collision
rule. ADR-0077 was returned by `agent_sync.py reserve ADR --key restore-authority-boundary-20260927`.

Required actual SQL checks: no owner grant on restore or later replay; independent
memberships unchanged; fresh bootstrap still works; marker unavailable to untrusted
writers; failure rolls back all artifacts; legacy marker cannot satisfy verified
recovery; old unmarked data is not silently claimed repaired. No live database is
migrated by this decision. CO-168 stays open. Follow the existing coordinated schema
maintenance barrier and matching-reader policy before any production rollout.
