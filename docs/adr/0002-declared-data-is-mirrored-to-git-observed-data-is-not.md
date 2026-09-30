# Declared data is mirrored to git, observed data is not

- **Status:** Accepted
- **Consequences / affects:** `CONTEXT.md`, `registry/`, `supabase/migrations/`
- **Source:** run `2026-08-16-software-fabric` — stage-0 grill, question 3

Supabase (Postgres + pgvector) is the single store: registry, goals, projects, graph
nodes, agent runs, observations and embeddings. A dedicated graph database was
rejected — this is a DAG of typed edges at portfolio scale, which a recursive CTE
answers, and three stores mean three backups and no transaction spanning a goal and
its metric.

**Decided:** everything lives in Supabase, and the **declared** layer — assets, their
project membership, goals and their autonomy level, the agent roster, decisions — is
mirrored to git as YAML on every change. The mirror is diffable, reviewable and
`git blame`-able, and the database can be rebuilt from it with nothing lost that a
person chose. A gate fails when the two disagree. **Observed** data — DNS, HTTP
status, Search Console rows, run results — is written only by collectors, never
mirrored, and always carries its source and timestamp.

**Why this split and not one or the other:** a human-curated registry inside a
database has no diff, no review and no blame, which the operator's evidence-docs
doctrine forbids for anything that will be read as true. And live run state — leases,
waits, retries under concurrent agents — cannot be held in files without races. The
line between them is *who wrote it*, which is unambiguous at every row.
