# ADR-0121 — Fabric updates itself, but never past a schema step

**Status:** proposed · 2026-10-06 · operator request 2026-10-06 («автообновление должно срабатывать на все мои
продукты passioncode»), relayed by the fabric-switchboard session with a survey of the organization's
installed products · plan row P-12 · target release 0.3.3

## Context

Every other installed PassionCode product updates itself: Fabric Switchboard (Tauri updater, SB-55),
Project Observatory (its maintain job), Fabric Inbox (an updater since 0.10.1, `desktop/updater.cjs`) and
Fabric Dashboards (since 0.5.6, its ADR-0015). Fabric has none: `git grep autoUpdater\|electron-updater\|latest-mac`
over `apps/desktop` finds nothing at `8d002f4d`, and the operator's Mac runs 0.3.0 while 0.3.1 is published.

Fabric differs from those products in one way that decides the design: it **never migrates an existing
database by itself**. A release whose compiled schema contract is higher than the installed database refuses
that database until the person has made a backup, rehearsed and applied the upgrade
([release runbook](../launch/release-mac.md#upgrading-an-existing-database)); 0.3.2 moves 78 → 79. An updater
that installed such a release on its own would leave an app that refuses to open the person's data.

## Decision

1. **On by default.** A check 90 s after start and every 6 h; the download runs in the background.
2. **Verified before install.** A release is installed only when its bundle carries Fabric's Developer ID
   (team `KJ35UYYL22`) and its artifact matches the organization-signed `SHA256SUMS` of that GitHub release;
   anything else is discarded and recorded.
3. **Never past a schema step.** A release whose admitted schema is higher than the installed database's
   `schema_version()` is downloaded and verified but **not installed by itself**: the person sees that a
   database upgrade step is needed, with the runbook link. This is the organization standard's permitted
   exception — a data migration needs a person.
4. **Never on a running session's quit path.** An update installs at a quit that has no live PTY session or
   agent runner; otherwise it waits for the next such quit or for the person's explicit "install now".
5. **One switch in Settings**, off means no check and no download; every check, download, verification and
   install is an ops-log event.
6. **The prerelease channel.** Fabric publishes prereleases, which `releases/latest` skips; the updater reads
   the release list and takes the newest non-draft release of its channel.

Copies up to and including 0.3.2 have no updater and need one manual update to the first release that carries
it (0.3.3).

## Consequences

The release workflow publishes, beside the DMG, what the updater reads (the artifact the updater installs and
its entry in `SHA256SUMS`); the workflow change and its rehearsal belong to P-12. Fabric Inbox's
`desktop/updater.cjs` and Fabric Dashboards' ADR-0015 are the working Electron precedents to read before
building. Acceptance: an installed build updates itself to the next release on this Mac, a planted unsigned
artifact is refused, and a planted schema step stops at the notice.

## Amendments

### Amendment 1 — 2026-10-08: the target moves after 0.3.3

The operator set 0.3.3's scope on 2026-10-08 (decision D4 of the
[onboarding brief](../evidence/plans/2026-10-08-onboarding-four-actions.md)): what is done since 0.3.2 plus the
four onboarding actions, without this record. The target release becomes **the release after 0.3.3**, and the
copies that need one manual update are those up to and including **0.3.3**. Found by the 0.3.3 verification,
iteration 1 (PL-5).
