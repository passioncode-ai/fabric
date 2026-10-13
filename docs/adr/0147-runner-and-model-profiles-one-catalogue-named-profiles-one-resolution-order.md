# ADR-0147 — Runner and model profiles: one catalogue, named profiles, one resolution order

**Status:** accepted.
**Date:** 2026-10-11. **Decided by:** Fabric, on the operator's request relayed by a private product agent (to think the whole system through, split it across the projects and give
every agent its task): runner and model profiles across the estate are Fabric's main task
(CO-261, release 0.4.0 REQ-45), decided here and in a fabric-agent-contract decision written by its owner session
(fabric-agent-contract-75). **Input:** the proposal
`2026-10-11-runner-and-model-profiles.md`
(kept in the private product agent's repository at `9f05a3f`), adopted with the refinements below. **Relates to**
[ADR-0119](0119-acp-is-the-generic-runner-drive-and-runners-are-catalogue-rows.md) (runners are catalogue rows),
[ADR-0125](0125-an-agent-launch-may-follow-the-operators-fallback-order.md) (the fallback order),
[ADR-0144](0144-one-delegation-model-fabric-issues-the-chain-the-callee-checks-it-observatory-meters-it.md) (the grant
and the meter), DEC-0037/0038 (spend levels and `modelClasses`).

> **Redacted 2026-10-13 under [ADR-0096](0096-dated-records-are-redacted-for-publication.md):** the names of the operator's private agents, their sessions, repositories, paths and limits are replaced by neutral words, and the operator's request is paraphrased in English (ADR-0096 §5); details kept in the operator's private records. Nothing this record finds or decides changed.

## Context

Nine agents keep local model tables and price lists (the proposal §2: the private product agent, Copylot, research-agent, Mobile
Publisher, analytics, Asset Foundry, webpilot, nicegramappbot, Observatory's assistant); Switchboard holds its own
OpenRouter key and Hermes model. The contract has a runner catalogue (DEC-0016, `runners.md`, Fabric ships
`registry/runners.json`), runner routes and fallback (DEC-0026/0029) and usage by model (DEC-0021/0027), but no model
catalogue, no model profile, no estate default with overrides, no subscription-versus-key route and no vocabulary for
`modelClasses`, so an L1 policy naming model classes cannot be checked. Measured 2026-10-11 through OpenRouter's
Anthropic Messages endpoint: DeepSeek V4 Pro, Qwen 3.8 Max, GLM 5.3 Prime, MiniMax M3, Devstral, Gemini 3.8 Flash,
Grok Build and Claude Haiku/Sonnet 5.5 all call tools; OpenAI models are refused for this OpenRouter account (an operator
matter).

## Decision

1. **Four objects, one home each.**
   - **Model catalogue** — every usable model: id, family, `classes` from a closed vocabulary, the endpoints it serves
     (`anthropic-messages`, `openai-chat`, `responses`), tool-use status (measured / blocked, with reason and date) and a
     price by reference to the live feed. Schema in the contract; the estate's catalogue is Fabric's
     `registry/models.json`, versioned with the app; prices and the weekly tool-use probe come from Project Observatory,
     which marks a model that starts failing as blocked.
   - **Model profile** — a named, ordered list of catalogue ids with a fallback policy (`none`, or `between-turns`):
     `default` (DeepSeek V4 Pro first), `max-qwen`, `max-glm`, `cheap`, `code`, `frontier-claude`. Schema in the
     contract; the estate's profiles in Fabric (`registry/model-profiles.json`); an agent may declare its own.
   - **Runner profile** — a runner kind from the catalogue + a **route** (`subscription`: the operator's own login in the
     vendor's own runner; `key`: an Observatory-issued key) + a model profile. Schema in the contract, extending
     `runners.md`; Fabric's runner catalogue stays `registry/runners.json`, and `shared/agents.ts` is generated from or
     checked against it, never a second list.
   - **Resolution** — which profile applies: the request's, else the agent's own setting, else the binding's/project's,
     else the estate default. An L1 `modelClasses` policy **restricts** the resolved set and never chooses; an empty
     intersection refuses the launch with the policy named. One rule in the contract, implemented once in the kit.
2. **A subscription only in its vendor's runner.** A Claude login is used only by Claude Code, a Kimi login only by Kimi
   Code, a ChatGPT login only by Codex; any other runner on any model takes the `key` route. Subscription routes spend no
   money and are not metered; key routes are Observatory keys with a monthly ceiling and a **model allow-list equal to
   the profile's ids**, metered by the grant meter (ADR-0144) inside L0, the estate's USD 1,000 a month.
3. **The operator chooses once, in Fabric.** Settings → Agents & access gains the estate defaults — a default runner per
   kind of work and a default model profile per class of work — and an override per agent and per project; Fabric
   writes them into the bindings (the grant's `modelClasses`, the binding's profile names), and agents read them through
   the kit. Fabric Dashboards shows the truth per agent: configured runner, model and route from its well-known, spend by
   model from usage, budget left from the meter; it links to Fabric to change it.
4. **An agent declares what can be configured.** Its well-known (or capability answer) names its configurable slots
   (`runner`, `model`) and shows the resolved profile read-only (the private product agent's capability answer is the
   reference); usage reports carry `route` beside `model`.
5. **Headless drives** for the shared kinds the catalogue lacks: `pi-json`, `opencode-json`, `kimi-stream-json`, with
   `pi` named a shared kind.

## Consequences

- **The contract decides the wire** (T2): the `modelClasses` vocabulary, the catalogue, model-profile and runner-profile
  schemas with the measured models as fixtures, the subscription rule and the resolution order as semantic rules, the
  drives, the well-known slots, `route` in usage, the allow-list on key routes. Owner: fabric-agent-contract-75; Fabric
  supplies this record and reviews.
- **Fabric builds** (0.4.0 wave 4, with the agent registry and REQ-36's spend policy): `registry/models.json` and
  `registry/model-profiles.json`, `shared/agents.ts` checked against `registry/runners.json`, the estate defaults and the
  per-agent/per-project overrides in Settings, written into bindings, and the launch refusing an empty L1 intersection.
- **Fabric carries Switchboard's row (T6)**, which has no live session: drop its own OpenRouter key and Hermes model,
  take the estate profile and an Observatory key (with SB-96).
- **Every other agent has a row** (the proposal §4, T3–T16), filed on its own board; until the contract decision lands,
  agents keep their local tables and the private product agent's model catalogue is the reference.
- **Two things only the operator can do** (T17): the OpenRouter account's standing with OpenAI, and moving the
  plaintext keys in `~/.hermes/.env` and opencode's `auth.json` into Observatory (BL-060). They join the operator's
  question batch.

## Amendments

### Amendment 1 — 2026-10-11: the OpenAI refusal is one key's, not the account's

Corrected by the private product agent the same day: a private analytics agent's OpenRouter key reaches `openai/gpt-6-luna` (HTTP 200),
and only that agent's key is refused «blocked for a previous policy violation». The Context's sentence and T17's first
item are therefore a key matter — that agent's BL-063 (a new key through Observatory's door, a re-probe, the old key
revoked), waiting for the operator's yes — not the account's standing. The plaintext keys of BL-060 stay as stated.

### Amendment 2 — 2026-10-11: provider routing per model

Asked by the private product agent: a catalogue entry may carry an optional `provider` routing object (`ignore`, `order`,
`allow_fallbacks`, in the shape of OpenRouter's provider routing), which the key route's proxy applies — so a model
refused by one upstream (OpenAI's own endpoint for that agent's key) is still reached through another (Azure). It
changes the route, never the model; the profile's allow-list is unchanged. Passed to the contract decision (T2/CT-05).
