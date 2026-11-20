---
report:
  id: fabric/2026-11-20-owner-hardcode-audit
  title: "What Fabric holds of its owner: an audit for a public product, and the waves that empty it"
  kind: audit
  project: fabric
  domains: [privacy, settings, packaging, ux, onboarding]
  as_of: 2026-11-20
  status: active
  valid_until: 2026-12-20
  summary: >-
    Every place the repository (desktop main, shared, renderer, CEO and voice, scripts, packaging, migrations, living
    docs) carries something of the owner's machine or estate that a stranger's Fabric would not have: his agents and
    organizations, paths, project ids, vault slots, servers, and silent assumptions that Observatory, Switchboard or a
    PM agent is installed. 41 findings, each with a class and a decision. Wave 1 (this change) removes the built-in
    PassionCode.ai route behind «Присылать вопросы в Telegram через агента организации», makes the link visible and
    editable per project in Settings, scrubs the owner's names from shipped comments and adds a gate that scans the
    BUILT app. Waves 2 to 4 are planned below.
  sources:
    - name: "Audited tree: origin/main at the start of the audit"
      url: "https://github.com/passioncode-ai/fabric/tree/37d69d6a"
      read_at: 2026-11-20
---

# What Fabric holds of its owner

The owner's words (CEO window, CEO session 53895bdc, 2026-11-20, about 21:02 Warsaw), verbatim:

> «Вот еще в настройках есть такая штука, типа присылать телеграм. А как мы определим, какой телеграм, какая
> организация, короче, здесь вообще непонятная связь, неочевидная, установленная, где вообще была эта организация. И
> давай вот это все проверим … аудит проекта на такие всякие захардкоженные биты со мной связи, которые были в ходе
> разработки, чтобы это все стало пабликом … все должно быть настраиваемо, все в настройки выносится … и там стоят уже
> мои ключи, но то, что мы выкатываем, там должны быть пустые вещи»

The rule this audit applies: anything configurable is a setting; the owner's values live in his settings on his
machine; the shipped build holds none of them; a feature without its setting is honestly off and says what it needs.
Keys a user gets from our backend in built versions (licensing) are a separate subject and out of scope.

Vision alignment: serves the product becoming usable by anyone (the vision's "any person, any team"); no conflict with
the anti-vision.

## Method

Three read-only passes over `37d69d6a`, each with its grep patterns recorded in the session, then a reading of the
BUILT bundles (`apps/desktop/out`, `electron-vite build`), because the main-process bundle keeps source comments: a
comment is shipped text. Line numbers below are at `37d69d6a`; living code is cited by symbol where it changed.

Classes: **personal** (a name, path, machine or id of the owner), **binding** (a value of his estate built in as a
default), **hidden** (a feature that silently assumes a companion tool or agent is installed), **secret-name** (a vault
slot or tool of his machine).

## What came up clean

- The database: `supabase/seed.sql` seeds only the zero UUIDs (`…0001` estate, `…000a` operator); the 102 migrations
  hold no owner literal; `supabase/config.toml` is stock.
- Packaging: `electron-builder*.yml` has no signing identity, team id or update feed; `resources/`, `build/`, the
  launchd plist and entitlements hold nothing personal. `appId ai.passioncode.desktop` is the publisher's identity.
- Renderer code: no Cyrillic literal outside `i18n/`, no e-mail, Telegram id, bot or home path.
- The org denylist (`check_private.py`, P1) found no term in the build; its e-mail and path findings were library
  examples (supabase-js docs, Homebrew's Linux prefix, Monaco's TypeScript worker), listed in
  `scripts/check-build-private.allow`.

## Findings and decisions

### A. «Присылать вопросы в Telegram через агента организации» (the screenshot)

| ID | Where (at `37d69d6a`) | What | Class | Decision | Wave |
|---|---|---|---|---|---|
| OH-01 | `apps/desktop/src/shared/peopleAsk.ts:306-308` `DEFAULT_PEOPLE_ROUTES` | PassionCode.ai's PM project id `d6e9…2680`, businesses and GitHub owner built in as the route every install starts with | binding | Empty list. The owner's machine already holds that route in `userData/people-ask-routes.json` (read 2026-11-20: three routes, PassionCode.ai among them), so nothing of his is lost and no migration is needed | 1, done |
| OH-02 | `i18n/ru.ts:302`, `i18n/en.ts:1013` `settings.peopleAskHelp` | «например Кире для PassionCode.ai»: the owner's agent as the example, and stale (PassionCode's PM is Morpheus since 2026-11-20) | personal | Example removed; the hint says the agent is the one chosen for the project below | 1, done |
| OH-03 | `SettingsScreen.tsx#AgentPermissionsSetting` | Which organization, which agent, which Telegram and where the link came from were invisible and could not be changed | hidden | New table «Куда уходят вопросы» (`SettingsScreen.tsx#PeopleRoutesSetting`): every project, its organization agent, whether it answers now, the source (chosen, routes file, found by itself, off, none, several fit) and the business and repository owner it matched by; a choice per project («Как найдено», an agent, «Не отправлять в Telegram»), written to the same routes file (`peopleAsk.ts#withChoice`) and honoured first by the bridge (`peopleAskRun.ts`). Telegram is said honestly: Fabric keeps no chat, bot or person; the agent does | 1, done |
| OH-04 | `shared/types.ts:574` `peopleAsk: true` | On by default | binding | Kept on: with no route nothing is sent, and the table now says why («Ни один агент организации не принимает вопросы…») | 1, ruled |
| OH-05 | `shared/peopleAsk.ts:178-186, 282-293`, `peopleAskRun.ts` | The request and result texts are Russian whatever the locale | binding | Localize with the person's language | 2 |

