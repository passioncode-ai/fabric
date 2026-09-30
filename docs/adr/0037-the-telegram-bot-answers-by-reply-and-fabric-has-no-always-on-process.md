# ADR-0037 — The Telegram bot answers by reply, reads nothing it was not given, and Fabric has no always-on process

**Status:** accepted · 2026-09-05 · extends [ADR-0035](0035-the-board-is-a-query-and-the-ceo-is-a-mechanism-before-it-is-an-agent.md), [ADR-0036](0036-the-ceo-settles-what-it-can-cite-and-trust-is-autonomy-on-a-different-subject.md) · design in [`../architecture/telegram-surface.md`](../architecture/telegram-surface.md)

## Context

The operator asked for a Telegram bot that can be added to a work chat and tagged
there — analysing the conversation, asking a clarifying question if it needs one,
then answering — plus notifications to a DM, a channel, or both, routed per
project, with a nightly digest and the ability to have the CEO build new
notifiers on demand.

Two of those requirements are impossible as stated, and a third is impossible for
a reason that is **about us rather than about Telegram**. Finding that out before
building is the whole value of this record.

Measured against Bot API 10.3 via the `telegram-bots` skill (read 2026-08-25),
and against this tree today.

## Decision

### 1. Refuse MTProto. A bot reads what it is given, and nothing before it arrived

> A bot cannot read messages in a group without privacy mode off or a mention,
> see a chat it was never added to, **read history from before it joined**, or
> act on behalf of a user.

"Analyse the correspondence" therefore costs three things, and each is decided
here rather than discovered later:

- **privacy mode off**, a BotFather setting, after which the bot receives *every*
  message in that group — a consent decision about a work chat, not a toggle;
- **storage**, because there is no history to fetch: the thread a model would
  read is the thread *we have been keeping* since the bot joined, with a
  retention window;
- **a user account** if either of those is unacceptable — and that is **refused**.
  A session file is a logged-in human, revocable by them and bannable by
  Telegram. A work chat is not worth an account.

### 2. Fabric has no always-on process, and the design says so instead of pretending

Every scheduled thing in this product is a `setInterval` in the Electron main
process. There is no server and no public endpoint. Three consequences are
accepted rather than worked around:

- **Long polling, never a webhook** — and `getUpdates` will not work while a
  webhook is set, so this is one token with one consumer, recorded here so nobody
  wires the other half later and takes over a live token.
- **A nightly letter cannot be promised at a time.** It is sent on the next
  launch, **labelled with the window it covers and with the fact that it is
  late**. Two missed days are two letters; merging them destroys the day boundary
  the letter exists to draw.
- **Inbound is deaf while the app is closed**, and Telegram keeps updates for
  24 hours. Under a day the backlog drains; over a day it is gone and nothing
  says so, so reconciliation is from our own state.

The honest fix is a small always-on relay, which is the hosted estate at ADR-0016's
horizon 4. Naming it here means the local version ships knowing what it is.

### 3. The daily loop is REPLY-TO-ANSWER, and it needs no model

The bot posts a question; the operator **replies to that message**;
`reply_to_message.message_id` identifies the question exactly. No parsing, no
understanding, no ambiguity.

This is the finding that decides the build order. The loop the operator described
— open Telegram, answer what is waiting, leave — works with **no provider at
all**, because a reply carries its own addressing. A bare mention in a group is
the only part that genuinely needs a model, and until there is one it is answered
with an honest refusal naming what does work, not with a fabricated answer and
not with silence.

### 4. Authority requires a binding, and binding starts in the app

Anyone in a group can message the bot. Answering a Board question settles estate
state, so a Telegram user carries no authority until bound to a person: the app
issues a short-lived code, redeemed in a **direct message**.

Starting the flow from Telegram would let anyone claim to be the operator by
asserting it. Redeeming in a group would publish the code to every member.
Refusals leak nothing — not the estate's name, not whether it exists.

### 5. A group is told less than a DM, by default, and widening is an act

A group sees everything the bot posts. Questions, answers and the letter go to a
DM by default; a project is widened only by an explicit, **journalled** act, so
"who decided this channel could see the questions" stays answerable. A refused
effect and its grant are **DM-only always** — issuing a grant is an authorisation
act and does not belong in a room.

### 6. `route` and `mute` are two switches, because they answer two questions

- **`route`** — *where* a kind goes, per project, inheriting the estate.
- **`mute`** — *whether* a source may raise a kind at all, keyed on
  (project, agent, kind).

"The developer sends nothing here, the marketer does" is a mute. "This project
goes to #ops" is a route. A single per-project on/off would have forced the
operator to pick which meaning they wanted.

**A mute may never cover `refused`.** A muted grant request is a session blocked
forever with nobody told, so the combination is refused rather than accepted
quietly.

### 7. Every outbound message is a row before it is a send

`update_id` is the only idempotency key inbound, claimed by INSERT — and measured
across eight live bots on this machine, **zero deduplicate on it**.

Outbound, the same discipline in the other direction: `queued → sent → confirmed`,
with Telegram's `message_id` stored because editing later needs both ids, and
`retry_after` honoured **exactly** rather than with a backoff that either wastes
the window or trips the next one. A failed message is retried **from its row** —
regenerating a digest an hour later produces a different digest, and the operator
would receive two letters that disagree.

### 8. A notifier is composed from parts that already exist

`routine + agent + delivery target + template`. Agents with their own
instructions, schedules, event triggers, agent-to-agent chains and external tool
access all exist; **the delivery step is the only new part**. Composing means the
notifier inherits the loop bound, the chain depth limit, the grant floor and the
quota gate without any of them being rewritten.

Creating one without a model is a form; with a model it is a sentence. The form
is not a placeholder — it is what the sentence would produce, and it stays the
thing that can be inspected and corrected.

## Consequences

- The **operator's day moves to Telegram** at build step 4, and the app becomes
  what runs while they are not looking. That is the product's own claim, made
  operable.
- **The bot is deaf and mute while the app is closed.** Stated in the interface,
  not discovered: the connection screen says when it last polled.
- **Message capture is off by default** and is a per-chat consent with a retention
  window. It is built before the model tier because it is the expensive half and
  is useful alone as a record.
- **A clarifying question is not a Board question.** It is a turn in a
  conversation and expires with the thread; putting it on the Board would fill
  the operator's queue with the bot's own small talk.
- Routes, mutes, bindings and captures are **journalled** because they are
  decisions. The outbox, the seen-update table and captured messages are
  **operational and not journalled** — a rebuild from the journal must not resend
  yesterday's notifications, and the surest way to guarantee that is for the
  journal not to contain them.
- The bot token has the same custody as the Supabase service key: main process
  only, from the keychain, never in a session bundle, never in the renderer.

## Refused

- **MTProto / a user account** to read history. The liability is not worth a work
  chat, and `telegram-userbots` says to read its refusal first for this reason.
- **A webhook.** No public endpoint, and `getUpdates` stops working the moment
  one is set — a trap for whoever wires the other half later.
- **A nightly letter promised at a time.** We cannot keep it. It is labelled late
  instead.
- **A fabricated answer to a mention.** Without a provider the bot says what it
  can actually do.
- **A single per-project notification switch.** It collapses two questions into
  one and makes both unanswerable.
- **Silencing a grant request.** A blocked session nobody is told about is the
  worst failure available on this surface.
