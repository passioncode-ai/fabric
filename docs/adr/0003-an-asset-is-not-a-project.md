# An asset is not a project

- **Status:** Accepted
- **Consequences / affects:** `CONTEXT.md`, `docs/vision.md`, `supabase/migrations/`
- **Source:** run `2026-08-16-software-fabric` — stage-0 grill, question 4

The word "project" was doing two jobs in the request: a product's domain as a thing the
company owns, and "a project under a goal" as a unit of work. One table for both
makes the status `closed` ambiguous between *the product is shut down* and *the work
is finished*.

**Decided:** `asset` and `project` are separate types. An asset — domain, repository,
application, provider account — exists independently of any work and outlives every
goal. A project sits under a goal and holds work, with an owner, a deadline and a
budget. An asset belongs to **at most one** project (nullable), a project holds
**several** assets, and a goal may also target assets directly, without a project,
for portfolio-wide work.

**Why it is worth a record:** the collapsed version is already live and already
wrong. Linear marks the flagship product's domain as `canceled` while it is the flagship, because the
only status available described the work and got read as describing the product. A
future reader who wonders why two tables exist where one would do should read that
row first.

**Known limit, accepted:** one asset cannot serve two projects. If that becomes real
— a personal site used by two independent efforts — it is a join table and a migration,
which is cheaper now than the ambiguity of modelling it before it exists.
