# ADR-0162 — The operator's passkey signs the network, the hub lives on the always-on machine, and a network is a context

**Status:** accepted · 2026-10-17 · records the operator's decisions NET-1…NET-4 of 2026-10-15, taken on fabric-workspace
[`docs/reports/2026-10-15-agent-network-stage1/README.md`](https://github.com/passioncode-ai/fabric-workspace/blob/main/docs/reports/2026-10-15-agent-network-stage1/README.md)
(PR #238, main `183f78d2`) · RM-21 stage 1, packet P1 · closes Fabric's open decision D3 and K-1 (fabric-workspace #215)
· amends [ADR-0016](0016-the-fabric-is-a-platform-of-estates.md) · carry-over row CO-318.

## Context

RM-21 lets the operator's own machines work as one network and, later, share agents into other networks. The contract
already carries the pieces: the estate record (DEC-0055), the relay (DEC-0047), delegation tokens (DEC-0039/0045),
revocation deltas and heartbeats (DEC-0054), node placement (DEC-0061), contexts and share grants (DEC-0082). Four
decisions had not been recorded, and every owner's packet waited on them. The operator took them on 2026-10-15:

- **NET-1:** a network is a context.
- **NET-2:** one machine key per network.
- **NET-3:** the operator's passkey signs the network, and the hub lives on the always-on Mac.
- **NET-4:** own machines first, sharing second.

This record makes them Fabric's.

## Decision

1. **A network is a context (NET-1).**
   - The operator's network is their personal estate, context `personal`: all of their own machines.
   - Every other network is an organization, context `org:<orgId>`.
   - Creating a network creates an organization.
   - Sharing an agent into a network is a share grant into that organization's context (DEC-0082).
   - The word "network" names this and nothing else; it adds no contract concept.
2. **One machine key per network (NET-2, K-1).**
   - Inside the personal network a machine holds one `#sig`/`#kem` pair, in the Secure Enclave where it can.
   - For each organization the machine enrolls separately, with its own keys.
   - Organizations cannot link one machine across networks (CX-22).
3. **The passkey signs; the hub runs on the always-on machine (NET-3, D3).**
   - **Who signs:** every estate-record revision — which machines are in, what is placed where — is signed by the
     operator's passkey, revision 1 included.
   - **Where the hub runs and what it signs:** the hub runs on the always-on Mac. It mints delegation tokens and signs
     revocation deltas and heartbeats.
   - **The hub's key:** the hub has its own hub key, certified by the passkey in the record. It is not the machine's
     device key.
   - **When the hub is away:** the other machines keep working until the 72-hour freshness rule (DEC-0054).
   - **Device keys:** every machine keeps its own device key.
4. **Where it runs in Fabric.**
   - **"Create my network"** (writes revision 1) and **"Add a machine"** / **"Remove a machine"** (later revisions)
     are Fabric's ceremonies (P3, CO-320), run on the operator's machine with the passkey present.
   - Adding a machine uses a pairing code and commit-then-reveal through the relay.
   - The hub is Fabric's service on the always-on Mac (P2, CO-319).
   - No other component signs the estate record. There is no interim signer: before P3 ships, a test estate signed by
     a fixture key may exercise the relay and the node, marked as not the real ceremony and never applied to the
     operator's estate.
5. **Order (NET-4).**
   - Stage 1: the operator's own two machines — enroll, see, place, move, give a task.
   - Stage 2: networks as organizations, and sharing an agent into one with limits (D8 / `org-authority/1`).
   - Stage 3: Vesta's view of an organization's network.

## Consequences

- **ADR-0016 is amended** (its Amendment section): an estate is not bound to one machine or one database; it spans the
  operator's machines through the estate record. An organization, a network and a context are one thing.
- **Fabric's packets follow from this record:**
  - P2, the hub (CO-319);
  - P3, the ceremonies (CO-320), whose texts are the contract's DEC-0055 open item;
  - P8, "Run it on …" / "Move to …" (CO-321), which writes placements into the next revision.
- **The relay deploy is P4, Observatory's.** The node is P5–P7. Neither is Fabric's to build; Fabric supplies the
  record they admit.
- **No secret leaves its machine.** The passkey stays with the operator; the hub key stays on the always-on Mac;
  device keys stay on each machine. Only public keys and signatures travel in the record.
