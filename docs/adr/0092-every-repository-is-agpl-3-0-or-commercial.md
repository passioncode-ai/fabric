# ADR-0092 — Every PassionCode.ai repository is AGPL-3.0 or commercial

**Status:** accepted licensing decision; changes the licence of every repository from its next
release; no identifier, data store or authority boundary changes.
**Date:** 2026-09-30. **Decided by:** the operator, asking for a licence that is open source and free
for one's own use but paid for commercial use, and choosing "AGPL-3.0 plus a commercial
licence" among the options offered, 2026-09-30.
**Supersedes** decision 3 (licence wording) of
[ADR-0086](0086-positioning-names-teams-and-the-public-tools-are-source-available.md); its
positioning and name-form decisions stay. ADR-0086 is not edited.

## Context

On 2026-09-30 seven repositories carried PolyForm Noncommercial OR PolyForm Internal Use (Fabric
Agent Adapter, Fabric Dashboards, Fabric Switchboard, Okolos, the launcher, Project Observatory),
one MIT (Project Observatory contract), one Apache-2.0 (Fabric Inbox), and the rest none at all,
Fabric included. The operator asked for one model: open source, free for one's own use, paid for
commercial use. MIT cannot express "paid for commercial use", and PolyForm is not open source; the
operator chose the dual licence.

## Decision

1. **Every repository of the organization is dual-licensed:** the GNU Affero General Public
   License v3.0 only, or a commercial licence from PassionCode.ai. SPDX expression:
   `AGPL-3.0-only OR LicenseRef-PassionCode-Commercial`.
2. **Files:** `LICENSE` holds the unmodified AGPL-3.0 text; `COMMERCIAL-LICENSE.md` says who needs
   the commercial licence (anyone who will not meet the AGPL's terms — for example a closed-source
   product or a hosted service without offering its source) and that it is obtained from
   contact@passioncode.ai. No price or term is stated anywhere until the operator sets one.
   Package manifests carry the SPDX expression.
3. **Wording:** "Open source under AGPL-3.0; a commercial licence is available." Never
   "source-available", "PolyForm" or "MIT" for a current version.
4. **What does not change:** a version already released keeps the licence it was released under
   (MIT or PolyForm), and the surfaces say so. Third-party code keeps its own licence and notice
   (Fabric Inbox's imported Apache-2.0 template, Fabric VR's `third_party/`, every vendored
   dependency). The CLA stays: it grants the right to sublicense contributions "under any license
   terms", which is what makes the dual licence possible.
5. **Out of scope:** the operator's own agents, which live in the operator's private repositories.

## Consequences

- Each repository's next release is the first under the new licence; the change lands with that
  repository's version bump and changelog.
- The narrative gate refuses "source-available" and "PolyForm" on living Fabric surfaces; the
  organization's format check (`org-index/scripts/check_format.py`) refuses a repository without
  the two licence files or with another SPDX expression.
- **Open for the operator (brief CO-KB-01):** the AGPL obliges whoever distributes the software
  under it to offer its source. Fabric, Fabric Inbox and Fabric VR ship binaries while their
  repositories are private. As the copyright holder the operator is not bound by the licence, but
  a recipient told "AGPL" will expect the source. Either publish those repositories before calling
  their binaries AGPL, or ship their binaries under the commercial terms until then. Until that
  choice, their `LICENSE` files carry the dual licence and their download pages do not call the
  binary AGPL.
