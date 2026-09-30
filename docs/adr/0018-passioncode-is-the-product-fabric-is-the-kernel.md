# PassionCode.ai is the product; Fabric is its technical kernel

- **Status:** Accepted
- **Supersedes:** the remaining product-scope claim in ADR-0011 and the sentence
  “Not a general-purpose agent framework” in `docs/vision.md`; retains ADR-0016's
  org-#1-first sequencing rule
- **Consequences / affects:** `README.md`, `CONTEXT.md`, `docs/vision.md`,
  `docs/architecture/passioncode-platform.md`, `docs/architecture/agent-composition.md`,
  product UX and future packaging
- **Source:** operator clarification, 2026-08-29

Two names had been carrying two incompatible meanings. They now have one boundary:

1. **PassionCode.ai is the user-facing product.** It is the place where a person or
   organization creates estates and projects, assembles an AI-native team, connects
   accounts, sees work and evidence, approves sensitive actions, invites people, and
   installs or builds compatible providers.
2. **Fabric is the technical kernel and open compatibility layer.** It owns the
   domain contracts, event and run lifecycle, policy enforcement, provider admission,
   orchestration seams, evidence model and projections used by PassionCode.ai. It may
   be embedded, self-hosted or addressed through an API; it is not the product brand.
3. **Agent-agnostic is a boundary claim, not a promise that every runner behaves the
   same.** A provider or runner is supported only at the tier its conformance passport
   proves. The host depends on the Fabric contract, never on one model vendor's
   private session format.
4. **Open does not mean ungoverned.** Discovery, admission, project binding and
   execution are separate steps. A listed provider receives no estate access until a
   person or policy creates a scoped binding.

The working technical descriptor at acceptance was **“Agent-agnostic harness and
automation framework for AI-native teams.”** It describes Fabric. The working product
promise at acceptance was **“Your AI team, working as one.”** It is provisional copy,
not a naming or trademark decision.

**Copy update, 2026-08-29:** the operator replaced those provisional lines with the
working positioning **“PassionCode.ai — The agent-agnostic operating system for AI-native
teams.”** and the working slogan **“Where people and agents run the business together.”**
The product/kernel decision above is unchanged.
