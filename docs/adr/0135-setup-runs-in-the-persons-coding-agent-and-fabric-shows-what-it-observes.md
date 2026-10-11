# ADR-0135 — Setup runs in the person's coding agent, and Fabric shows what it observes

**Status:** accepted · 2026-10-11 · operator decision D-04 of the
[0.4.0 plan](../evidence/plans/2026-10-11-release-040-agents-first.md#decisions) · refines
[ADR-0129](0129-onboarding-is-four-actions-and-agent-work-runs-in-the-coding-agents-console.md) §4 («Fabric checks
the skills and installs nothing») and [ADR-0119](0119-acp-is-the-generic-runner-drive-and-runners-are-catalogue-rows.md)
§2 (a hub entry in an agent's user config is a separate, consented, reversible act) · implements the knowledge base's
principle 8 *Agents first* and roadmap row RM-09 · plan row P-16, canvas node C5, REQ-09…REQ-12, REQ-35.

## Context

On a clean machine the two agent actions of the first run stop on a command the person must type in a terminal
(`npx @passioncode-ai/passioncode@latest update`), Claude Code is shown «Ready» without a sign-in, and nothing
connects Fabric to the person's coding agents or installs the family's products (review F-02, F-03, F-06). The
operator decided (D-04) that the coding agent does the setup in a console Fabric opens, one consent per step, and the
interface shows the result. The family recorded the same split on 2026-10-10 (`knowledge/agents-first.md`): the
coding agent runs the setup and the proving calls; sign-ins, consents, secrets and subscriptions stay the person's.

## Decision

1. **The first run's step 2 offers «Set up with <agent>»**, which opens a **Setup console**: the person's coding
   agent, started by Fabric with a setup brief and Fabric's session surface. The brief's order lives in one place,
   `knowledge/agents-first.md` (R-10); Fabric renders it, as does Fabric Dashboards' Setup console.
2. **The order:** machine readiness (Docker engine, the Supabase CLI, the engine not exposing ports to the LAN —
   CO-219) → the adapter skills (the launcher's `update`) → Fabric's MCP in each detected coding agent, by that
   agent's own CLI (`claude mcp add …`, `codex mcp add …`, `kilo mcp add …`) pointing at `fabric-mcp`
   ([ADR-0134](0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md)), followed by the proving
   call `fabric_whoami` → the family products one at a time (download; `SHA256SUMS` verified with
   `gpg --verify SHA256SUMS.asc` against the organization key and `shasum -c`; the platform's own check — `spctl`
   and the staple on macOS, Authenticode on Windows; install; the product's MCP line from `knowledge/products.md`;
   its proving call). Each step asks the person in the console; each can be skipped and says what is lost.
3. **Fabric itself still writes nothing** into an agent's configuration and installs nothing: the agent does, on the
   person's consent, in the console the person watches. That is the separate, consented, reversible act ADR-0119 §2
   reserves; ADR-0129 §4 now reads «Fabric checks and shows; the coding agent installs, on consent».
4. **The checklist on screen reads observed facts, never the agent's claims:** re-detection of the binaries and the
   skills, the agents' own MCP lists, the installed bundles and their signatures, the proving calls arriving at the
   hub. A step the agent reports done that Fabric cannot observe is shown as «not confirmed».
5. **Sign-in is the person's.** Step 2 says per agent whether it is signed in (readers per version, CO-176/CO-244);
   an agent that is not shows «sign in, then check again», and the Setup console does not start on it.
6. **Removal is symmetric** (LC-14): the same console, briefed to remove what setup added — MCP entries, skills,
   products — and the checklist confirms each removal.

## Consequences

- A session preset `setup-machine`, a `setupFacts` observation module, the setup brief rendered from the knowledge
  base page (pinned per release), SCN-126 rewritten, the first run's screens redrawn.
- The secret never travels on argv (LC-04): a product whose MCP line needs a credential gets it from the person's
  hidden prompt or Observatory's vault, never from a command Fabric writes.

## Evidence

- Review F-02, F-03, F-06 ([the plan](../evidence/plans/2026-10-11-release-040-agents-first.md#the-review)).
- `knowledge/agents-first.md`, `knowledge/products.md`, `knowledge/lifecycle.md` LC-04/LC-14/LC-16 (fabric-workspace `e66b3a0`).
- fabric-dashboards #70 (its setup verifies every download with GPG and `shasum -c`), relayed 2026-10-11.
