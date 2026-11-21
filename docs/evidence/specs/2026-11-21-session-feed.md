# Spec: one session's feed for «Подключить сюда» (`fabric-session-feed/1`)

Date: 2026-11-21. Status: the answer's schema, published to Fabric Dashboards before the build (board thread `3ca40854`,
Fabric's promise of 2026-11-19 in reply `8c7317e0`: «Fabric даст операцию чтения ленты одной сессии … через MCP хаба …
Схему ответа опубликую здесь до начала работы»). The owner's order behind it, 2026-11-19 (request `57445717`): on a
session's screen in another app, «подключить ее сюда, чтобы она всплывала»: its events and questions surface there.

## 1. The operation

`fabric.session.feed`, one tool of the hub's MCP surface (ADR-0115), read-only.

| Argument | Type | Meaning |
|---|---|---|
| `session` | string, a UUID | a Fabric console's session id, or the runner's own session id (Claude Code's), as `fabric://session/open` takes it (DEC-0189) |
| `since` | integer, optional | the last `seq` the caller has; only newer items come back. Omitted: the newest `limit` items |
| `limit` | integer 1..200, optional, default 50 | how many items at most |

Who may call it: a product registered on this Mac with the operator's grant `session.feed` (asked once in Agent
access, decided by the operator, revocable, ADR-0115 and ADR-0190); a coding agent's own session may read its own feed.
A call without the grant answers the hub's typed refusal `not_authorized`, never an empty feed.

Polling: a caller asks again with `since` set to the answer's `next`; every 15 s is enough (the screens' own reads use
15 s, `renderer/src/launch/paneRead.ts#PANE_REFRESH_MS`). No push in version 1.

## 2. The answer

```json
{
  "schema": "fabric-session-feed/1",
  "session": {
    "id": "uuid of the Fabric console, or null when Fabric holds no console for it",
    "runnerSessionId": "uuid of the runner's own session, or null",
    "projectId": "uuid or null",
    "projectName": "string or null",
    "state": "running | waiting | ended | unknown"
  },
  "items": [
    {
      "seq": 123456,
      "at": "2026-11-21T09:00:00Z",
      "kind": "stage | question.asked | question.answered | question.withdrawn | task.claimed | task.moved | task.released | prompt.waiting | ended",
      "text": "one plain sentence, redacted, at most 400 characters",
      "ref": { "questionId": "uuid", "taskId": "uuid" }
    }
  ],
  "waiting": [
    { "questionId": "uuid", "text": "the question", "options": [{ "id": "1", "label": "the option", "recommended": true }], "askedAt": "2026-11-21T09:00:00Z" }
  ],
  "next": 123456,
  "earlier": false,
  "degraded": []
}
```

- `items` are oldest first. `seq` is the journal's order, so `next` is the newest `seq` returned (or the caller's
  `since` when nothing is new).
- `kind`:
  - `stage`: the session's `fabric_stage_report` (its plain sentence);
  - `question.asked`, `question.answered`, `question.withdrawn`: a question the session asked and what became of it;
  - `task.claimed`, `task.moved`, `task.released`: the session's claims and the tasks it moved (title in `text`);
  - `prompt.waiting`: the console waits at a prompt on its screen (ADR-0207 Decision 6; the question in `text`);
  - `ended`: the console ended (its end said in `text`: done, stopped by the person, exited with a code).
  A later version 1 answer may carry a kind not listed here; a caller shows its `text` and ignores the rest.
- `ref` carries only ids; `text` carries no secret, no private path and no full transcript (the redaction the agent page
  uses, `shared/redact.ts`).
- `waiting`: the session's questions still open in «Нужны вы», so a caller can show them without walking the items. A
  caller that wants to answer opens Fabric (`fabric://session/open?session=<id>`; a question link is not in DEC-0040
  yet): the answer is given in Fabric, never through this read.
- `earlier`: older items exist before the first one returned.
- `degraded`: what could not be read (for example `questions`, `journal`), each a short id; an empty list says the whole
  feed was read. A part that could not be read is never shown as nothing.

## 3. Sources in Fabric

The journal's events that name the session, read the way the agent page reads them
(`shared/sessionHistory.ts#readSessionHistory`: one indexed read per key, the newest window), mapped to the kinds above;
the open questions the session asked (`questions`); the console's state from the terminal registry and the launch
journal; `prompt.waiting` from the console hand-off of task a0afb015 (ADR-0207 Decision 6). A runner session id is
resolved to Fabric's console through the launch journal, as `fabric://session/open` resolves it.

## 4. Build and dates

The build follows this schema in the next Fabric release after 0.3.28 (its review is under way), with a contract test
per kind, the refusal without the grant, `since` paging and a degraded part. Fabric Dashboards builds «Подключить сюда»
on it. A change to the shape is `fabric-session-feed/2`; version 1 keeps answering.
