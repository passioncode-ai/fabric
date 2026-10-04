<sub>ssheleg skills — sheleg-design · ux-scenarios · task-pipeline · web-design-guidelines · accessibility-review</sub>

# CO-179.1 — isolated Onboarding visual author preparation

Status: author preparation; unmerged, native acceptance pending. This is not a
CO-179 closure or an AD02 acceptance receipt.

## Scope and authority

The source baseline is `ff7eb7f3a955fc43a30b302c1a68e3fee2d896c0` on
`codex/onboarding-visual-20261004`. The reviewed dossier is
[`CO-179.json` at 484600](https://github.com/passioncode-ai/fabric/blob/484600/docs/evidence/plans/unified-leaves/CO-179.json).
Its AD02 prerequisite remains blocked/pure. The coordinating root explicitly
authorized isolated reversible source authoring before native prerequisites
pass, while keeping canonical dispatch, integration and closure held. This is
an explicit preparation deviation, not a passed prerequisite.

Only `apps/desktop/src/renderer/src/Onboarding.tsx` presentation classes and an
import, plus the local `Onboarding.launch.css`, are production edit targets.
Root owns scenario, screen, registry, map and status reconciliation. The fixture
author owns `test/onboarding-visual-native-harness*.mjs`; this branch will not
edit or deliver those files. No backend, IPC, shared components, tokens or copy
changes are authorized in this leaf.

## Design brief recorded before source edits

Surface: existing native SCR-73 New project form, SCN-129. The operator names an
idea/project, optionally selects or creates folders, retains a draft while
switching tabs, then explicitly saves or cancels. The required name remains;
this does not implement the CEO-first R0 target.

Visual calibration: a restrained single-column task, one primary Save action,
existing dark/light PassionCode aliases and native controls, sentence-case
field labels, compact spacing and a bounded panel like neighboring launch
surfaces. No decorative imagery, animation, new typeface or palette. Hierarchy
comes from header → field group → hint/control → final action, with sufficient
separation to distinguish repository actions from project Save.

Falsifier: an unavailable memory reason, folder refusal or left-on-disk notice
is hidden; a long path obscures its Remove action; a control loses its native
semantics; narrow/Russian/200% layouts cannot reach every control through the
existing outer scroller; focused draft/form behavior regresses. Any such
observation rejects the candidate. Unexecuted native cases stay NOT_RUN.

| Existing launch concern | Local mapping | Preserved semantics |
| --- | --- | --- |
| `.lp` bounded page rhythm | `.onboarding.onboarding-launch`, token-derived width/padding and centered margin | Existing shell scroller; no new overflow container |
| `.lp-heading` hierarchy | Root-scoped header/title/lede | Same h1 and localized text |
| `.lp-panel` quiet fill + hairline | Direct form background/border/radius/padding aliases | Same form submit and children |
| `.lp-field` control rhythm | Scoped `.field`, labels, native text input/select | Field-generated IDs and native control elements |
| `.lp-actions` wrapping | Scoped toolbar and field actions | Button default `type=button`, explicit Save `type=submit` |
| Compact readable rows | Scoped repository row wrapping and minimum inline size | Full path text, primary/new chip and Remove callback |
| Choice/card hierarchy | Scoped native radio card spacing and token outline | Unavailable backend disabled with full actual reason |

No `lp` class is added: its broad descendant rules would unnecessarily alter
existing state colors and disabled-control treatment. The local modifier maps
the existing visual language without inheriting unrelated launch overrides.
Gold Save remains the existing shared Button primary action, as declared in
`docs/brand/ui.md`; no global monochrome/gold reconciliation is attempted.

## Baseline evidence

Before edits, the exact focused command below passed 2 files / 17 tests (6.80s)
on 2026-10-04. jsdom emitted the existing Canvas getContext notice twice; no
canvas dependency was installed. This proves controlled renderer/draft behavior,
not native acceptance.

```sh
pnpm --filter @fabric/desktop exec vitest run src/renderer/src/Onboarding.test.tsx src/renderer/src/onboardingDraft.persist.test.tsx
pnpm --filter @fabric/desktop build
node scripts/check-design.mjs
```

Baseline build and design checks exited 0. The design checker checks palette
through shipped sources but type/spacing and class ownership only in its two
configured shared sheets. Its success alone therefore does not validate this
new isolated sheet; token usage and containment require a separate source review.

## Candidate validation and next task

Candidate source authored. Exact comparison with baseline after removing the
single CSS import and reverting the root class is byte-equal: no executable
form code or product text changed. Initial source has 25 modifier-contained CSS
selector groups; the measured correction adds three modifier-qualified ancestor
groups (28 total), affecting only the workbench containing this form. The local type/spacing declaration audit passed; all type and
nonzero spacing derive from existing aliases. Native focus rules are inherited
and not overridden; focus/VoiceOver behavior still requires native acceptance.

Candidate checks actually executed:

- Focused form/draft suite: exit 0, 2 files / 17 tests, 6.67s, same Canvas notice.
- Desktop typecheck: exit 0.
- Fresh desktop build: exit 0.
- Design gate: exit 0, including unchanged 1635/1635 RU keys and brand pin.
- Code regions: exit 0, 114 closed markers with resolving references.
- `git diff --check`: exit 0.
- Negative control: in this owned tree only, changed the unavailable radio's
  disabled property to false. The existing “cannot be picked” test failed at
  `Onboarding.test.tsx:68` (exit 1). A `finally` block restored candidate source
  byte-for-byte, verified by SHA-256. No mutant is delivered.

The machine-readable [source/check receipt](2026-10-04-onboarding-visual.json)
binds the candidate hashes. Full fast gate, canonical UX lint/map, native state
matrix, keyboard/AX/VoiceOver, 200% text and CI remain NOT_RUN by this author.
Root explicitly owns independent native acceptance and canonical convergence;
their active AD02 CUA window is not touched by this author.

## Initial source-bound rendering, pending correction

Production author commit is `d454dc7dd6e0774281e8ad4653d00e43c8415ebe`.
The authorized remote branch resolved to it, and a fresh sparse remote checkout
returned all four task files byte-equal. The independently published fixture
host is `07b4626dec8d0713433ce60c4b34b06284e43544`; its two test files were
copied unchanged into the author's untracked test directory, excluded from
this branch delivery. Fresh fixtures bind the actual checkout/build/host pins.

The [capture index](2026-10-04-onboarding-visual-captures/index.json) links 16
actual hidden Electron44 `capturePage()` PNGs and complete probe receipts:
before/after EN and RU at 640/960/1440 × 900 client dimensions, plus bounded
long repositories at 760 × 1000 in both languages. Actual client dimensions
and PNG pixels/hashes are recorded. The before host source revision is the
fixture commit, whose production renderer remains the ff7 baseline; the after
source revision is d454. Generated synthetic temporary path prefixes differ
between fixtures. No screenshot was drawn or retouched.

These are initial viewport captures before synthetic bridge probes. Their tier
is source-bound rendering, not interactive native acceptance. Lower controls
are below the viewport in several cases; these screenshots do not establish
scroll reachability, keyboard/AX/VoiceOver, busy/refusal/left-on-disk rendering
or 200% text coverage. The real runner menu excludes the program-null terminal
and keeps Codex unavailable; the probe asserts those outcomes.

All 16 initial PNGs were actually inspected. Two before captures are invalid
Onboarding comparisons: `before-balanced-en-640x900` shows FirstRun and
`before-balanced-en-960x900` shows EstateHome, despite later `probe.initial`
reporting the form. There are six valid initial pairs, not eight. This is a
test-capture timing race, reported immediately to the fixture owner and root.
The next host must verify the expected stable form and draft tabs at the capture
boundary, before and after capture; the initial PNGs and raw receipts remain
unchanged historical evidence of that failure.

Visual review found a suspected right-edge lede overflow in the initial
long-repository RU760 candidate. This observation rejects visual completion
pending a bounded read-only geometry probe and local repair. Root authorized
up to two correction iterations. These initial d454 captures remain historical;
they must not be relabelled as a later repaired source.

Existing accessibility association seam, independently reported upstream:
`Onboarding.tsx:241–243` ignores the second callback argument for defaultAgent
and does not assign `aria-describedby` on its select. `Field.tsx:20–22,25–35`
provides that argument and hint ID. It predates the candidate and remains
unchanged here; root owns the bounded association fix and fresh native checks.

## Measured correction plan — iteration 1

The two [RU760 geometry receipts](2026-10-04-onboarding-visual-geometry/)
use exact fixture host `991524a368158a063a99c048685b246573971f34` and fresh
fixtures. Both PNGs were inspected and show the expected actual form. Geometry
**disproves** the suspected horizontal lede overflow: all measured document,
main, content, form and row scroll widths equal their client widths; the lede's
right edge is 728 within the 760 client. No horizontal wrapping patch is justified.

It instead exposes an existing narrow-layout scroll containment defect. At the
existing <=768 launch breakpoint, the workbench becomes `display:block`.
The real `.app-main` grows with content rather than occupying the remaining
window: baseline y 164.78125 / height 1057.75 / bottom 1222.53125; initial candidate
y 164.78125 / height 1152.0625 / bottom 1316.84375, against 1000 client height. Its
scrollHeight equals clientHeight, so the extra content does not create a scroll
extent inside that intended scroller. The root clips its overflow. This prevents
the required lower controls from being reached at that width.

Root authorized bounded correction. Before editing: retain the existing 768
breakpoint, and only for a workbench containing `.onboarding-launch`, use a
column flex frame, fixed-size sidebar region and flexible/min-height 0 app-main.
The existing `.app-main` remains the sole scroller. No global launch/theme rule,
native control, executable form logic, copy or canonical map is changed. Verify
actual resulting main bounds/scroll extent using the hardened state-boundary
host, repeat the same matrix and inspect real PNGs. Initial receipts remain
historical; root independently accepts native interaction after convergence.

## Final stable rendering — author delivery, native acceptance held

Correction source is `65b1dd25ba1360da0da34b5d9c92885952c9fbe7`.
The repeated focused suite passes 17/17 (6.38s); typecheck, fresh build,
design, 114 code-region references and diff whitespace checks exit 0. Production
source remains frozen. The ancestor correction uses the existing <=768
breakpoint and only the workbench containing `.onboarding-launch`.

[Stable comparison entry](2026-10-04-onboarding-visual-stable/README.md)
links all eight valid before/after pairs and full receipts. All 16 actual PNGs
were personally viewed and show the seeded Onboarding form and two draft tabs.
Host files are immutable `4df3079e01dd3493bf8ae302549de603257f4a26`;
the fixture owner's later receipt-only b951 commit has identical host bytes.
Each capture requires the exact configured form and unchanged geometry for at
least 500ms, a paint boundary before/after capture and equal before/after state.
The receipts' `observed.initial` equals that capture-boundary snapshot. All
16 PNG hashes, client dimensions and boundaries were independently checked.
The remote branch resolved to evidence commit
`13b272fb85d7ec2e28a534099d3285bb3b1c6a68`. A fresh sparse remote
checkout returned all 78 task-owned files byte-equal; all 35 historical/stable
PNG hash receipts and entry links resolved. This is durable delivery, not
integration or release. Subsequent receipt-only commits preserve that source.

Across all eight pairs, production source pins differ in exactly Onboarding.tsx
and the new local stylesheet; App source and other production files remain
at the ff7 baseline. This is independent of root's later draft-recovery fix.

Measured corrected `.app-main` ends at the viewport in all eight candidate
cases and has scrollHeight greater than clientHeight. At RU640 its bounds are
bottom 900, clientHeight 735, scrollHeight 1097; at RU long-path760, bottom 1000,
clientHeight 835, scrollHeight 1152. All measured scroll widths equal client
widths. The full synthetic path and Remove button visibly coexist in both
long-path candidates. Only the initial viewport was captured: actual native
scrolling to lower controls, keyboard/AX/VoiceOver, 200% text, busy/refusal and
left-on-disk state rendering remain for independent acceptance.

The extra corrected diagnostic PNG from host991 is retained in the geometry
index as **INVALID paired visual evidence**: it shows EstateHome while the later
geometry shows Onboarding. Its geometry helped diagnose the scroll frame;
it is not a stable before/after proof. Historical d454/07b and991 artifacts
are preserved unchanged, with review outcomes, rather than overwritten.

Import the complete task-owned chain in order:

1. `d454dc7dd6e0774281e8ad4653d00e43c8415ebe` — local visual source/handoff.
2. `08432cba75a1e1627ae60945d58ce906df17bb8c` — historical initial captures.
3. `65b1dd25ba1360da0da34b5d9c92885952c9fbe7` — measured narrow scroll repair.
4. Subsequent evidence-only commit(s) at this branch head — stable matrix and
   explicit invalid historical diagnostic receipt; no further source edits.

Root's first integration task is to combine this full chain with the fixture
owner's full host chain (07b →991 →4df, b951 receipts), root-owned corrupt/late
hydrate draft recovery and the pre-existing defaultAgent hint association fix.
Root must claim and reconcile canonical scenarios/screens/map/modifier registry,
then rebuild fresh and bind evidence to the combined source. Root owns native
CUA scrolling, keyboard/AX checks, the required folder/busy/refusal/notice states,
AD02 acceptance and any CO-179 closure decision. Existing author images cannot
attest that changed combined build. No canonical closure, release, installation
or production userData change is asserted here.

Root's exact next task is to combine the final pushed candidate
with the independently pushed bounded fixture, build fresh artifacts, perform
actual AD02/native CO-179 acceptance, reconcile canonical UX/map/registry if
needed, then decide integration. No release, install, provider or production
userData action is part of this author branch.

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- [`sheleg-design`](https://github.com/ssheleg/sheleg-design-skill) — Mapped existing launch hierarchy and token-only local styling
- [`ux-scenarios`](https://github.com/ssheleg/super-ux) — Preserved SCR73 SCN129 and draft paths
- [`task-pipeline`](https://github.com/ssheleg/task-pipeline) — Isolated author source and evidence handoff
- `web-design-guidelines` — Reviewed wrapping native controls and focus constraints — not a skill this family ships
- `accessibility-review` — Reviewed label association and bounded accessibility claims — not a skill this family ships

<sub>A star on [the bundle](https://github.com/ssheleg/sshlg-skills) helps.</sub>
