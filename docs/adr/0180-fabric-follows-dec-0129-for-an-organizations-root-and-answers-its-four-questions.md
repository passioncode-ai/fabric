# ADR-0180: Fabric follows DEC-0129 for an organization's root, and answers its four open questions (D8, part 2)

**Status:** accepted · 2026-10-26 · Fabric's decision D8, part 2 (Organization R1 row N-2), after the contract's
DEC-0129 (`v0.1.0+2026-10-26.4`, fabric-agent-contract `a2c5d018`) · amends the defaults of
[ADR-0178](0178-an-organizations-hub-follows-a5-an-administrators-passkey-signs-its-record-and-each-member-mints-its-own-tokens.md)
(D8-b replaced; points 1 to 7 and D8-a, D8-c, D8-d unchanged) · input of the contract's next membership decision
(`docs/specification/membership.md` § Not decided here) and of Fabric's CO-130 and CO-337.

## Context

ADR-0178 settled who signs an organization's record: an administrator's passkey, in Fabric, never a server. DEC-0129
built `org-authority/1` on it and placed the membership root with the organization owner's Fabric (OL-4a, after A-3).
It departed from one of ADR-0178's defaults and left four questions to Fabric, asked in the contract's board thread
`8d115bed` (message `237e41a3`) and relayed by fabric-workspace on 2026-10-26, due 2026-10-29 because Vesta's N-3
(MD-14, 2026-11-04) waits on the exchange «the server drafts a key set, the owner's Fabric signs it»:

- (0) the form of an administrator's signature over a project leaving an organization (MC-13, ADR-0178 point 5), when a
  member's estate admits only its own passkeys (membership.md, Not decided here);
- (1) ADR-0178 D8-b (the owner's two estate passkeys as the root) against DEC-0129's Ed25519 root and an organization-only
  signing credential;
- (2) recovering a lost root, as DEC-0107 recovers a passkey;
- (3) whether a reader checks an attestation's `role` or `status` against the latest signed member list.

The facts read for this record, at contract tag `v0.1.0+2026-10-26.4`: DEC-0107 item 4 (recovery is a second passkey
from revision 1, `recoveryReady`); DEC-0127 OM-1 to OM-8 (the pin `{org, issuer, root, pinnedAt}` is the person's
admission; one root per organization; subjects pairwise per reader); DEC-0129 OL-1 to OL-5 and 4a; membership.md
§ OL-2 (the pin decides the membership, the list decides only what the organization's relay delivers) and § Not decided
here.

## Decision

1. **D8-b is replaced by DEC-0129 OL-4a.** The membership root of an organization is an Ed25519 key generated on the
   owner's always-on `full` machine by the owner's Fabric and never copied (as DEC-0106 and DEC-0107 keep a hub key).
   It signs only key sets, and only after the owner confirms the drafted changes in Fabric with a user-verified
   assertion of one of their estate passkeys, so a copy of the root's disk cannot certify an administrator without the
   person. The owner registers one signing credential per organization (a signing RP, never an estate `authority`,
   never in another organization's set), which enters the first set as its administrator. Two organizations, two roots,
   two credentials: nothing links them (CT-122).
2. **(0) A project leaving is the administrator's statement and the person's revision, never an administrator's
   signature inside a member's estate.** The administrator's signing credential, listed in the applied key set's
   `administrators`, signs a release statement naming the organization, the project by the reference the person
   brought it in with (the adaptation plan's organization part, TP-03; nothing of the estate) and a rising revision,
   over a register challenge `{type, digest}` as OL-2 signs a list. The member's Fabric verifies it under the key set it
   applied from its pinned root, stops at once every OM-7 outflow of that project to the organization (the release takes
   effect on receipt, whatever the person does next), and drafts the estate revision that removes the project's entry,
   signed by the person's own passkey and citing the statement's digest. The estate's verifier stays as it is: it
   admits the member's own passkeys only. Entering needs the person (R1-D12); staying needs both; leaving needs either.
3. **(2) A root has a planned successor and an optional recovery key, mirroring DEC-0107.** A planned move (the root's
   machine replaced) is a key set the old root signs naming its successor; a reader holding the old pin accepts sets the
   successor signs from then on, and the person's Fabric moves the pin in the next estate revision their passkey signs.
   For a lost root, the pin may carry a second Ed25519 key, `recovery`, generated on another machine of the owner, which
   signs only a successor statement and never a key set. Fabric drafts an organization's creation with a recovery key
   when the owner has a second machine, and otherwise says what losing the root costs: every member pins anew, each
   with their own passkey (membership.md, Not decided here), while attestations already issued keep their expiry
   (OM-6). Both are additive: a successor member in `org-key-set/1` and an optional `recovery` in the pin.
4. **(3) No reader checks a role against the list, and the relay checks status from both.** The list names subjects
   pairwise to the relay's audience and an attestation names them pairwise to its own reader (CX-22), so only the relay
   can match an entry with an attestation. At the relay the stricter answer wins: a listed member whose attestation for
   the relay's audience is `ended` is not delivered to before the next list, and an `active` attestation whose subject
   no list names is not delivered to (OL-4). For roles, Fabric proves an administrator only by the applied key set's
   `administrators` and reads an attestation's `admin` or `owner` as the issuer's statement for display and routing,
   never as authority to sign or release.

## Consequences

- The contract's next membership decision can fix the release statement (its type, challenge and verifier beside
  `verifyOrgAuthority`), the key set's successor and the pin's optional `recovery`, and close the role question with
  item 4's sentence. Fabric posted these answers on the board on 2026-10-26 (thread `115ef7fb`, message `664b69ad`) to
  fabric-agent-contract, with fabric-workspace and passioncode-vesta as participants.
- Vesta's N-3 can build the exchange now: Vesta drafts the key set and the list, the owner's Fabric confirms with an
  estate passkey and the root signs; Vesta never holds the root or a signing credential.
- Fabric's slice (P-27): CO-337 (Create organization) generates the root on the always-on machine, registers the
  organization-only signing credential and offers the recovery key; CO-130 (the Vesta identity bridge) carries the
  key-set exchange; CO-320 (the ceremonies) adds the release of a project and the root's planned move.
- Nothing changes for the operator's personal network (ADR-0162) or for ADR-0178 points 1 to 7.
- Rejected: an administrator's passkey admitted into a member's estate verifier (a second authority over the person's
  estate, against R1-D12); a release that waits for the person's signature to take effect (a member could keep a
  project in an organization that released it); the attestation's role as an administrator's proof (the issuer is a
  server, and A-3 keeps servers from certifying administrators); a cross-check of roles at every reader (pairwise
  subjects make it impossible without linking, CX-22); recovery of the root by a server or by the administrators'
  credentials (either would become the organization's authority).
