# ADR-0188: Fabric reads its own logs every hour and every day; Observatory keeps what every agent learned

**Status:** accepted · 2026-11-04 · carry-over rows CO-500, CO-502, CO-503 · records the operator's words in Fabric's
session `5d9bed98` (about 17:20 UTC): «вся эта система должна логироваться … анализ логов раз в час и раз в день, и цикл
обратной связи после работы агента, цикл улучшения, для всех агентов с инсайтами … хранить централизованно на уровне
Observatory и Fabric … чётко разделить, кто за что отвечает, где хранится, как анализируется, где используется, и
записать это в Fabric» · extends [ADR-0105](0105-agent-memory-lives-in-project-observatory.md) (agent memory lives in
Observatory) · spec: [agents you can place, a status that does not lie, logs that are read](../evidence/specs/2026-11-04-agents-logs-and-the-improvement-loop.md).

## Context

Fabric writes a structured operations log (`apps/desktop/src/main/ops.ts`, JSONL in `userData/logs`, a week within
96 MB) and a journal of every run, claim, session and board message. On 2026-11-04 the log held 226 558 lines since
2026-10-21 13:18 UTC, among them 465 failed `ipc.feed:replay`, 311 failed `cycle.receipt`, 273 failed `ipc.work:home`
and 19 `stack.lost` (the spec's §1, item 3). Nothing read them: the operator learned of a failure when a screen was
wrong. Agents write lessons to Observatory (`observatory_lesson`, ADR-0105) when they remember to, and no step after
an agent's work asks for one. Who keeps what, and who reads it, was written nowhere.

## Decision

1. **Fabric keeps its own log and journal, and reads them itself.** The operations log stays local to the machine (it
   holds paths and identifiers that are the person's). Every hour the cycle folds the hour's log and journal into one
   `ops.digest.hourly@1` receipt: counts by operation and outcome, failures that rose against the previous hour,
   sessions started and left, board requests waiting. Every day it folds the hourly receipts into `ops.digest.daily@1`.
   No model reads them; the fold is arithmetic.
2. **What the reading finds reaches the operator in Fabric.** A rise in failures above the threshold the digest names
   becomes a finding in «На проверке», with the operation, the count, the hour and the previous hour.
3. **Observatory keeps what every agent learned, across machines.** Fabric sends the daily digest to Observatory as a
   record of the project `fabric`: counts and statements only, no log line, no path, no secret. Lessons, insights,
   episodes and every other product's digests live in Observatory as ADR-0105 says.
4. **Observatory reads every agent's learning once a day.** It groups lessons by class key, promotes a lesson seen in
   two projects (its corroborator) and writes one daily summary for the operator. Fabric shows its count and links to
   it; Fabric never keeps a copy of a lesson.
5. **Every agent closes its work with a retro.** When a session releases a claim `done`, or its session ends, Fabric's
   protocol obligation `retro-after-work`, served in `fabric_whoami` with the other obligations
   (`apps/desktop/src/shared/protocolObligations.ts`), asks it to write in the same turn what went wrong and what would
   have prevented it, as an `observatory_lesson`, and its product insights as `insight/1` lines. Fabric counts the
   retros asked and those written in the daily digest.
6. **Every other product follows the same split.** Its own log stays with it and is folded hourly and daily the same
   way; its daily digest and its agents' lessons go to Observatory. The fold's shape becomes part of
   fabric-agent-contract, and the adapter serves it to every adapted agent.

| | Fabric | Project Observatory |
|---|---|---|
| Keeps | its operations log (local, a week), its journal, its hourly and daily digests | agent memory: episodes, checkpoints, hand-overs, lessons, learnings, every product's daily digests and insights |
| Reads | its own log and journal, hourly and daily, with no model | every project's lessons and digests, daily; corroborates repeats |
| Uses | findings for the operator now; obligations for agents at work | answers to agents (`observatory_search`, `kinds: lesson`); the operator's daily summary; promotion of a lesson |
| Never | keeps another product's log, keeps a lesson | reads Fabric's raw log, keeps a log line or a secret |

## Consequences

- A failure that repeats is said within the hour it rose, not when a screen is found wrong.
- The improvement loop has a beginning (the retro an agent writes after work), a middle (Observatory's daily grouping)
  and an end (the lesson an agent reads at its next start through `observatory_search`).
- Fabric's work: CO-500 (the hourly and daily digests and their findings), CO-502 (the `retro-after-work` obligation),
  CO-503 (the daily digest sent to Observatory). Observatory's, the contract's and the adapter's work is asked on the
  board, thread `f7758225`.
- Until a product folds its own log, its failures stay unread; the coordinator follows that product by product.

## Amendments

- 2026-11-05, the 0.3.16 release review (DO-12): as built in 0.3.16 the hourly digest counts the operations log's
  records only (`apps/desktop/src/main/opsDigestRun.ts`); the journal's counts (sessions started and left, board
  requests waiting) of decision 1 and the retros asked and written of decision 5 are not folded yet. They stay with
  CO-500's follow-up and CO-502 in the carry-over register; the digest's schema `ops.digest.hourly@1` carries only what
  is counted.
- 2026-11-05, agreed on the board (thread `f7758225`, the contract's DEC-0153 round 1, RW-4): of the retros, Fabric
  counts only those it asked for (the `retro-after-work` obligation); a retro is counted written by Observatory, where
  lessons and records land, and Fabric says `unknown` for one written through a call it does not carry. Decision 5's
  «Fabric counts the retros asked and those written» is read that way. A closed UTC day with hourly lines and no daily
  line is folded once at Fabric's next start (DEC-0153 OD-5), so a Mac closed overnight still writes its days.