### B. Shipped comments that name the owner's machine and accounts (they reach the main bundle)

| ID | Where | What | Decision | Wave |
|---|---|---|---|---|
| OH-06 | `shared/ceoAgent.ts:329` | `~/DATA/_worktrees` "(the operator's rule)" | Neutral wording | 1, done |
| OH-07 | `hub.ts:73`, `appSettings.ts:174`, `boardDispatch.ts:230`, `boardDispatchRun.ts:175,706`, `boardDispatchWiring.ts:258,279` | "the Mac Studio" | "a shared studio machine" / "another machine" | 1, done |
| OH-08 | `analytics.ts:143`, `agentSyncLeases.ts:33` | the owner's growth service name, his npm scope | Neutral wording | 1, done |
| OH-09 | 97 renderer and ~120 main/shared comments "(the operator, YYYY-MM-DD)" | Dated history; no private name, path or id (the gate's third reading confirms) | Kept: the operator is a role, not a name | ruled |

### C. Hidden dependencies on the owner's companion tools (on by default, silent without them)

| ID | Where | What happens on a stranger's Mac | Decision | Wave |
|---|---|---|---|---|
| OH-10 | `types.ts:566,568` `dispatchBoardRequests`, `resumeLeftWork`; `boardDispatchWiring.ts:565-583` | Without Switchboard every request waits as `deferred-no-agent`; the switch shows on | Settings row disabled with the reason and what to install when Switchboard is absent | 2 |
| OH-11 | `boardDispatchWiring.ts:465`, `boardDispatchRun.ts:745-927` | Without Project Observatory every run fails to open its workflow; only the ops log says so | Same: an honest disabled state; a local workflow record later | 2 |
| OH-12 | `shared/ceoAgent.ts:143,147,177`, `main/ceoTools.ts:102` | The CEO's brief promises Observatory, Switchboard and Fabric Dashboards | Build that line from the servers detected on the machine | 2 (CEO-board session's files: coordinated) |
| OH-13 | `shared/ceoAgent.ts:155-158,187-190` | The brief describes PM agents giving `ceo.task` | Only when a PM responder exists | 2 |
| OH-14 | `shared/ceoAgent.ts:55,71` `CEO_RUNNERS_DEFAULT`, `CEO_MODELS_DEFAULT` | The owner's runner and model order (Hermes, BYOK GPT) | Default to the runner present; show and edit in Settings | 2 |
| OH-15 | `shared/protocolObligations.ts:196-197,317-324`, `workTools.ts:466`, `agentSurface.ts:1419` | Every coding agent is told to call `observatory_lesson` and that Fabric Dashboards lists agents | Conditional on detection | 2 |
| OH-16 | `main/accessService.ts:557` | Agents told "store it in Project Observatory's vault" | "your secret store" | 2 |
| OH-17 | `main/observatoryVault.ts:123-294`, `productConnect.ts:86`, migrations `…076`-`…082` `secret_ref` | Observatory is the only vault: on macOS without it a product connect fails after the product minted a key, which is then revoked | A built-in store (Keychain through `safeStorage`, as the voice key already does) and an up-front check; ADR needed | 3 |
| OH-18 | `main/ceoVoice.ts:13` `XAI_KEY_SLOT`, `index.ts:5461,5477` | Without the person's own key the voice reads the owner's vault slot `fabric/prod/XAI_API_KEY` | A «Ключ голоса» row in Settings (own key, or a vault slot the person names); the owner's slot written into his settings at the update, read only from there | 2 (voice session's files: coordinated) |

