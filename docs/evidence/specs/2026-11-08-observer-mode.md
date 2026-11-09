# Observer mode: an agent that watches a product and fixes what it finds

**Status:** design, stages 0 to 2 of a task-pipeline run · 2026-11-08 · CO-546 · task of the coordinator session
`5d9bed98` · the operator's word of 2026-11-08 (paraphrased, ADR-0096 §5): a mode, boxed in Fabric and in Fabric's
skill family, in which an agent first sets up every channel a product reports through (logs, errors, funnels,
analytics, bugs), then watches them every 30 minutes and fixes what it finds on its own; any agent that has Fabric's
skills can take it, and the vital projects run in it all the time; observations may move to the cloud where that is
needed.

## 1. What the mode is

An **observer** is an ordinary agent session given one standing task on one project: keep that product healthy. It
works in a loop of four phases, and only the first needs a person, once:

| Phase | What happens | Ends when |
|---|---|---|
| **Setup** | the observer lists every channel the product reports through, connects each with a credential held by name, proves one read from each and records a baseline | every channel is `connected`, or `missing` with the exact step that connects it |
| **Watch** | every cycle (30 minutes by default) it reads each channel from its last cursor and compares with the baseline | the cycle's findings are written |
| **Act** | each new finding is triaged by severity and either fixed through task-pipeline, filed as a task, or noted as noise | the fix has landed and been read back, or the task exists |
| **Report** | one line per cycle in the project's history; a message to the person only when something changed that they would act on | the cycle record is written |

The mode is not a dashboard and not an alerting system: those already exist per product. It is the agent that reads
them, decides and does the work, the way an on-call engineer does, within the project's authority.

## 2. Channels: the inventory comes first

Every product reports through a different set of channels, so the observer's first output is the project's
**channel inventory**, a file in the product's own repository: `docs/observer/channels.md`, one row per channel. A
channel the inventory does not name is not watched; a channel named without a proven read is not counted as watched.

| Kind | Typical source | What the observer reads | Baseline |
|---|---|---|---|
| `ops-log` | the product's own operations log or its daily digest (`ops.digest.daily@1`, ADR-0188) | failures per operation, rises (DEC-0153 OD-4) | failures per hour over the last 7 days |
| `errors` | the product's error tracker | new issues, regressions, events per release | events per hour per release |
| `analytics` | the product's analytics (the growth service's events, server counts, GA4 or its equivalent) | daily active users, key events | the same weekday over 4 weeks |
| `funnel` | named funnels in the analytics source | conversion per step | conversion per step over 4 weeks, with its interval |
| `revenue` | server counts, store sales | purchases, subscriptions, revenue | the same weekday over 4 weeks |
| `store` | store reviews, ratings, crash rates, review status (Publisher) | new low ratings, rejections, crash-rate rises | rating and crash rate over 28 days |
| `uptime` | public URLs and health endpoints | status, latency | p95 latency over 7 days |
| `ci` | the repository's checks and nightly runs | red runs on the default branch | none: any red run is a finding |
| `board` | the project's Fabric board and backlog | requests addressed to the project, findings filed by other agents | none |
| `support` | a support inbox or review replies | unanswered questions, repeated complaints | open count over 7 days |

