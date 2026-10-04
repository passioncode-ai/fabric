<sub>ssheleg skills — sheleg-design · ux-scenarios · task-pipeline · accessibility-review</sub>

# CO-179 independent native rendering review

Status: scoped candidate passes the observed rendering review; canonical
integration/native acceptance remains with root. Two missing-reason mutants
are explicitly REJECTED. This is not a CO179/AD02 closure or release receipt.

## Context and native verdict

Exact baseline: root source `9adebf88964df6e3cffb13c016863ca981459674`,
including App draft recovery and defaultAgent hint association. The current
CO-179 dossier's critical-callout negative and preserved native controls were
read before source edits. Root owns canonical UX/map/status and native CUA.

Independent review inspected all ten root-provided actual native PNGs in
[root-native-reviewed/index.json](root-native-reviewed/index.json). Copies
are byte-equal to the root artifacts; corresponding original source/build/host
markers are preserved, and capture attribution remains root CUA, not this author.
The EN/light960 initial frame is REJECTED for partially occluding Create project.
Its subsequent bottom frame and the other eight reached-state/notice frames
show readable lower controls, reason text where configured and the complete
left-on-disk notice. That supports those visible reached states, not every
interaction or the whole native matrix. EN640 has no configured backend or
runner; its absent memory group and empty agent select are intentional fixtures.

## Scoped overlap correction

The fixed wide Fabric launcher crosses the sidebar boundary at960 and covers
part of Save before scrolling. The only production edit is the last20 lines of
[Onboarding.launch.css](../../../apps/desktop/src/renderer/src/Onboarding.launch.css).
Above the existing768 breakpoint, a workbench containing `.onboarding-launch`
places its own sidebar launcher in normal flow, bounds it to the sidebar and
wraps its existing status. Token spacing is reused. Native chat button semantics
and text, other routes and the existing <=768 static launcher remain unchanged.
No shared/global sheet, token, App, IPC or backend changes.

The actual hidden EN/RU light960 single-backend candidate frames show both
footer buttons unobscured in the initial viewport and the launcher contained
in the sidebar. Required memory statement remains readable. Six normal frames
were personally inspected; no new visible defect appears in the rendered areas.
At640 and2x the lower form lies below the initial viewport; this is a scrolling
path, not simultaneous full-form visibility. Root's actual bottom frames show
those lower controls on the previous source; this narrowly desktop-only CSS
change still requires fresh combined-source native launcher/control checks.

## Negative control

The bounded [test driver](../../../apps/desktop/test/onboarding-reason-negative-control.mjs)
runs only in an isolated `fabric-co179-native-review-*` worktree on
`codex/co179-native-review-20261004` with exact accepted CSS bytes. It uses
the unchanged strict native host from9ade; no DOM writes, arbitrary script,
fixture matcher relaxation, fake rendering, live data or production handler.
The first run writes raw evidence; cold replays choose a unique test-owned
replays subdirectory and preserve earlier captures.

The [sole mutant rule](raw/missing-reason.mutant.css) temporarily hides only the
disabled backend reason with `visibility:hidden`. The [complete original mutant
stylesheet](raw/mutated-Onboarding.launch.css) and [normal stylesheet](raw/accepted-Onboarding.launch.css)
are both retained. The driver builds/captures six normal and two mutant fixtures,
then restores exact normal bytes and rebuilds in finally. Build logs, markers,
actual PNGs and full source/build/host pins are in [raw/index.json](raw/index.json).

Both language pairs were personally viewed. Normal Cloud has its real hosted
estate reason; mutant Cloud retains its disabled radio and heading but has an
unexplained blank reason area. Both mutants are **REJECTED** for hiding required
truth. All production pins differ only in Onboarding.launch.css. The native
snapshot geometry and radio/control state are equal, while rendered `innerText`
loses exactly the unavailable reason line. This verifies a real visual defect;
source presence or a radio-disabled assertion alone would not prove visibility.

| Actual1440×1200 dark render | Normal reason visible | Missing-reason mutant |
| --- | --- | --- |
| EN | [PASS](raw/normal-reason-en.png) | [REJECT](raw/mutant-reason-en.png) |
| RU | [PASS](raw/normal-reason-ru.png) | [REJECT](raw/mutant-reason-ru.png) |

Additional candidate frames: [EN light960](raw/normal-single-light-en-960.png),
[RU light960](raw/normal-single-light-ru-960.png),
[RU dark640 initial](raw/normal-balanced-dark-ru-640.png),
[EN light2x initial](raw/normal-balanced-light-en-2x.png).

## Validation and first next task

[Review receipt](review.json) distinguishes all executed checks and pixel
verdicts. Actual focused form/draft suite: 2 files,21 tests, exit0,44.78s;
existing Canvas notices, no canvas installation. Typecheck, accepted/mutant/
restored builds, design,131 resolving regions, driver syntax and diff whitespace
checks exit0. Eight exact hidden Electron captures have equal capture-boundary
snapshots and verified PNG hashes. Accepted CSS restored SHA256:
`4949e5603177dc1374850b85ab7c33a2fcd940f682a9b95b9ee5ee5ca13a9cff`.
Onboarding.tsx and all other production bytes remain baseline-identical.
Capture sourceRevision identifies the9ade branch base; sourcePins independently
bind the modified CSS working cut. The accepted/mutant CSS was not committed
at9ade, and no receipt asserts otherwise. This handoff commits that exact
accepted candidate plus both original stylesheet snapshots.

Fresh replay (only isolated author branch with dependencies already present):

```sh
node --check apps/desktop/test/onboarding-reason-negative-control.mjs
node apps/desktop/test/onboarding-reason-negative-control.mjs --run
```

Root's first next task: import the scoped stylesheet and this test/evidence
packet, reconcile its modifier-qualified launcher ownership under the existing
claim, rebuild fresh, then check EN/RU light960 initial/footer and sidebar
launcher keyboard/click reachability through actual native CUA. Bind receipt
to the new source/build. Other root matrix receipts retain their original source
pins. Root decides whether its full acceptance/closure gates are met.

NOT_RUN here: native CUA actions, VoiceOver, final combined-source user scrolling,
full native state matrix, whole-repository fast gate, canonical UX/map updates,
hosted CI, installation/release and production userData. The2x fixture uses
Electron zoom, not a separate OS text-size setting. No full WCAG claim.
