#!/usr/bin/env bash
# What CI runs — as a script in the repository, not as YAML (REL-01).
#
# WHY THIS FILE EXISTS AND THE WORKFLOW IS THIN. A check that can only be
# exercised by pushing is a check nobody debugs, and one nobody can watch fail
# is not proven — which is the standard this repository holds every other gate
# to. Everything CI does is here, so it can be run, broken on purpose, and
# watched refusing, on a laptop, before a runner ever sees it.
#
# TWO TIERS, and the split is not cosmetic. The fast tier needs no database:
# types, the design and documentation gates, the register arithmetic, and every
# test that is pure. Run it locally before the source commit; hosted execution
# follows the repository nightly policy, not a new push/PR dispatch. The full
# tier brings up the local stack and runs the probes that talk to it.
#
# Usage: scripts/ci.sh [fast|full]   (default: fast)

set -euo pipefail
cd "$(dirname "$0")/.."

TIER="${1:-fast}"
step() { printf '\n\033[1m── %s\033[0m\n' "$1"; }

step "types"
pnpm -r typecheck

step "interface: tokens, strings, the component set"
pnpm gates:design
# 2026-09-29. The launch screens are built to docs/reports/product.html, and the design's own
# rules are what the app runs: this refuses a launch.css whose ported block was hand-tuned or
# has fallen behind the prototype.
node scripts/launch/port-launch-css.mjs --check

step "documentation: structure, links, scenarios, brand, registers"
pnpm gates:docs
# Code region markers resolve to documentation (REQ-20; AGENTS.md "Code region markers").
node --test scripts/test/check-regions.test.mjs
node scripts/check-regions.mjs

step "probe templates"
# 2026-10-01. The public re-creation of the history left receipts addressing commits a fresh
# clone does not have. Each is verified here, repinned with its rule, or stale and re-proved
# stale (scripts/lib/public-history.mjs); --summary fails on any receipt in none of the three.
node --test scripts/test/public-history.test.mjs scripts/test/submodules.test.mjs
node scripts/repin-public-history.mjs --summary >/dev/null
# 2026-10-01. Three siblings were re-created the same way, and 180 links into their old commits
# opened nothing while every gate stayed green. Each link into a sibling commit resolves in its
# public history, or names a commit on the closed pre-publication list from a dated record or an
# ADR and prints NOT_CHECKED; repinned receipts are re-read at their new commit. Needs the network.
node --test scripts/test/sibling-commits.test.mjs
node scripts/check-sibling-commits.mjs
node scripts/check-adoption-plan.mjs
node scripts/check-adoption-bindings.mjs
# Existed since the R0 operator audit and nothing ran it (the FA-10 class).
node scripts/check-operator-plan.mjs
node --test scripts/test/adoption-bindings.test.mjs
node scripts/build-adoption-report.mjs --check
node --test scripts/test/adoption-plan.test.mjs
node scripts/check-probes.mjs
# UX28-12. Keeps a vacuous truth from becoming false in silence: nothing in the
# shipped tree pays for inference, and the day one path does it must go through
# the provider router rather than into whatever module needed an answer.
node scripts/check-no-hidden-model-call.mjs
# UX28-14. Two STRUCTURAL checks, and neither is an accessibility pass — the
# card excludes that from static analysis. One refuses a grid whose child count
# and track count disagree; the other refuses a control a screen reader cannot
# introduce. They exist so a person's runtime walk is not spent on either.
node scripts/check-grid-arity.mjs
node scripts/check-control-names.mjs
# AX-05. FIVE times in one cycle a field was declared, written and read by
# nothing — a lint nobody ran, a revision no command carried, a receipt the
# only caller discarded, two columns selected and dropped, and a return route
# with no Back. The sixth is caught here. A ratchet, not a wall: the existing
# debt is a baseline that may only shrink.
node scripts/check-written-never-read.mjs
node scripts/check-backup-claim.mjs