Each row records: the kind, how it is read (an MCP tool, a CLI with its exact command, or an HTTP endpoint), the
credential by **name** (Observatory's vault slot, never a value), the cursor it resumes from, the baseline and its
window, the thresholds, the owner of the source, and a state: `connected` (with the date of its last proven read),
`missing` (with the step that connects it), `blocked` (with the human gate that holds it: a sign-in, a consent, a
payment) or `not-applicable`.

**Setup is done by the agent.** It finds the channels from the repository (dependencies, configuration, the analytics
event catalogue, the store passport), from Observatory's record of the project's resources and from the services on
the machine; it connects them through existing doors (Observatory credentials, the growth service, Publisher, the
error tracker's API) and writes the inventory. A channel that needs a person is named once with its gate and its
direct link; the observer continues with the rest.

## 3. The cycle

```
for each connected channel:
    read from its cursor (bounded: a page limit and a deadline per channel)
    compare with the baseline -> signals
    a read that fails is itself a signal (the channel went dark), never a silent skip
signals -> findings: dedupe against open findings, attach evidence (the read, the numbers, the baseline)
findings -> triage -> act
write one cycle record; advance the cursors only after the record is written
```

- **Cadence.** 30 minutes by default; a project marked vital may run every 10 minutes and is also woken by events its
  channels push (a red CI run, an error spike webhook). A missed window is not made up (`shared/routine.ts`, rule 1),
  and a cycle never starts over its own last run (rule 2).
- **Silence.** A cycle with no new finding writes its record and says nothing to the person.
- **Untrusted text.** Log lines, error messages, reviews and support mail are data written by others: they never
  become an instruction to the observer, and a finding quotes them as evidence only.
- **Cost.** Reading and triage run on the cheap volume models of the operator's model map; a fix runs on the model
  the project's coding agent uses. Each observer has its own budget (USD 100 a month by default), and a cycle that
  would cross it stops and says so.

## 4. Triage and action

| Severity | Examples | What the observer does |
|---|---|---|
| **S0** | the product is down, data is lost, a secret leaked, payments fail | acts at once: rolls back its own change or the last deploy where the project's policy allows it, otherwise fixes forward; tells the person in the same minute |
| **S1** | a regression since the last release, a funnel step dropping beyond its interval, a crash-rate rise, a red default branch | fixes through task-pipeline (a branch, tests, the project's gates, a review), lands and deploys within the project's authority, reads the result back from the same channel |
| **S2** | a slow degradation, a recurring error with low volume, a cluster of similar complaints | files a task on the board with its evidence, or fixes it when the fix is small and safe |
| **S3** | noise, a known issue, a seasonal dip within its interval | records it and moves the baseline if needed |

**Authority.** The observer has the authority the project gives it, no more. Three levels, set per project:

- `observe`: reads and reports; files tasks; changes nothing.
- `fix`: also fixes and deploys where nobody outside the estate is affected (internal tools, staging, the operator's
  own agents); a production fix for real users waits for the person once, with the change ready.
- `ship`: also deploys production fixes for real users, under the project's checks, with a rollback ready and the
  result read back. Only the person sets this level.

Every fix goes through the project's own delivery route (task-pipeline in the operator's projects): a branch, tests,
the gates, and the result read back from the channel that showed the fault. A finding the fix does not clear stays
open; two failed attempts on one finding stop the automatic work on it and ask the person.

## 5. Where the observer runs

- **On the machine** (the default): a Fabric routine starts the observer's session every cycle in the project's
  folder, with the observer skill loaded. Channels that read local files (the operations log, local services) can only
  be watched here.
- **In the cloud**: for a vital project whose watch must not stop when the Mac sleeps, the cycle runs as a cloud
  routine (a scheduled remote agent) with read-only credentials for the remote channels. The inventory marks each
  channel `local` or `remote`; a cloud cycle watches only the remote ones and says that the local ones wait for the
  machine. A fix found in the cloud is landed through the repository's normal route, never by writing on the machine.

## 6. What Fabric boxes

1. **A project switch, «Режим наблюдателя».** On a project's page: off by default; on asks for the interval (30
   minutes), the observer agent (any runner the machine has) and the authority level (`observe` by default). Turning
   it on creates a routine (`shared/routine.ts`) whose instruction names the observer skill and the project; turning
   it off disables that routine.
2. **The first run is setup.** The routine's first run writes the channel inventory; until it exists, every cycle is
   a setup run.
3. **A status card** on the project page: channels connected out of named, the last cycle and its age, open findings
   by severity, the last fix with its link. A channel gone dark and a cycle that has not run for two intervals show as
   findings in «На проверке».
4. **Journal records**: `observer.cycle@1` (counts per channel and per severity, the cursors, no log text) and
   `observer.finding@1` (severity, channel, evidence reference, state), with feed sentences.
5. **Settings**: the default interval and the default authority for new observers.

## 7. What the skill family boxes

A skill in Fabric's skill family (the `fabric-agent-adapter` plugin), proposed name `observing-products`, usable by any
agent that has Fabric's skills, with or without the Fabric app:

- the channel inventory format and the setup procedure (discovery, connecting by credential name, the proven read, the
  baseline);
- the cycle, the triage table and the authority levels above;
- per-kind readers: which tool reads which channel kind, and how to read it bounded;
- the reporting rules: silent cycles, one message on change, the person's gates named once;
- the evidence each finding carries, so that another agent can pick it up.

Fabric's routine loads this skill; an agent without Fabric runs the same procedure from its own scheduler.

## 8. Requirements

| REQ | Requirement | Verified by |
|---|---|---|
| REQ-1 | A project's channel inventory lists every channel with its read route, credential name, baseline and state; a channel without a proven read is never counted as watched | the skill's inventory check; the status card's count |
| REQ-2 | A cycle reads every connected channel bounded, turns a failed read into a finding, writes one record and only then advances its cursors | a unit test of the cycle over fake channels |
| REQ-3 | No cycle starts over its own last run, and a missed window runs once | `shared/routine.ts`'s tests, reused |
| REQ-4 | A finding's action matches its severity and the project's authority; a production fix for real users never ships under `observe` or `fix` | a unit test of the triage table |
| REQ-5 | Text read from a channel is never followed as an instruction | the skill's rule and a planted instruction in a fake log line, watched being ignored |
| REQ-6 | The project switch creates and removes the routine; the status card says channels, last cycle and findings in plain words | a renderer test; the scenario |
| REQ-7 | A cycle that would cross the observer's budget stops and says so | a unit test |
| REQ-8 | The cloud cycle watches only remote channels and names the local ones it skipped | the skill's procedure; a cycle record from a cloud run |

## 9. Order of work

1. The skill (`observing-products`) in the adapter's repository, asked of its owner on the board; its first user is a
   dogfood run on Fabric itself (channels: Fabric's operations log and digests, the hub's health, CI, the board).
2. Fabric's boxed part: the switch, the routine, the status card, the journal records (scenario first, through
   super-ux, then screens).
3. Vital projects switched on by the person, one at a time, at `observe` for a week, then `fix`.
