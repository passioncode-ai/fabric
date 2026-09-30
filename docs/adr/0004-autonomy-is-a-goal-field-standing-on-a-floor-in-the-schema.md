# Autonomy is a goal field standing on a floor in the schema

- **Status:** Accepted
- **Consequences / affects:** `CONTEXT.md`, `docs/vision.md`, `supabase/migrations/`
- **Source:** run `2026-08-16-software-fabric` — stage-0 grill, questions 1 and 7

The operator's rule is that the goal sets the autonomy level, not the system. But the
CEO agent decomposes goals, so it also writes the level on every sub-goal it creates
— which turns "the goal decides" into "the agent decides" unless something below it
does not move.

**Decided:** three parts, and the third is the point.

1. **`autonomy_level` is a column on `goal`**, one of `safe` | `guarded` | `maximum`.
   Sub-goals inherit and may never exceed their parent.
2. **A floor is enforced in the database**, not in an instruction: spending money,
   deleting (repositories, zones, data, production DNS records), and outward
   publication under the operator's name are refused at any level, including
   `maximum`.
3. **A grant is the only way through the floor** — named target, named action, named
   preconditions, an expiry, and the operator as its author. "Deploy
   `software-fabric` to staging once lint and the full suite are green" is a grant.
   "Just do everything" authorises nothing.

**Why the floor is in the schema:** an instruction is text a model reads and can
reason its way around, and the whole class of failure here is a capable agent
producing a good argument for crossing a line. A constraint that refuses the write
does not have an argument. The cost is that raising the floor needs a migration,
which is the correct amount of friction for the thing that stops an agent spending
the operator's money.