step "ipc: every handler is checked against the answer its channel declares"
# M109. The renderer's FabricApi is the ONE declaration of a channel's answer,
# and nothing compared a handler to it — tsc type-checked the preload calls and
# compared them with nothing. Four drifts were found the two times anybody
# looked; the annotation is the check and this is what keeps it on.
node scripts/check-ipc-contract.mjs

# M108, UXA-C05. A list collapsed with `?? []` at a JSX call site loses the third
# state before the component that renders it can see one — so "nobody has looked"
# arrives as "there is nothing". A type cannot forbid it, because an array is
# assignable to a nullable array; the gap is in the caller and this is what makes
# it impossible to forget.
node scripts/check-unread-boundary.mjs

step "actor: an identity is established, never taken from the caller"
# S09. The version that trusts the caller is shorter, works in every test and is
# invisible in a diff — and in a single-operator build it is even correct. It
# becomes a privilege escalation the day a second person exists, by which time
# the parameter is at forty call sites.
node scripts/check-actor.mjs

step "eval: the conformance corpus records what actually broke here"
# M176. A corpus written from imagination measures imagination — it stays green
# on the day something real ships. Every fixture names the work that found the
# defect it seeds, and this resolves that name against the register.
node scripts/check-eval.mjs

step "route: the shell is in one place at a time"
# S13. `active` had a boolean `showAgents` beside it and every content branch
# read `!showAgents && active.kind === …`, while `openProject` — reached from
# three panels — set only the first. Navigating from the agents view opened the
# tab and left the agents list covering it.
node scripts/check-route.mjs

step "hooks: no hook below a component's early return"
# S01. React throws when a render calls more hooks than the previous one, and a
# component that returns early on one render and falls through on the next does
# exactly that — killing the window rather than showing anything.
node scripts/check-hooks.mjs

step "ops: every operation is observable, and silence carries its reason"
# M81. The journal is what happened to the ESTATE; this is what the PROGRAM did.
# Before it, 31 console.error calls wrote to a terminal a packaged app does not
# have, and a set of catch blocks dropped the reason entirely.
node scripts/check-ops.mjs
node scripts/check-checker.mjs
node scripts/check-references.mjs
node scripts/check-obligations.mjs

step "scope: every query in the main process reaches one estate"
# S02.a. The unit tests prove the map matches the schema and the predicates come
# out right; neither can prove the NEXT query goes through the store, and that is
# the failure this exists for — 87 queries omitted the estate predicate because
# omitting it was shorter, not because anyone decided to.
node scripts/check-scope.mjs

step "commands: an event type with a command has one writer"
# FA-04. `task.linked@1` had THREE writers. Only one checked anything, and it
# checked in the client one round trip before the append with the RPC's error
# dropped — so a check that could not run waved the write through, and two
# clients writing opposite edges both read "no cycle" and both wrote. A second
# door is a second set of rules; they diverge the first time somebody in a hurry
# fixes one of them.
node scripts/check-commands.mjs

step "build — what ships is what the probes read"
# Added 2026-09-06. `preload-sandbox.test.mjs` reads the SHIPPED bundle, and
# without this step it read whatever `out/` happened to hold: stale on a repeat
# run, absent on a fresh clone. Evidence from a build artefact is evidence about
# a PREVIOUS build — a rule this run learned twice (M100's classifier went green
# against a stale bundle while the real run still said `unknown`, and M196's
# probe would have passed against a pre-fix preload). The build is a few seconds
# and it removes the class.
pnpm --filter @fabric/desktop exec electron-vite build

step "release: the build identifies itself from the artifact it actually contains"
# S07. Nothing in the running application said which build it was, so a defect
# report could not name what was running. The identity is generated at build
# time and read back as a file: a packaged app has no repository under it, so
# asking git at runtime answers about whatever directory it was launched from.
#
# FA-01 MOVED THIS. It used to run near the top, twenty steps BEFORE the build,
# and it described whatever `apps/desktop/out` happened to hold — the previous
# build on a repeat run, nothing at all on a fresh clone. A manifest generated
# before its artifact is a measurement of the wrong thing that reads exactly
# like a measurement of the right one. The order is now build, then manifest,
# then the gate that checks the manifest against what was built.
node scripts/build-manifest.mjs
node scripts/check-release.mjs

