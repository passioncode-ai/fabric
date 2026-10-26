# ADR-0178: An organization's hub follows A-5, an administrator's passkey signs its record, and each member mints its own organization tokens (D8)

**Status:** accepted · 2026-10-26 · Fabric's decision D8 (carry-over row CO-420; Organization R1 row N-2, fork F-7),
bounded by A-5 and R1-D12 · the input of the contract's TP-00 (`org-authority/1`, CT-137 with CT-122) · extends
[ADR-0162](0162-the-operators-passkey-signs-the-network-and-the-hub-lives-on-the-always-on-machine.md)
to organization networks (its stage 2).

## Context

ADR-0162 settled the operator's own network: a network is a context, one machine key per network, the operator's
passkey signs every estate-record revision, and the hub runs on the always-on Mac under a hub key the passkey certifies.
It left organization networks to "D8 / `org-authority/1`". Organization R1 (fabric-workspace
`docs/reports/2026-10-25-organization-r1/README.md`) needs that answer before Fabric's organization slice (P-27, target
2026-11-21) and before the contract adopts TP-00 (CT-137, due 2026-11-06).

The bounds, each with its source (read 2026-10-26 at fabric-workspace `255ce6d6`, fabric-agent-contract `a6668f7a`,
passioncode-vesta `98b0276`):

- **A-5** (fabric-workspace `knowledge/roadmap.md`, accepted with A-1 to A-11 on 2026-10-22): one primary machine per
  network holds the hub, the always-on Mac until a cloud exists, then the cloud; the passkey stays on the person's
  device. R1-D9 and SD-4 O-6: an organization's hub follows A-5.
- **A-3, A-8**: an organization's cloud machine is claimed from Vesta with a device token, the platform never holds a
  passkey or an organization root; a person is in one personal network and in any number of organization networks.
- **R1-D2**: R1 runs on members' Macs and the existing servers; no cloud machine on the critical path.
- **R1-D12**: a project enters an organization by the person's own passkey only; no administrator accepts it (MC-13:
  an administrator signs only a project leaving).
- **R1-D13 and CT-122**: mode C plus unlinkable memberships: a hub key and issuer per organization context.
- **Vesta ADR-0004, ADR-0005, ADR-0013**: Vesta drafts and signs `org-authority/1` (members, roles, allowances),
  issues no delegation token, and is the source of truth only for an organization that connected it.
- **v4 target architecture** (passioncode-vesta `docs/design/2026-10-12-target-architecture.md`): one issuer per person,
  the hub in the person's Fabric; hosts never mint; signing happens in Fabric or a pinned page, never in Vesta; the
  organization root certifies administrators' device-bound signing credentials.

## Decision

1. **An organization network's hub follows A-5.** In R1 it runs on the always-on Mac of an organization administrator,
   under a hub key that the administrator's passkey certifies; it holds the organization network's heartbeat,
   revocation delta and leases. When the organization has its own cloud machine it moves there by DEC-0107's hub move.
   It mints no member's token (point 4).
2. **Only an administrator's passkey signs the organization's record.** Every revision that changes the organization's
   members, roles, machines or revocations is signed in Fabric (or a pinned page) by an administrator's device-bound
   passkey credential, certified by the organization's root. No server, Vesta included, signs it.
3. **Vesta drafts and publishes, it does not sign estates or mint tokens.** Vesta (or any organization server, MD-9)
   drafts `org-authority/1` and serves the TP-00 membership attestations (issuer, audience, subject, role, revision,
   expiry); an administrator signs what it drafted (point 2).
4. **Each member mints its own organization tokens.** A member's own hub issues the tokens of its organization context
   under a per-context hub key and issuer recorded in the member's own estate record (CT-122 `contextHubKeys[]`); the
   personal hub key keeps the personal heartbeat and delta. Contexts stay unlinkable.
5. **A project enters by its person's passkey alone** (R1-D12), recorded in the member's estate; an administrator signs
   only a project leaving the organization (MC-13).

6. **Joining an organization: the pin and its fingerprint** (the contract's DEC-0127, OM-2, at fabric-agent-contract
   `b79bd14c`, leaves this to D8). When the person joins, Fabric reads the organization's membership root from its issuer
   over TLS, shows its fingerprint (the root's `kid` and the first 20 characters of the base32 SHA-256 of its `x`, in
   groups of four) and asks the person to compare it with the fingerprint in the administrator's invitation, which
   reaches them by a second channel (the administrator's own Fabric shows it, and the invitation message carries it).
   Only a match lets the passkey sign the estate revision that pins the root; a mismatch or an invitation without a
   fingerprint pins nothing and says why. Fabric writes the pin only once every reader of the record (each of the
   person's machines and the relay that holds it) reads DEC-0127, as OM-2 requires. Replacing a root is a new pin.
7. **A project in an organization: the receipt of its entry and the signature of its leaving.** A project's entry is
   the estate revision that places it in the organization's context, signed by its person's passkey (R1-D12); that
   signed revision, by number and digest, IS the receipt, and Fabric journals one event naming it; no administrator
   signs and no separate admission receipt exists (as OM-2 says for the organization itself). A project leaving
   (MC-13) is a revision Fabric drafts, signed by an administrator's passkey in the administrator's own Fabric; until it
   is signed the project stays in the organization's context. When a membership ends (OM-5) Fabric drafts the one
   revision that revokes the context's grants, placements and pin, and asks the person's passkey for it.

## Defaults this record takes for R1, the operator's to change

Taken by the operator's recorded decisions, then R1's goal, then the safest reversible choice:

- **D8-a, which machine:** the operator's always-on Mac Studio holds the hub of both R1 organizations (PassionCode.ai
  and Appvillis, both owned by the operator in Vesta), each under its own organization hub key, unlinkable from the
  operator's personal hub key (CT-122). Reversible by DEC-0107's hub move to an Appvillis machine or a cloud machine.
- **D8-b, the organization's root:** in R1 the owner's two passkeys are the root (DEC-0107's two-passkey recovery);
  the offline hardware root pair (v4 OP-13) is R2. No purchase is on the R1 path.
- **D8-c, signatures per revision:** one administrator's signature in R1; a quorum (or v4's delayed path) is R2.
- **D8-d, one project in how many organizations (F-11):** one organization at a time in R1; the organization-to-estate
  mapping in TP-00 carries one organization per project, and widening it is R2.

## Consequences

- The contract decided TP-00 as DEC-0127 (`org-membership/1`, OM-1 to OM-8): points 6 and 7 are Fabric's answer to
  what it left to D8 (the fingerprint at the pin, the project's entry receipt, the leaving signature).
- The contract's TP-00 (CT-137) can fix `org-authority/1`'s signer (an administrator's certified passkey credential),
  the attestation's issuer (the organization server), and per-context member issuers (CT-122).
- Fabric's slice (P-27): CO-422 (contexts), CO-130 (the Vesta identity bridge), CO-319 and CO-320 (the hub and the
  ceremonies, now also for an organization network), CO-337 (Create organization) build to this record.
- Nothing changes for the operator's personal network (ADR-0162).
- Rejected: Vesta as hub or signer (Vesta ADR-0004, ADR-0005, v4); each member's Fabric as the organization's hub with a
  co-signed organization record (A-5's one primary machine per network; no contract shape for a multi-passkey
  organization record); the offline root signing every revision (too heavy for R1, kept as the certifier in R2).
