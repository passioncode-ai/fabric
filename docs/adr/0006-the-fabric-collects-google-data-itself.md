# The fabric collects Google data itself

- **Status:** Accepted
- **Consequences / affects:** `docs/vision.md`, `docs/evidence/backlog.md`
- **Source:** run `2026-08-16-software-fabric` — stage-0 grill, question 6

Search Console and Analytics collection already exists and is debugged inside
a separate traffic-growth product the operator builds, whose own ADR-0001 names its audience as a portfolio owner —
which the fabric is. Reading it over its API would have cost nothing to build.

**Decided:** the fabric builds its own Google OAuth and its own GSC and GA4
collectors. The operator chose independence over reuse: that traffic-growth tool is a
product being sold and refactored, and a fabric that breaks when its own product
ships a release is a coupling that will be discovered at the worst moment.

**The price, named rather than discovered:** this repeats work that took months to get
right. The mitigation is to reuse the *knowledge* instead of the code — stage 1 reads
that product's own audit records and carries its diagnosed defects in as
requirements before a line is written. At least four are already known: Search
Console truncates a day at 5 000 rows; a watermark derived from data must be written
*after* the data or a crash leaves a window nobody returns to; a nightly backfill
re-ran on every quiet property; a crawler obeyed no wildcard in `robots.txt` and
followed a sitemap onto a host whose rules it had never read.