### D. Owner-chosen defaults a stranger inherits

| ID | Where | Default | Decision | Wave |
|---|---|---|---|---|
| OH-19 | `types.ts:556` | `agentPermissions: 'fewer-prompts'` | First run asks; the owner's saved value is kept (his `settings.json` holds the key explicitly, read 2026-11-20) | 2 |
| OH-20 | `types.ts:564` | `trustAgentFolders: true` | Same | 2 |
| OH-21 | `types.ts:558` | `launchAtLogin: true` (a KeepAlive launch agent) | Same | 2 |
| OH-22 | `shared/accessWords.ts:35-38`, `en.ts:2366-2370` | Labels for the owner's own capabilities (`studio.move`, `agent-map.wiki`, `research-agent.fix`, `agents.improve`, `templates.update`) | Generic words only | 2 |
| OH-23 | `main/repoRoot.ts:48` | Fallback to `~/DATA/fabric` | Remove; the error already names `FABRIC_REPO` | 2 |
| OH-24 | `en.ts:654` | "(Observatory, plugins)" as the example | Generic example | 2 |

### E. Release tooling and living docs (maintainer-only, or read by a stranger)

| ID | Where | What | Decision | Wave |
|---|---|---|---|---|
| OH-25 | `scripts/lib/package-platform.mjs:7-9,37`, `.github/workflows/release.yml:181`, `scripts/test/package-platform.test.mjs` | The owner's legal name as Windows publisher and certificate subject | `vars.WINDOWS_PUBLISHER` / `vars.WINDOWS_CERT_SUBJECT`; synthetic name in tests | 4 |
| OH-26 | `scripts/release-mac.mjs:14-15,85`, `docs/launch/release-mac.md:213` | A local release described only through the owner's vault tool and slot | Plain `ASC_*` variables, the vault as one example | 4 |
| OH-27 | `toolchain.lock.json:3-4` | The owner's Mac's OS build pinned | Pin platform and architecture only | 4 |
| OH-28 | `docs/launch/**` (26 files) | "Made with ssheleg skills" footers | Remove | 4 |
| OH-29 | `docs/ANALYTICS.md:16,35,37,43,118` | The owner's personal analytics names | Neutral names, history kept | 4 |
| OH-30 | `docs/architecture/adopted-doctrine.md:12-14,126,135-136` | `~/DATA/...` and the owner's plugin cache | Links to public repositories | 4 |
| OH-31 | `docs/launch/harness-r0/checks.md:899,920`, `docs/launch/inbox.md:57`, `docs/launch/passioncode-toolkit.md:80` | Owner paths and updater | `<data-root>`; marked maintainer-only | 4 |
| OH-32 | `README.md:41,116,129-130` | Setup steps point at members-only pages | Inline the steps; mark member pages optional | 4 |
| OH-33 | `scripts/product/simple.mjs`, `renderers.mjs` (mockups) | `~/DATA` as the projects root; Observatory recommended | "your projects folder"; a generic secret store | 4 |
| OH-34 | `registry/domains.yaml` | The owner's domain portfolio (redacted), read by nothing | Move to a private repository | 4 |
| OH-35 | `scripts/build-adoption-report.mjs:37` | Personal promo link in a generated report | Remove | 4 |
| OH-36 | `scripts/lib/communicator-notify.mjs`, `bounded-run.mjs:61-68`, `workspace-release.mjs`, `install-workspace-sync.sh`, `workspace.config.json`, `.gitmodules` | The workspace publication and its failure notices use the owner's communicator, vault and DigitalOcean app | Maintainer-only, already degrading to NOT_RUN; say so in each header | 4 |
| OH-37 | `.github/workflows/release.yml:46-272`, `scripts/check-sibling-commits.mjs` etc. | Release actions and gates of the `passioncode-ai` organization | The publisher's own; documented for forks | ruled |
| OH-38 | `scripts/resourceAgentSyncIdentity.py`, `main/resourceRunAssignment.ts:148` | A source-tree path and one agent-sync version, dormant (no caller) | Fix before wiring | backlog |

