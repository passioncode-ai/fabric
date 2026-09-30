# ADR-0096 — Dated records are redacted for publication

**Status:** accepted records decision; changes the text of dated records, not what they decide.
**Date:** 2026-09-30. **Decided by:** the operator, instructing that every piece of private data
leave the current tree before the repository is published as open source under
[ADR-0092](0092-every-repository-is-agpl-3-0-or-commercial.md) with a fresh history.
**Amends:** the rule in `CLAUDE.md` and [the audit index](../audit/README.md) that dated documents
are records of a moment and never rewritten — for privacy, once, on this date.

## Context

`passioncode-ai/fabric` was private from its first commit, and its records were written for one
reader. Briefs kept the operator's requests verbatim, in the language they were spoken; audits and
plans named the absolute paths of the operator's machine; the first measurement of the estate
(`registry/domains.yaml`, the vision's "why it exists" table) named the operator's other
businesses, domains, accounts, clients and personal agents; fixtures carried real or
realistic-looking e-mail addresses. None of that belongs in a public repository, and the
never-rewrite rule for dated records would otherwise have kept it there for good.

## Decision

1. **Privacy overrides the never-rewrite rule, once.** On 2026-09-30 every dated record in
   `docs/audit/`, `docs/evidence/` (specs, plans, registers), `docs/reports/`, `docs/ux/plans/` and
   `docs/launch/` was redacted in place, **minimally**: the private token or sentence is replaced;
   the finding, its numbers, its ids, its receipts and its structure stay as they were.
2. **What was removed**, by class:
   - the operator's **verbatim statements** — quoted requests, "Operator statements (verbatim)"
     tables, quoted "Decided by" and "Source" lines — replaced by a neutral English paraphrase of
     the request or decision itself;
   - **personal remarks** and **names of people** other than the maintainer named in `CLA.md` and
     `COMMERCIAL-LICENSE.md`;
   - the operator's **other businesses, clients, projects, domains, accounts and personal
     agents** — replaced by neutral words ("another project", "a personal site", "a corporate
     account", "a personal agent", `site-NN.example`, `project-x`, `example-agent`);
   - **absolute home paths** — replaced by repository-relative paths, `$HOME/…`, or `<home>/…`
     inside JSON evidence; synthetic fixture homes are `/Users/example`;
   - **e-mail addresses** outside the allowed set, and **account and zone ids** — fixture addresses
     are `…@example.com`, third-party addresses in vendored templates and evidence are dropped.
3. **The decisions are unchanged.** No ADR's decision, no register row's status, no finding's
   verdict and no measured number was altered by the redaction. Where a decision depended on the
   removed data — the portfolio layer over the operator's own projects (ADR-0001), the estate
   measurement that motivated the project, the Google collectors built rather than borrowed
   (ADR-0006) — it is kept in general terms.
4. **The domain registry is published redacted.** `registry/domains.yaml` keeps its 40 measured
   rows, their states and the summary other documents cite; names, ids, targets, titles and
   repositories are placeholders. The unredacted registry stays on the operator's machine.
5. **From here on, operator statements are recorded as paraphrases.** A brief records what was
   asked and how it was read; it does not quote the person who asked. The gate is the org-index
   privacy check (`scripts/check_private.py`, rules P1–P4 against a denylist kept only on the
   operator's machine) plus `gitleaks detect --no-git`, run before anything is published.

## Consequences

- A dated record is no longer a byte-exact copy of its moment. Its digests, stamps and rendered
  twins were refreshed in the same change; a receipt that hashed the old bytes names the old
  bytes, and the record says so where it matters.
- The unredacted originals exist only in the private history of this repository, which is not
  published: the public repository starts from a fresh history.
- Machine-inventory evidence that was nothing but the operator's machine was reduced to what its
  argument needed; the change that did it names each file.
- A future record that needs a private fact keeps it out of the repository and cites where it
  lives instead.
