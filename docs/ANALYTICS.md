# Usage analytics

**State:** built 2026-10-05 on the operator's request
([passioncode-ai/fabric#12](https://github.com/passioncode-ai/fabric/issues/12)), not yet released. It
sends only from a release build that carries an App Key. Source:
[`apps/desktop/src/main/analytics.ts`](../apps/desktop/src/main/analytics.ts); wiring in
`apps/desktop/src/main/index.ts#usage-analytics-wiring`; the switch is
[`UsageCountsSetting.tsx`](../apps/desktop/src/renderer/src/UsageCountsSetting.tsx) (SCR-52, SCN-134).
Fabric Switchboard is the reference: its
[docs/ANALYTICS.md](https://github.com/passioncode-ai/fabric-switchboard/blob/main/docs/ANALYTICS.md) uses the
same file, fields and rules.

Fabric counts installs, days of use and what is connected. PassionCode can then see how its apps are used, and
one person using several PassionCode apps counts once. Events go to the self-hosted Aptabase at
`https://analytics.sshlg.me` (`ssheleg/sshlg-analytics`, its `docs/client-contract.md`).

## What is sent

Every event carries:
- the app version and the OS name;
- an SDK tag (`fabric-analytics@1`);
- an Aptabase session id;
- `props.install_id`, the shared installation id below.

Nothing else identifies the machine or the person.

| Event | When | Props (besides `install_id`) |
|---|---|---|
| `app_installed` | first start of Fabric on this machine (once, kept in `<userData>/analytics-state.json`) | the counts below; `first_passioncode_app`: no PassionCode app had run here before |
| `app_started` | every start | `launch`: `ordinary`, or `background` (`--background`, the lifecycle broker) |
| `app_active` | once per UTC day while Fabric runs, window open or not | `projects` (active projects of the estate), `products_connected`, `agents_with_access` (live access bindings) |

A count Fabric cannot read is left out of the event, never sent as zero.

**Never sent:** project, agent, product or person names; e-mail addresses; paths; ids other than
`install_id`; message or task content; provider answers or errors. Props pass `cleanProps`, which keeps only
finite numbers, booleans, and strings from a fixed list of kinds (`KNOWN_KINDS`): a free string could carry a
name however short it looks. The test "events carry counts and the installation id, never a planted name,
path, e-mail or id" (`apps/desktop/test/analytics.test.mjs`) plants all four and fails if any reaches the
server.

## The shared installation id

All PassionCode apps share one file:

| OS | Path |
|---|---|
| macOS | `~/Library/Application Support/PassionCode/installation.json` |
| Windows | `%APPDATA%\PassionCode\installation.json` |
| Linux | `$XDG_CONFIG_HOME/PassionCode/installation.json` (else `~/.config/…`) |

```json
{ "version": 1, "id": "<random UUID v4>", "analytics": true, "created_at": 1791165882 }
```

- **Created once** by whichever app starts first. It is written to a temporary file and hard-linked into place,
  which fails if another app created it at the same moment; that file is then read instead (test "two
  processes racing to create it end with one id between them").
- **Never repaired.** A file that does not parse, or whose `id` is not a UUID v4, is left exactly as it is, and
  analytics stays off. A file someone removed is not recreated by a running Fabric.
- **Unknown fields are kept** when Fabric rewrites it.
- **`analytics: false` turns analytics off for every PassionCode app on the machine.** Settings → *Share
  anonymous usage counts* writes it, and turning it off drops events still waiting. Fabric re-reads the file
  every hour, so another app's switch takes effect within that hour.

## Delivery

- Batches of at most 25 go to `POST /api/v0/events` with the `App-Key` header. A send never blocks a Fabric
  operation.
- Transport errors, `429` and `5xx` keep the batch and retry after 60 s, then every 10 min. `400` and `404`
  drop it.
- At most 200 events wait, in memory only; anything older than 23 h is dropped (the server refuses a day-old
  event). Nothing is written to disk but the small state file.
- Each send is one `analytics.flush` line in the operations log, with its outcome and event count.
- Quitting does not wait for a send ([lifecycle](https://github.com/passioncode-ai/fabric-workspace/blob/main/knowledge/lifecycle.md)).

## Which builds send

`FABRIC_ANALYTICS_APP_KEY` is read at build time by `apps/desktop/electron.vite.config.ts` (`define`). Only
the release workflow sets it, from the `release` environment's secret of the same name. That secret holds the
App Key of the Aptabase app *Fabric* (vault `sshlg-analytics/prod/APTABASE_APP_KEY_FABRIC`). Source builds,
forks, `pnpm dev`, tests and the smoke check send nothing, and Settings shows the switch as unavailable with
the reason.

## Reading the numbers

Read them in the Aptabase dashboard at `analytics.sshlg.me` (app *Fabric*). Cross-app questions, such as one
`install_id` across apps, go through ClickHouse, which `sshlg-growth` queries. Registering Fabric in growth's
app registry is growth's task.