### F. Tests that pinned owner values

| ID | Where | Decision | Wave |
|---|---|---|---|
| OH-39 | `shared/peopleAsk.test.ts:242-270`, `test/people-ask-run.test.mjs:16,42` | Neutral organizations and ids (`Acme`, `Roundabout`, `79000000-…`) | 1, done |
| OH-40 | `shared/peopleAsk.test.ts:79-87,225`, `test/people-ask-run.test.mjs:200` (agent names), `boardDispatch.test.ts:271-273` (a host), `projectDisplayName.test.ts:19-52` (an owner) | Neutral names | 2 |

### G. Outside this repository

| ID | Where | What | Route |
|---|---|---|---|
| OH-41 | org-index `scripts/check_private.py` (P1) | The denylist matches literal terms: the inflected «Кире» in the shipped hint passed it | Board request to org-index; Fabric's own gate covers it meanwhile through the owner's local word list |

## Wave 1, shipped in this change

- `DEFAULT_PEOPLE_ROUTES = []`; the routes file gains `projects: {<id>: {target} | {off: true}}` beside `routes`
  (`peopleAsk.ts#choicesOf`, `#withChoice`, `#resolveRoute`, `#routeTable`); the bridge honours the choice first.
- Settings: «Куда уходят вопросы» under the switch (two new main-only IPC channels, `settings:peopleRoutes`,
  `settings:setPeopleRoute`).
- `scripts/check-build-private.mjs` (in `scripts/ci.sh`, after the build): three readings of the BUILT app, values never
  printed. (1) The org checker over a copy outside Git. (2) Product patterns: `~/DATA` and `/DATA/<repo>`, vault slots,
  home paths. (3) The values of this machine's own Fabric settings (routes, dispatch targets, chosen projects) and a
  local word list `~/.config/passioncode/fabric-owner-terms.txt` (never committed), matched as whole words. Watched
  catching a plant: the 0.3.27 hint line and the old route line from `37d69d6a` fail it, a word such as «фиксирую»
  does not (`scripts/test/check-build-private.test.mjs`).
- Comments OH-06 to OH-08.

The owner's own work is unchanged: his machine's routes file keeps every route, his `settings.json` keeps every value,
and nothing is migrated because nothing moved out of code that he did not already hold locally.

## Coordination

Fabric sessions working in this repository on 2026-11-20 (`fabric_work_list`): 8343a070 (CEO board, CEO window) and
9cda1c0f (voice). This change touches one comment line in `shared/ceoAgent.ts` and no voice file. OH-12 to OH-14 are in
the CEO session's files and OH-18 in the voice session's: wave 2 takes them after those sessions land, under the
lease `FABRIC-OWNER-HARDCODE`.