step "pure tests — no database"
# Named one by one rather than by a wildcard: a test that quietly starts needing
# the stack must FAIL here rather than be silently promoted to the full tier.
pnpm --filter @fabric/desktop exec vitest run
node apps/desktop/test/app-icon.test.mjs
# ADR-0100 D5: the icon PNG is the render of fabric-icon.svg, never a hand edit.
node scripts/build-app-icon.mjs --check
# Reads the SHIPPED bundle produced by the step above, so it is never reading a
# stale artefact. It launches nothing, so it belongs with the pure tests.
node apps/desktop/test/preload-sandbox.test.mjs
node --experimental-strip-types apps/desktop/test/session-env.test.mjs
# FA-03. Pure: it injects its fetch and its clock, reads no credential and
# reaches no network. An HTTP 200 whose body said nothing used to become a clean
# reading, and a clean reading is permission for work nobody is watching.
node --experimental-strip-types apps/desktop/test/quota-reader.test.mjs
node --experimental-strip-types apps/desktop/test/transcripts.test.mjs
node apps/desktop/test/file-roots.test.mjs
# ADR-0100: the start paths' disk reads and executor detection, against a real git tree and real processes.
node --experimental-strip-types apps/desktop/test/project-discovery.test.mjs
node --experimental-strip-types apps/desktop/test/executor-detect.test.mjs
node --experimental-strip-types apps/desktop/test/delivery.test.mjs
node --experimental-strip-types apps/desktop/test/pty-launch-failure.test.mjs
node --experimental-strip-types apps/desktop/test/chain-launch-failure.test.mjs
node --experimental-strip-types apps/desktop/test/managed-launch.test.mjs
node --experimental-strip-types apps/desktop/test/managed-stop.test.mjs
node --experimental-strip-types apps/desktop/test/native-stop-runtime.test.mjs
node --experimental-strip-types apps/desktop/test/native-view-lifecycle.test.mjs
node --experimental-strip-types apps/desktop/test/provider-execution.test.mjs
node --experimental-strip-types apps/desktop/test/provider-jsonl-transport.test.mjs
node --experimental-strip-types apps/desktop/test/codex-provider-events.test.mjs
node --experimental-strip-types apps/desktop/test/codex-provider-control.test.mjs
# Pure protocol policy only; native/WebSocket probes remain explicit manual checks.
node apps/desktop/test/codex-tui-read-probe-gate.test.mjs
node --experimental-strip-types apps/desktop/test/provider-control-stdio.test.mjs
node --experimental-strip-types apps/desktop/test/claude-control-transport.test.mjs
node --experimental-strip-types apps/desktop/test/claude-provider-events.test.mjs
node --experimental-strip-types apps/desktop/test/claude-provider-control.test.mjs
node --experimental-strip-types apps/desktop/test/transcript-recovery.test.mjs
node --experimental-strip-types apps/desktop/test/schema-readiness.test.mjs
node --experimental-strip-types apps/desktop/test/context-privacy.test.mjs
node --experimental-strip-types apps/desktop/test/command-ingress-adapters.test.mjs
node --experimental-strip-types apps/desktop/test/desktop-ingress.test.mjs
node --experimental-strip-types apps/desktop/test/agent-http-ingress.test.mjs
node --experimental-strip-types apps/desktop/test/ceo-conversation.test.mjs
node --experimental-strip-types apps/desktop/test/ceo-conversation-draft.test.mjs
node --experimental-strip-types apps/desktop/test/ceo-conversation-service.test.mjs
node --experimental-strip-types apps/desktop/test/ceo-conversation-host.test.mjs
node --experimental-strip-types apps/desktop/test/ceo-private-archive-codec.test.mjs
node --experimental-strip-types apps/desktop/test/ceo-chat-binding.test.mjs
node --experimental-strip-types apps/desktop/test/ceo-conversation-inventory.test.mjs
node --experimental-strip-types apps/desktop/test/active-estate.test.mjs
node --experimental-strip-types apps/desktop/test/provider-loopback.test.mjs
node --experimental-strip-types apps/desktop/test/loopback-ws-client.test.mjs
node --experimental-strip-types apps/desktop/test/codex-loopback.test.mjs
node --experimental-strip-types apps/desktop/test/transcript-finalization.test.mjs
node --experimental-strip-types apps/desktop/test/transcript-receipt.test.mjs
node --experimental-strip-types apps/desktop/test/close-http-server.test.mjs
node --experimental-strip-types apps/desktop/test/stop-host-identity.test.mjs
node --experimental-strip-types apps/desktop/test/process-boundary.test.mjs
node --experimental-strip-types apps/desktop/test/reconcile.test.mjs
node --experimental-strip-types apps/desktop/test/continuation-exactly-once.test.mjs
node --experimental-strip-types apps/desktop/test/past-context.test.mjs
node --experimental-strip-types apps/desktop/test/mirror-manifest.test.mjs
node apps/desktop/test/files.test.mjs
# S14. Real filesystem, real permission removal, real leftover temp file: a fake
# fs would prove the code calls rename, and the question is what survives when
# it does not.
node apps/desktop/test/local-state.test.mjs
# M81 — real filesystem: the property that matters is that it never throws.
node apps/desktop/test/ops.test.mjs
# Pure: it injects its git reader, and its watch cases run against a temp .git.
node apps/desktop/test/repo-quota.test.mjs
# Pure: the repository-root decision lives outside `env.ts` precisely so
# this can load it without Electron.
node apps/desktop/test/startup.test.mjs
node --experimental-strip-types apps/desktop/test/bundled-stack.test.mjs
node apps/desktop/test/app-brand.test.mjs
# Pure: injects its git, and its live case reads THIS repository.
node apps/desktop/test/code-stats.test.mjs
# Pure prototype contracts; they never launch Fabric, a browser, an agent or a DB.
# FA-01. Pure: temp directories and one spawn of the producer; it touches no
# database, launches nothing and writes nothing into the checkout.
node --test scripts/test/build-identity.test.mjs scripts/test/toolchain.test.mjs
# FA-05. One reading of a Markdown table row and one derivation of an id's
# aliases — the register held 101 open rows while every number quoted about it
# said 99, and a report named a task by an anchor nobody could search for.
node --test scripts/test/markdown-table.test.mjs scripts/test/canonical-id.test.mjs
# Release review 2026-10-03. Each fix lands with the probe that watched it fail,
# and these are pure — fakes under the REAL scoped store, or source files read —
# so the tier that runs before every commit runs them, not only `pnpm -r test`.
node --experimental-strip-types apps/desktop/test/chain-advance-reads.test.mjs
node --experimental-strip-types apps/desktop/test/list-reads.test.mjs
node --experimental-strip-types apps/desktop/test/context-mandatory.test.mjs
node apps/desktop/test/session-bundle.test.mjs
node --experimental-strip-types apps/desktop/test/digest-boundary.test.mjs
node --experimental-strip-types apps/desktop/test/search-read.test.mjs
node --experimental-strip-types apps/desktop/test/run-lifecycle-contract.test.mjs

