# Task brief — PassionCode.ai public launch surface

> Stage-0 artifact locked from the operator's direction on 2026-09-03. Publication to
> the PassionCode.ai GitHub organization and GitHub Pages is explicitly in scope.

- **Task:** make the agent-agnostic positioning primary, establish the vibe-coding to
  passion-coding category narrative, apply the approved mark, publish the organization
  profile, repository READMEs, social banner and `passioncode.ai` landing page.
- **UI verdict:** yes — one public landing journey is added to the UX contract.
- **Model:** current session model, as already selected for the brand-system run.

## Source ledger

| Source | What it contributes | Authority | Stale after this run? |
|---|---|---|---|
| operator direction, 2026-09-03 | primary position, category transition, project-level control and publication scope | controlling brief | no |
| ADR-0010 | the Project, not the department, is the unit of organisation | accepted decision | no |
| ADR-0018 | PassionCode.ai is the product; Fabric is the kernel | accepted decision | no |
| `docs/brand/ui.md` and approved SVG | dark field, bright passion-fruit mark, no semantic use of brand chroma | accepted brand system | no |
| `docs/brand/voice.md`, `terminology.md`, `facts.md`, `channels.md` | current public language and factual boundary | brand contract | yes — extend |
| `docs/ux/` | existing users and journeys; no public web journey yet | UX contract | yes — add public discovery |
| GitHub API, checked 2026-09-03 | `.github` exists but is empty; `fabric` and two supporting repositories exist; no Pages repository existed before this run | external state | yes — publish |
| DNS/HTTP probes, 2026-09-03 | apex resolves through Cloudflare; HTTPS did not return a response within 15 seconds | external state | yes — recheck after Pages setup |

**Contradictions:** the earlier 2026-09-02 brand-system brief excluded a public website
and deploy. This operator request explicitly expands scope and therefore governs this
new run; the earlier brief remains an accurate record of its own boundary.

## Requirements

| ID | Requirement | Verification |
|---|---|---|
| PL-REQ-001 | One canonical category and positioning hierarchy appears across vision, brand and public surfaces. | narrative gate plus exact-string search |
| PL-REQ-002 | A newcomer can distinguish vibe coding, passion coding, PassionCode.ai and Fabric without prior category knowledge. | SCN-038 review and public-copy read-through |
| PL-REQ-003 | The organization profile and each active repository README use the approved mark and explain its role. | GitHub API fetch after push |
| PL-REQ-004 | A responsive, accessible, static landing page is published from the organization Pages repository. | local HTML checks, narrow/wide screenshots and deployed browser check |
| PL-REQ-005 | The page exposes canonical, Open Graph, social-image, favicon, robots, sitemap and structured data. | source assertions and deployed metadata fetch |
| PL-REQ-006 | The social banner uses the approved vector mark and the primary message at 1200×630. | dimension/checksum inspection and rendered review |
| PL-REQ-007 | GitHub organization and repository metadata point to the public site and use consistent descriptions. | GitHub API response after update |
| PL-REQ-008 | Publication does not claim that the hosted runtime is already shipped. | brand lint and public-copy review |

## Delivery decisions

- English is primary for GitHub and the landing page; Russian remains a maintained
  narrative reference in the brand pack and product guide.
- The site is a dependency-free static page in the public
  `passioncode-ai/passioncode-ai.github.io` repository, published from `main`.
- The canonical domain is `https://passioncode.ai/`; `www` is secondary.
- The primary CTA is the GitHub organization. Fabric remains private at publication
  time, so the page describes current status without promising public source access.
- Motion is omitted from v1. The page remains complete with CSS, images and scripts
  disabled independently; there is no consent, analytics or persistent state.
- DNS changes are attempted only through an already configured authenticated path.
  If no such path exists, Pages is configured and the exact remaining DNS record is
  reported rather than inventing credentials.