## For the strategic plan (input, 2026-11-21)

The owner paused new work on 2026-11-21 (about 00:30 Warsaw) until the strategic plan is written (fabric-workspace
session 2d03ce15). This report is its input on one question: what has to change for Fabric to be a product a stranger
installs. Wave 1 had already been written and checked when the pause came, so it was finished rather than rolled back;
waves 2 to 4 are NOT started. What the plan should decide:

1. **Companion tools: required, optional, or replaced.** Observatory (vault, workflows, lessons), Switchboard (sessions,
   dispatch) and a PM agent (people.ask) are assumed by default-on features (OH-10, OH-11, OH-15, OH-17). Options: each
   feature honestly off with a reason and an install link (wave 2, cheap); Fabric's own store and workflow record (wave 3,
   an ADR); or the PassionCode launcher installs them as part of Fabric.
2. **First-run defaults.** The owner's choices (fewer prompts, trusted folders, launch at login, dispatch and resume on)
   are every stranger's defaults (OH-19 to OH-21). His saved values stay either way; the decision is what a new person
   is asked or given.
3. **The CEO for a stranger.** Its brief, runners and models are the owner's (OH-12 to OH-14); it should be built from
   what the machine has.
4. **Localization of what agents and PM agents read** (OH-05): Russian today whatever the locale.
5. **Release tooling** (OH-25 to OH-36): maintainer-only is acceptable for the organization; a fork or a second
   maintainer needs the variables named.

Board tasks for the waves (backlog, spawned from 6888ff30): wave 2 `e00c1391`, wave 3 `661c91fe`, wave 4 `bf004338`.

## Handoff

- **Objective:** nothing of the owner in what ships; his values in his settings (the owner, 2026-11-20).
- **Done:** the inventory (this report, OH-01 to OH-41); wave 1 (OH-01 to OH-03, OH-06 to OH-08, OH-39) and the build
  gate; branch `audit/owner-hardcode`.
- **Open:** waves 2 to 4 (board tasks above), held by the owner's pause; OH-41 sent to org-index on the board (thread
  `cfb47d77`, a finding).
- **Decisions:** no migration for the routes, because the owner's machine already holds every route in its routes file
  (read 2026-11-20); `use_secret.py` inside the Observatory adapter is not a machine value (the adapter is optional), so
  the gate does not flag it; the owner's word list for the gate lives only on his machine
  (`~/.config/passioncode/fabric-owner-terms.txt`, written 2026-11-20, mode 0600).
- **Checks run** (worktree of `audit/owner-hardcode`, 2026-11-20 and 21): `bash scripts/ci.sh fast` exit 0 (the run
  before it failed once on `test/claude-owned-stdio.test.mjs` at load average 133; that test alone passed 3 of 3);
  `node scripts/check-build-private.mjs` PASS on the build, and a plant of the 0.3.26 hint line and the old route line
  caught; `vitest SettingsScreen.test.tsx` 36 passed, and a planted defect (the «off» choice not saved) caught;
  `shared/peopleAsk.test.ts` 29 passed; `test/people-ask-run.test.mjs` 24 passed; the copy check of the 24 Russian
  strings: no blocking finding ([copy-check-wave1.txt](copy-check-wave1.txt)).
- **Not run:** `scripts/ci.sh full` (the stack-backed probes); a launch on a clean macOS profile (a fresh user with no
  `~/DATA` and none of the owner's services), which is wave 2's exit check, on a separate macOS user or the Mac Studio,
  since a second Fabric on this Mac would share the owner's Docker stack; the screens stand in a browser.
- **Next task:** after the strategic plan, wave 2 (`e00c1391`) as the plan orders it; first take the CEO and voice files
  only after sessions 8343a070 and 9cda1c0f have landed theirs.
