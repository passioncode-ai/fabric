# Iteration 1 — Level 1: Scenarios, UX and UI

Change under review: `67a5dc42` "feat(hub): local agents reach cloud products through Fabric on consent (ADR-0115)".
Worktree: `<worktrees>/hubv-read` (detached at 67a5dc42). Reviewer: fresh, independent; earlier iterations not read.
Paths below are relative to the worktree unless absolute.

## Checks run

- `npx vitest run src/renderer/src/AgentAccessPanel.test.tsx src/renderer/src/launch/ObligationActs.test.tsx src/shared/access.test.ts src/shared/attention.test.ts` (apps/desktop) → 4 files, 63 tests passed.
- `node --experimental-strip-types test/consent-presenter.test.mjs` → 5 pass, 0 fail.

## Findings

Preview method: a scratch Vite harness (`scratchpad/hubv/harness/`) mounts the real `AgentAccessPanel` and `ObligationActs`
with the app's real stylesheets (`tokens.*.css`, `styles.css`, `components.css`, `launch/launch.css`), the real `I18nProvider`,
and a mocked `window.fabric.hub` whose overview is built with the real `describeAsk`/`consentFacts`/`consentText` from
`src/shared/access.ts`. Screenshots in `scratchpad/hubv/iteration-1/shots/`. The live Electron app and database were not touched.

### UX-1 — blocking — Connected-product row collapses into a one-word / three-letter column (worst in ru)

- **Evidence:** `shots/01-panel-full-en-light.png` (en: "The last attempt failed: Project Observator / y is not installed…" wrapped one word per line in a ~70px column);
  `shots/02-panel-full-ru-dark.png` (ru: "Fab / ric / Inb / ox", "под / клю / чён" — the whole row is unreadable, ~1100px tall).
- **Cause:** `AgentAccessPanel.tsx:70-86` puts BOTH Reconnect and Disconnect (`Переподключить` + `Отключить` in ru) into `Row`'s `trail`,
  and the name + server URL + since + last-outcome text into the row body; in the 360px side panel (`.ceo-panel`) the trail
  takes almost all the width and the body shrinks to its min-content. The URL (`https://inbox.example.com`) has no break opportunity, which is what forces the column in ru.
- **Fix:** put the product's acts on their own line under the text (as the agents list does with Revoke all at `:112-115`), or let the body own the row and wrap the toolbar; allow `overflow-wrap:anywhere` on the server URL. Add a render test at 360px with the ru locale and a connected product.

### UX-2 — blocking — The consent facts, ask lines, grant lines and queue title are English-only in the ru locale

- **Evidence:** `shots/02-panel-full-ru-dark.png`: under ru chrome ("Ждут вашего ответа", "Разрешить") every fact is English —
  "An agent registered as example-agent (installed by …)", "list and search mail, read mail and send mail in news@example.com",
  the same-user floor "Fabric checked that an agent with this id is installed…", "This agent already has access through Fabric; this adds to it.",
  grant lines "read mail in news@example.com", denial "send mail in the Gmail account abc123".
  Sources: `src/shared/access.ts:80-107` (PLAIN verbs), `:221-237` (`describeAsk`), `:366-367` (`SAME_USER_FLOOR`), `:381-397` (`consentFacts`),
  built in main (`src/main/index.ts` hub-ipc region, `hubOverview` handler) and passed to the renderer as finished English sentences;
  the queue title is composed in English in `src/shared/attention.ts` (`title: \`${row.name} asks to use …\``, inside `attentionOf`), shown by `BoardScreen.tsx` (`chosen.entry.title`).
- **Why it matters:** these are the exact words the operator consents on, including the honesty statement (same-user floor) the ADR requires be *said*. The renderer's own rule (M197, `i18n/index.tsx:11-14`, ratchet in `scripts/check-design.mjs:429`) is that a NEW user string lands in both locales; these bypass the registry, so the ratchet cannot see them.
- **Fix:** send structured facts (agentId, installedBy, repository, capability ids, resources, incremental flag) to the renderer and phrase them through i18n keys (en+ru), keeping `oneLine` sanitisation on the untrusted parts; or pass the locale into `describeAsk`/`consentFacts`. The native prompt (main) is English-only like the existing startup dialog (`index.ts` ~4303) — acceptable precedent, but note it in the ADR or localise it the same way.

- **Receipt that the gate cannot see it:** `node scripts/check-design.mjs` → `ok i18n: bilingual ratchet holds — ru covers 1528/1528 keys … no monolingual additions` / `PASS` — while the screenshot shows English consent facts under ru chrome.

### UX-3 — non-blocking — A request is shown as a sheet on a window the operator may not be looking at; no notification then

