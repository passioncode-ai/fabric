# registry/ — the declared layer, mirrored to git

This directory is the **git-visible half** of the store described in
[`../docs/adr/0002`](../docs/adr/0002-declared-data-is-mirrored-to-git-observed-data-is-not.md).
Once the schema ships, Supabase is authoritative and these files are regenerated from
it on every change, so a portfolio decision arrives as a reviewable diff instead of a
silent row update. A gate fails when the two disagree.

**Until the schema ships, these files are the only registry there is**, hand-assembled
from live measurement on 2026-08-16.

## Files

| File | Holds |
|---|---|
| `domains.yaml` | 40 domain assets: Cloudflare zone state, DNS, HTTP probe, traffic, project link, expiry — published redacted (identifying names and ids replaced, ADR-0096) |

Planned as the collectors land: `repositories.yaml`, `applications.yaml`,
`accounts.yaml`, `goals.yaml`, `agents.yaml`, `departments.yaml`.

## Declared versus observed, in one line

A field is **declared** if a person or the CEO chose it — `project`, `state`
overrides, notes, scope. A field is **observed** if a measurement returned it — `dns`,
`http`, `traffic`, `last_commit`. A refresh rewrites observed fields and must not
touch declared ones; that is REQ-002, and it has a test.

## How the numbers here were produced

Every row in `domains.yaml` traces to one of these, run on 2026-08-16:

```bash
# zones across all three Cloudflare accounts
GET /zones?account.id=<id>&per_page=50
# DNS record set per zone
GET /zones/<zone_id>/dns_records?per_page=100
# what the host actually answers
curl -sSL --max-time 12 -A 'Mozilla/5.0' https://<domain>/
# which repository mentions the domain
rg -F -f domains.txt -o <projects-dir>   # then again by bare label
# which repositories exist at all
gh repo list <owner> --limit 200 --json name,updatedAt,isArchived
# what is deployed where
GET /accounts/<id>/pages/projects ; GET /accounts/<id>/workers/scripts
doctl apps list
```

The one field that is **not** measured is `traffic.cf_unique_visitors` — it is a paste
from the Cloudflare dashboard, and **it counts bots**. A parked domain shows 1 830
"visitors" here with no human behind any of them. It is recorded because it is the
only traffic figure currently available, and labelled because using it alone to
decide what is alive is exactly the mistake this registry exists to prevent.

## Refreshing

Not yet automated. `pnpm registry:verify` and `pnpm collect:cloudflare` arrive with
M4 (REQ-001, REQ-013). Until then a refresh is a re-run of the commands above, and
this note is the honest statement of that.
