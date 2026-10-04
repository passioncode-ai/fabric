<sub>ssheleg skills — sheleg-design · ux-scenarios · task-pipeline</sub>

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
form code or product text changed. All 25 CSS selector groups are contained by
the modifier. The local type/spacing declaration audit passed; all type and
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

Root's exact next task is to combine the pushed candidate
with the independently pushed bounded fixture, build fresh artifacts, perform
actual AD02/native CO-179 acceptance, reconcile canonical UX/map/registry if
needed, then decide integration. No release, install, provider or production
userData action is part of this author branch.

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- [`sheleg-design`](https://github.com/ssheleg/sheleg-design-skill) — Scoped existing launch visuals and token mappings
- [`ux-scenarios`](https://github.com/ssheleg/super-ux) — Preserved SCR73 and SCN129 paths
- [`task-pipeline`](https://github.com/ssheleg/task-pipeline) — Isolated reversible author preparation and handoff

<sub>A star on [the bundle](https://github.com/ssheleg/sshlg-skills) helps.</sub>