step "owned databases: the SQL contract and the reads, on a cluster this run creates and removes"
# A disposable PostgreSQL (`initdb` into a temp dir, Unix socket only) with the
# whole migration chain; it never touches the stack the desktop uses. Without
# PostgreSQL binaries the runner exits 2 and this step says NOT_RUN out loud
# rather than passing — set FABRIC_PG_BIN to run it. The eleven older
# `run-*-db.mjs` runners are still package scripts only (review finding 3).
for runner in run-estate-identity-db run-read-schema-db; do
  set +e
  node "apps/desktop/test/$runner.mjs"
  code=$?
  set -e
  if [ "$code" = "2" ]; then printf 'NOT_RUN %s: no PostgreSQL binaries (FABRIC_PG_BIN)\n' "$runner"
  elif [ "$code" != "0" ]; then exit "$code"; fi
done

step "measured runtimes: the private pipe adapters under Node and inside Electron main (E0, B1, B2a, B2b-1, B4)"
# The registry and the native view host read a private Node pipe field and rely on libuv's
# short-write and EAGAIN answers. They run only on a runtime tuple that was measured
# (apps/desktop/src/main/runtimeAdmission.ts), and this step is the measurement: every suite
# under Node, then again inside a real Electron main process (process.type 'browser').
# backend-launch (B1) runs the actual managed launch over that registry: a launch is classified
# by the registry's RESULT — a refusal with no child is "not started", a marker hit is unknown.
# claude-owned-stdio (B2a) joins the Claude control transport to those pipes: each request's fence
# is checked again at the registry's synchronous write edge, after every other callback.
# backend-listener (B2b-1): a loopback backend's port comes only from its own stderr receipt, and
# per-launch arguments (a token digest) reach that process without being persisted.
# backend-view (B4): native views owned by that backend in node-pty; backend loss, a reconnect and
# Stop fence every view at once, and detaching a view never stops the backend.
if [ "$(uname)" = Darwin ]; then
  backend_node="$(node -p 'require("fs").realpathSync(process.execPath)')"
  for suite in runtime-admission owned-backend-process-registry backend-launch claude-owned-stdio backend-listener backend-view native-view-host; do
    node --experimental-strip-types "apps/desktop/test/$suite.test.mjs"
    FABRIC_BACKEND_NODE="$backend_node" apps/desktop/node_modules/.bin/electron apps/desktop/test/electron-main-runner.mjs "apps/desktop/test/$suite.test.mjs"
  done
