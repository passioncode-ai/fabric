# Evidence archive — 2026-09-05

Source snapshot `844c7a3`. No private user records or credentials were collected. SQL adversarial fixtures were rolled back; no TRUNCATE, real filesystem effect, real agent launch or production site mutation was used for the fault probes. Full project tests did run their existing local fixtures.

- `architecture.json` / `.md`:11modules,33ADR,12architecture documents and exact-pin/blueprint probes.
- `implementation.json` / `.md`:source seams, SQL/IPC/policy probes and coverage; static versus observed is stated per issue.
- `ux.json`:49SCN,39SCR,24FLW,146states. Complete readable version in `../../ux/audits/2026-09-05-all.md`.
- `public.json` / `.md`, `public-http-evidence.json`, `public-responsive.json`:source/live parity, allowlist, mobile geometry. Linked repository audited only as the public surface seam.
- `checks/results.json`:command, exit, elapsed time; adjacent logs are technical gate output, not user data.
- `probes/`:executed probe source/provenance/aggregate receipts, see supplied README/receipts files. Do not run against production: SQL uses synthetic transactions and rollback on the local fixture stack only.
- `installed-artifact.json`:asar hashes; package-version equality is not code equality.
- `renderer-project-dom.json`, `renderer-live-evidence.json`:synthetic IPC browser reproductions. Initial task-start stub returned an incomplete shape after dispatch; wrong project dispatch preceded that error. `cross-project-repeat.json` repeats the defect with the corrected shape and no TypeError. `make_fixture.py` archives that corrected variant; it symlinks the locally built renderer and is not itself a production implementation.
- `light-contrast.json`:sample measured CSS color contrast. Normal text criterion source: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html (fetched2026-09-05).
- `screenshots/`:compiled renderer with synthetic data and actual public website; not approved mockups and not proof of native main integration.
- `coordination.json`:aggregate live coordination checks; no historical reconciliation was invented.

The report uses Europe/Warsaw's2026-09-05. The mechanical collector's UTC filename was2026-09-04; its npm fabric result was rejected because it matched an unrelated public package to this private workspace. Clean/finding/blind probe states and domain conformance labels are distinct. Markdown sidecar paths are diagnostic evidence pointers; source lines refer to the audited snapshot, before date/filing edits.