- **Evidence:** `src/main/consentPresenter.ts:60-63` — "on screen" is `isVisible() && !isMinimized()`; focus is not considered. A Fabric window that is open behind another app is "visible", so `present()` (`:65-67`) opens the sheet there and sends **no** notification (`:68-71` only runs when not visible). SCN-132 step 3 / FLW-75 promise a notification "with Fabric in the background". The request expires in 10 minutes (`shared/access.ts:17`), so the agent's request can lapse unseen.
- Also: requests queued while the window was hidden are only re-presented by a notification click (`bringForward`, wired at `index.ts` hub-wiring region via `notify(..., onClick)`); nothing calls `bringForward` when the window is shown or focused again, although its docstring says "or the window came back" (`consentPresenter.ts:75`). The queue row is the only remaining path.
- **Fix:** treat "focused" (`BrowserWindow.isFocused()` / `app` active) as the on-screen test and notify otherwise; call `presenter.bringForward()` on the main window's `focus`/`show`; or correct the docstring.

### UX-4 — non-blocking — Allow in the queue and in Settings → Agent access does not say what Allow in the prompt says

- **Evidence:** the native prompt (rendered via the real `consentText`, harness `?view=prompt`) says: Allow button "Allow and connect Fabric Inbox"; "If you allow, the agent gets its own credential…"; "Access lasts a year unless you revoke it…"; "Fabric Inbox is not connected to Fabric yet. Allow also opens Fabric Inbox…". The queue (`launch/ObligationActs.tsx:138-145`) and the panel (`AgentAccessPanel.tsx:92-104`) show only origin, reason, floor, incremental and a plain "Allow" (`access.allow`). Yet `index.ts` `hubDecide` handler starts the product's connect flow on Allow when the product is not connected — the operator clicks "Allow" and an external app opens unannounced. `shots/03-panel-notconnected-waiting-en-dark.png` shows "Fabric Inbox not connected" above two plain "Allow" buttons.
- The JSDoc at `ObligationActs.tsx:117-119` and `shared/attention.ts` (`AccessFacts` doc) claim the queue "says what the native prompt says — the same decision, on the same facts".
- **Fix:** carry `connected` (or the product's state) to both surfaces; label the button "Allow and connect {product}" when not connected (en+ru keys), and add the one-year / revocable line.

### UX-5 — non-blocking — "Allow" that succeeded but could not open the product reads as a failure and re-offers the buttons

- **Evidence:** `index.ts` `hubDecide`: after a recorded Allow, a failed `connector.begin` returns `{ ok:false, reason: 'Allowed. Fabric Inbox could not be opened to connect it: …' }`. Panel: `AgentAccessPanel.tsx:42,55` → banner "Not done: Allowed. Fabric Inbox could not be opened…" (contradictory). Queue: `ObligationActs.tsx:128-129` → `setState('open')` + `onError`, so Allow/Deny are offered again on an already-allowed request; a second click is refused "that request was already allowed" (`accessService.ts:210`).
- In the native-prompt path the same failure is only logged (`consentPresenter.ts:120-123`, `ops.record … hub.consent.connect failed`) — the operator is told nothing, and the product row shows a `failed` last attempt only if `begin` got as far as `openExternal`.
- **Fix:** return a distinct outcome (e.g. `{ ok:true, connect:{ ok:false, reason } }`); show "Allowed — Fabric Inbox could not be opened: … Connect it from Settings → Agent access"; in the queue settle to `allowed` and show the connect problem beside it; in the prompt path show a follow-up message box.

### UX-6 — non-blocking — The "waiting for your answer in Fabric Inbox" line never ends on its own

- **Evidence:** `main/productConnect.ts:201` settles `waiting`; it is replaced only by a callback or a later `begin` (pruning at `:184` happens inside `begin`). If the operator ignores or closes the product's prompt, `lastOutcome` stays `waiting` for the life of the process and the panel (`AgentAccessPanel.tsx:83`, `role="status"`) keeps saying "Waiting for your answer in Fabric Inbox." although the state died after 10 minutes (`CONNECT_STATE_TTL_MS`). SCR-76 lists `waiting` but no exit from it.
- **Fix:** expose `since`/expiry and show waiting only while a live state exists (or settle `failed: 'no answer within 10 minutes'` on read after the TTL); say "Try again" with Connect.

### UX-7 — non-blocking — Raw machine text reaches the operator (unreadable, hub-off and refusal reasons)

- **Evidence:** `shots/04-panel-unreadable-en-light.png`: "Agent access could not be read: Error: Error invoking remote method 'hub:overview': Error: agent access is not ready yet." (`AgentAccessPanel.tsx:28` uses `String(e)`). Hub-off reasons tell a GUI user to "set FABRIC_HUB_PORT to a free port" (`main/hub.ts:48,56`, `main/agentSurface.ts:331`) and do not say that Fabric must be restarted afterwards (the hub is only started in `bootstrapReady`; no retry). Product-connect reasons use the id, not the name: "fabric-inbox is already connected; choose Reconnect…", "fabric-inbox has no server set up yet" (`productConnect.ts:182,187,245-249`). Operator-facing refusals use internal terms: "the credential that asked has been revoked; the agent must ask again with the door token" (`accessService.ts:223`).
- The neighbouring Settings panel maps reason codes to localised words (`PrivateHistoryPanel.tsx` `reason(...)` → `history.refused`/`history.exportRefused`).
- **Fix:** strip the IPC wrapper (`e instanceof Error ? e.message : …` and drop the "Error invoking remote method" prefix) or map to codes; name the product by `productName`; for hub-off add "Restart Fabric after freeing the port" and keep the env var as a secondary detail; localise via keys.

### UX-8 — non-blocking — Queue row layout: facts and buttons share one wrapping flex row

- **Evidence:** `shots/06-board-access-row-ru-dark.png`: in the Board detail, `AccessActs` renders the four facts as `<span className="lp-meta">` siblings of the two buttons inside `.lp-actions` (`ObligationActs.tsx:70` container; `launch.css:81` `.lp-actions{display:flex;…;flex-wrap:wrap}`), so "Отказать" sits glued to the end of the last fact and "Разрешить" wraps alone to the next line. The proposal branch puts only one short meta line before its buttons, so it did not show this.
- **Fix:** render the facts as a block (`<dl class="lp-facts">` or `<p>`s) above, and the two buttons in their own `.lp-actions`.

### UX-9 — non-blocking — Pending requests are not separated or timed; repeated buttons are indistinguishable to assistive tech

- **Evidence:** `shots/01-panel-full-en-light.png`: two requests run together with no divider/heading between them (`AgentAccessPanel.tsx:93` `div.widget-list` has no own border); the inner ask list inherits `.widget-list li` row styling (`styles.css:207`, flex + bottom border + indentation from the default `ul` padding), so it looks like a separate list widget. No request shows when it expires (`expiresAt` is in the overview and in `item.access` but unused), and when it lapses it just disappears. Every request has buttons named exactly "Deny"/"Allow", every grant "Revoke", every agent "Revoke all" — no `aria-label` naming whose.
- **Fix:** one bordered card per request with the agent name as a heading; "expires in N min" (`since`/duration helper exists in `renderer/src/duration.ts`); `aria-label` e.g. "Allow Newsletter Digest"; give the inner `ul` its own class.

### UX-10 — non-blocking — Disconnect / Reconnect do not say that Fabric Inbox's previous key stays live

- **Evidence:** SCN-133 alt paths: "Disconnect → … the key itself is revoked in the product's Agent access" and "The previous key stays in the product's Agent access until revoked there." The panel's Disconnect (`AgentAccessPanel.tsx:75`) acts immediately with no confirmation and no follow-up line; Reconnect (`:74`) likewise. `access.products.*` keys (en.ts/ru.ts) contain no such sentence. An operator who disconnects believes the key is gone.
- **Fix:** after Disconnect/Reconnect show "Fabric no longer uses this key. It is still valid in Fabric Inbox → Agent access until you revoke it there." (en+ru).

### UX-11 — non-blocking — Small copy and consistency issues

- Section "Connected products" / "Подключённые продукты" lists a product that is "not connected" (`en.ts` `access.products.title`; `shots/05-panel-huboff-empty-ru-light.png`). Suggest "Products" / "Продукты".
- Dates are raw ISO slices, not localised: `connectedAt.slice(0,10)`, `expiresAt.slice(0,10)` (`AgentAccessPanel.tsx:81,120`); they also break mid-date ("2027-/10-01" in `shots/01-…`). BoardScreen formats with the locale (`toLocaleTimeString(locale, …)`).
- An agent without a registry name prints its id twice: "other-agent.work other-agent.work" (`agentName` falls back to the id, panel then prints `name` + `agentId`, `AgentAccessPanel.tsx:113`).
- SCR-76 says "the four lists; an empty list says so in words" (`docs/ux/screens.md` SCR-76 `read` state), but "Denied requests" is hidden when empty (`AgentAccessPanel.tsx:126`) — either the doc or the code.
- The connect `failed` line is rendered in body ink with `role="alert"` right after the muted "connected to … since …" with no separator or warn tone (`AgentAccessPanel.tsx:85`) — reads as one sentence: "…since 2026-10-03 The last attempt failed: …".
- The "Not recorded" follow-up box uses `type: 'question'` for an error (`consentPresenter.ts:119`); `'warning'` fits.

### UX-12 — non-blocking — No preview of SCR-76 or its entry point in the generated report

- **Evidence:** `docs/reports/product.html` SCR-76 card has the placeholder mini (`catalog-mini`) and its "Посмотреть макет" links to `#view-settings`; the only `>Доступ агентов<` in the file is the card's own `<h3>` (grep), so the settings mockup does not show the "Agent access" button either. `docs/ux/screens.md` row: "none — text spec"; product-model says the live app is the reference. Nobody reviewing the report can see the screen; the code ships 8 documented states.
- `node scripts/build-product-report.mjs --check` → `PASS` (parity only). Rebuilding previews needs `FABRIC_PLAYWRIGHT_MODULE` (not run).
- **Fix:** add a `settings`-view mockup entry for "Agent access" and an SCR-76 preview (read state with one pending request, one connected product), en and ru.

### UX-13 — non-blocking — "One side panel at a time" is broken: Agent access stays open beside Chat, Search or History

- **Evidence:** `renderer/src/App.tsx:165-166` declares Agent access as "one side panel at a time", and its own opener closes the others (`:624`). But no other opener closes it: `openChat` (`:157-162`), `onSearch` (`:613`), `onChat` (`:615`, `:659`) and `onOpenHistory` (`:622`) never call `setAccessOpen(false)`. Both panels then render (`:870-873`), each `.ceo-panel { width: 22rem; max-width: 40vw }` (`styles.css:301-303`), leaving the content column with ~20% of the window.
- **Fix:** add `setAccessOpen(false)` to the four other openers (or hold one `sidePanel` state); add a render test that opening chat closes Agent access.

## Checked and found sound

- **Native prompt copy** (`shared/access.ts:405-439`, rendered through the real function): names the agent by registry name and id, who installed it and its source; the ask in product words with sending tools called out ("send mail", "reply to mail, which sends it"), unknown tools said to be unknown (`:165`); the reason quoted as the agent's claim on one line with control/bidi characters stripped (`oneLine`, `:115-125`); the same-user floor stated plainly; one-year expiry and where to revoke; "Allow and connect Fabric Inbox" when not connected; Deny is `defaultId` and `cancelId`. Message box always has a parent (`consentPresenter.ts:94-95,115`). Plain and honest.
- **Workspace setup lines** are separate and name the risky extras ("when creating digest@example.com, also forward a copy of its mail to an address the agent chooses"; reply agent "can send mail") — `shared/access.ts:58-59,231-234`.
- **Unreadable ≠ empty:** the panel never shows "no agent has access" on a failed read (`AgentAccessPanel.tsx:27-28,57-61`; `shots/04-…`), with Try again; the Board marks the `access-requests` source as failed rather than quiet (`index.ts` attention read: `{ source: 'access-requests', error: accessError }`).
- **Hub-off:** warning banner with the reason, Connect disabled, sessions said to be unaffected (`shots/05-…`); Disconnect stays available (correct — it needs no ingress).
- **Empty states** say so in words (pending, agents) in en and ru (`shots/05-…`).
- **Connect vs Reconnect:** Connect is not offered while connected; Reconnect is the explicit act (`AgentAccessPanel.tsx:72-77`; `index.ts` hubConnect passes `reconnect` only when asked; `productConnect.ts:182`).
- **Revoke / Revoke all / Clear the denial** each act on one id and re-read the overview; "Nothing is allowed any more; the credential still identifies the agent" is honest for an agent with zero grants.
- **Queue item:** ranks with refusals (`shared/attention.ts` RANK, `boardRank.ts` OBLIGATION_BASE), estate-level (`projectId: null`), destination `here`/`consent` so the act is on the row; the decided row settles to "Allowed"/"Denied" and does not offer the act twice on success (`ObligationActs.tsx:131-136`).
- **i18n keys:** every `access.*`, `settings.agentAccess`, `needsYou.kind.access` and the nine `event.*` sentences exist in both `en.ts` and `ru.ts`; ru wording is natural. `check-design.mjs` PASS.
- **Light/dark:** panel and queue row use only app tokens; both themes legible, danger/primary tones consistent with neighbouring panels (`shots/01`, `02`, `03`, `06`). Allow-as-primary matches the proposal Accept convention in the same queue.
- **Docs ↔ code for states:** SCR-76's loading / unreadable / hub-off / read / waiting / connected / declined / failed all have a code branch (`AgentAccessPanel.tsx:56-85`); FLW-75/76 edges match the IPC handlers.

## Summary

| Severity | Count | Ids |
|---|---|---|
| blocking | 2 | UX-1, UX-2 |
| non-blocking | 11 | UX-3 … UX-13 |

Harness left at `scratchpad/hubv/harness/` (Vite dev server on :5199 was used for screenshots; not part of the repository).