else
  echo "NOT_RUN: the private pipe adapters are measured on Darwin only; this host is $(uname)"
fi

step "workspace publication: what an uncommitted parent change can actually reach"
# 2026-09-10. The rail refused to publish while ANY unrelated file was dirty, and
# the operator hit it mid-iteration. The snapshot is exported from a commit and the
# pin commit stages two paths by name — but `git commit` writes the whole index, so
# STAGED is the hazard and unstaged is work in flight. The last case is proven
# against a real repository, not a hand-written porcelain string (R-007).
node --test scripts/test/workspace-publication-guard.test.mjs

step "workspace sources: every tool repository, pinned to its own commit"
# 2026-09-29, agent-registry AR-0.5. The wiki carries the organization's other repositories
# under repos/<id>/. Fixture repositories only — no network, no private access.
node --test scripts/test/workspace-sources.test.mjs scripts/test/workspace-release.test.mjs

step "mockups: the prototype draws every state it offers"
# 2026-09-12. `#state-select` listed «Пусто» for all 72 views and 66 of them returned the
# POPULATED screen: only `denied` and `loading` routed to the generic body, and each module
# renderer carries its own list of honoured states, none of which listed `empty`. Drives the
# real renderer with the real model and fixtures, not a copy of the rule (R-007).
node --test scripts/test/product-empty-state.test.mjs
node --test scripts/test/chat-workspace.test.mjs scripts/test/operator-workspace.test.mjs scripts/test/adoption-creation.test.mjs scripts/test/memory-workspace.test.mjs scripts/test/first-release.test.mjs scripts/test/folder-picker.test.mjs scripts/test/launch-design.test.mjs scripts/test/pulse-design.test.mjs scripts/test/r0-ui-design.test.mjs scripts/test/ceo-onboarding.test.mjs scripts/test/first-slice-states.test.mjs scripts/test/calm-*.test.mjs

step "mockups in a real browser: every browser suite, or NOT_RUN said out loud"
# 2026-09-28 (CO-171). Fifteen browser suites existed and none was run here; ten had
# rotted against the product for weeks. They need an installed Playwright package and
# Chrome (FABRIC_PLAYWRIGHT_MODULE, FABRIC_CHROME); without them this step prints NOT_RUN
# and passes, because a check that cannot run is not a failure — and not a pass either.
bash scripts/test/run-browser-suites.sh

step "wiki projections: previews pinned to the prototype, plan pinned to the board"
# 2026-09-12. The /mockups gallery shows real renders and the /plan page renders a
# projection; both rot silently the moment their source moves, so the pins are checked
# here WITHOUT a browser: previews.json carries the sha256 of product.html and the model,
# plan.json is byte-parity with its own generator. Rebuild commands are in each error.
node scripts/build-mockup-previews.mjs --check
node scripts/build-plan-projection.mjs --check

step "plants: every rule this iteration added, watched going red"
# R-006. Ten mechanism-removing variants, each valid code that behaves like the
# defect it replaced. Host plants need workspace/node_modules and say so when they
# are skipped rather than reporting a smaller denominator as success.
node scripts/test/plants-workspace-navigation.mjs

step "queue: a row that says shipped names what proves it"
# FA-05. 74 of 90 shipped rows carry no receipt today; those are CO-132 and this
# does not fail on them. What it refuses is a row that becomes shipped in THIS
# change with nothing behind the word — the same shape check-actor.mjs used when
# it was turned on: hold the line from before there is anything to untangle.
node scripts/check-shipped-receipt.mjs

step "containment: a mode that removes the runner's gate says so"
# FA-09. The effects floor is voluntary — every runner has native tools Fabric
# cannot see — so a floored effect is refused for a mode nothing stands between
# and the world. The declaration is checked against the flags beside it: a mode
# carrying a bypass flag and claiming a gate would be believed otherwise.
node scripts/check-containment.mjs

step "output cost: what may happen per byte, and what may travel per listing"
# FA-08. The data handler read the whole 400 000-character buffer on every chunk
# to learn its last line, and every listing carried that buffer across the IPC
# boundary for a reader that needs it once. The shape is checked here; the cost
# is MEASURED by scripts/bench/pty-output.mjs and recorded under
# docs/evidence/plans/2026-09-10-output-cost/. No gate reads those numbers — a
# threshold here would be a budget nobody agreed.
node scripts/check-output-cost.mjs

step "handoff: the generated coordination document is current and reachable"
# FA-10. docs/AGENT_SYNC.md opens by saying the tool is right when they disagree,
# and nothing detected the disagreement. `agent_sync.py check` verifies this and
# more, but it reaches the Notion record plane — a gate that fails when a third
# party is slow teaches everyone to ignore it. These two properties are local.
node scripts/check-handoff.mjs
node --test scripts/test/registers.test.mjs

step "provider capability: what the installed CLIs actually support, per build"
# M199.probe. The nine M199 children design account switching and conversation
# continuity on top of two programs Fabric does not ship, and the card forbids
# reporting `supported` from reading somebody else's README. The matrix is pinned
# to a CLI BUILD, so an upgrade returns its rows to unverified rather than
# carrying yesterday's answer forward. Runs `--version` and nothing else; it
# reads no credential and performs no login.
node --experimental-strip-types scripts/check-provider-capability.mjs
# REQ-19 (2026-10-03): the mechanical re-pin of version-only rows, and its refusal to carry a verdict.
node --test scripts/test/repin-provider-builds.test.mjs

step "acceptance: a capability is supported only after a run nobody can fake"
# M199.acceptance. Two sentences from the card, made mechanical: "without test
# accounts or capability evidence the status stays not executed, not passed",
# and "fixture tests alone cannot pass acceptance". `native-resume-ack` is the
# one capability answered only by switching an account and finding the
# conversation still there — so it needs a receipt, and CO-112 closes only by a
# measured boundary rather than by an implementation.
node scripts/check-acceptance.mjs

step "the dated provider-account probe, which now asserts its own fix"
# M199.usage. This probe recorded two defects on 2026-09-09 and NOTHING RAN IT —
# a check that exists and nobody executes, the FA-10 class in a different file.
# Both were fixed on 2026-09-10 and it asserts the fix now; the third case it
# records is one that cannot be fixed here (one keychain item per OS user) and it
# says so with the measurement. Pure: no home, keychain, login, CLI or network.
node --experimental-strip-types docs/audit/2026-09-09-provider-accounts.probe.mjs

step "list reads: no filter as long as the data"
# Found by the full tier on 2026-09-10 with nothing committed behind it: the
# chain advancer asked for followers with `.in('id', followerIds)`, at 294 ids
# the URL is 10 879 characters, and the gateway answers 414 — which `.data ?? []`
# read as "no followers are waiting". Unattended chains stopped advancing in
# silence, and the id list grows with the data, so the failure has no author.
# Fourth appearance of one shape (FA-04, FA-03, FA-02) and the first where SIZE
# is the trigger.
node scripts/check-list-reads.mjs

# A counter that stops counting is a change signal that stops signalling. The
# renderer caps the display feed at 500 events, so `feed.length` never moves
# again afterwards and every reader keyed to it freezes for the rest of the
# session — panels keep rendering, the numbers just stop. M42 moved ProjectHome
# off it; UX28-02 found the same line still in EstateHome, freezing the estate
# Board and the attention count. Twice is where a script replaces a ledger row.
node scripts/check-feed-marks.mjs

# The tool contract the harness panel shows is the one the surface registers.
# Two lists in two files, kept in step by hand: measured 2026-09-10 they agreed
# (22 and 22, same names), so this closes the reason they agreed rather than a
# live divergence. The prose beside them had already drifted — the panel's own
# string said "Sixteen tools exist and eleven write to the journal" while the
# figures were 22, 17 and 5, and the panel now renders them from the list.
node scripts/check-surface-tools.mjs

# "Nobody counted" is not "nothing was cut". `coverageOfList` answers a capped
# read with THREE values, and `boolean | 'unknown'` compared against `true` is
# legal TypeScript and wrong: 'unknown' then reads as "nothing was cut". Found
# 2026-09-10 in PlanSection, where a goal reported a real fraction of a closed
# list nobody had counted — while two other surfaces read the same value
# honestly, in two different idioms, six files away.
node scripts/check-coverage-reads.mjs
node --test scripts/test/product-graphs.test.mjs scripts/test/product-graph-scopes.test.mjs scripts/test/product-graph-plan.test.mjs scripts/test/product-graph-provenance.test.mjs scripts/test/product-integrations.test.mjs scripts/test/product-integration-sources.test.mjs scripts/test/product-integration-final.test.mjs

step "audit regressions — the findings a merge must not quietly undo"
# Arrived with `sherlock/impl-20260907`, which sat unmerged for two days with
# NOTHING running these twelve files. Two of them were already red on their own
# branch when it was picked up: FIX-PF-07.01 still asserted the single-predecessor
# idempotency key that FIX-PF-08.01 had widened to the complete predecessor set,
# and FIX-PF-06.03 held a reservation the main line had since claimed. A suite no
# runner names is not a suite; it is a directory that agrees with whatever the
# code says. Named one by one for the same reason as the pure tests above — and
# because a wildcard matching zero files is exactly how these went unseen.
# Standard library only: they read source, launch nothing and touch no database.
python3 test/audit_regressions/fix-pf-04.02.py
python3 test/audit_regressions/fix-pf-05.02.py
python3 test/audit_regressions/fix-pf-06.02.py
python3 test/audit_regressions/fix-pf-06.03.py
python3 test/audit_regressions/fix-pf-07.01.py
python3 test/audit_regressions/fix-pf-07.02.py
python3 test/audit_regressions/fix-pf-08.01.py
python3 test/audit_regressions/fix-pf-08.02.py
python3 test/audit_regressions/fix-pf-09.01.py
python3 test/audit_regressions/fix-pf-09.02.py
python3 test/audit_regressions/fix-pf-10.01.py
python3 test/audit_regressions/fix-pf-10.02.py

if [ "$TIER" = "fast" ]; then
  printf '\n\033[1mfast tier green.\033[0m The stack-backed probes did not run — use `scripts/ci.sh full`.\n'
  exit 0
fi

step "the local stack"
supabase start >/dev/null
supabase migration up --local >/dev/null

step "every probe, including the ones that need the database"
pnpm -r test

printf '\n\033[1mfull tier green.\033[0m\n'
