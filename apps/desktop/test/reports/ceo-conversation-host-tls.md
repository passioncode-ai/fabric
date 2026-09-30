<sub>ssheleg skills — task-pipeline · evidence-docs</sub>

# CEO host HTTPS boundary — owned local fixture

Measured on 2026-09-27 with Node `v26.8.2` and OpenSSL `3.6.4`.
Production host source: [`5c498acb815a9e25a5a430487f48ebe5d915e176`](https://github.com/passioncode-ai/fabric/commit/5c498acb815a9e25a5a430487f48ebe5d915e176),
[`ceoConversationHost.ts`](../../src/main/ceoConversationHost.ts).
This packet changes tests and this receipt only. It does not activate the host.

## Command and observations

```sh
node --experimental-strip-types apps/desktop/test/ceo-conversation-host-tls.test.mjs
```

The [executable fixture](../ceo-conversation-host-tls.test.mjs) passed five groups:

1. A fresh local CA absent from the child trust store is refused. No secure-connect
   event, `ClientRequest.end`, TLS application write or HTTP server request occurs.
   The fixture also observes an allowlisted certificate-chain rejection code.
2. A separate child started with `NODE_EXTRA_CA_CERTS` pointing at that CA accepts
   the signed leaf for `127.0.0.1`. The real secure-connect event precedes the
   successful, fixed `ceo_open_conversation` RPC with synthetic credentials and
   trusted identity fields.
3. A leaf signed by the same trusted CA with only `wrong.invalid` in its SAN is
   refused for the loopback IP with `ERR_TLS_CERT_ALTNAME_INVALID`. There is no
   HTTP/application write.
4. An owned loopback TCP bridge holds the real TLS handshake. Authority is revoked
   before forwarding begins. TLS succeeds, but the secure-connect authorization
   fence refuses the HTTP write. Application-write count stays zero.
5. A handshake that never completes returns the bounded unknown outcome without
   an HTTP/application write.

The fixture observes counts at the actual client `end`, TLS `write` and
`secureConnect` seams; it does not retain application bytes in those observers.
Instrumentation is test-only and restores `https.request` after each operation.
Production TLS verification and CA selection are untouched.

## Isolation and limits

All servers and bridge targets bind `127.0.0.1` on ephemeral ports. OpenSSL creates
one-day fixture keys and certificates in an owned temporary directory. Its child
receives only PATH and an empty OpenSSL configuration. Node test children receive
only PATH and, for the trusted case, the fixture CA path. They do not inherit
NODE_OPTIONS, TLS-verification overrides, proxies, accounts or provider keys.
No system/user trust store is changed. No database, provider, model or external
network endpoint is used.

Both Node children report closure of owned HTTPS/proxy servers and sockets. The
parent removes and verifies absence of the temporary CA, private keys and host
directory in `finally`. An initial test revision asserted socket cleanup before
its asynchronous `close` event; it was corrected to await each observed close
rather than weakening the cleanup assertion.

This is real local TLS/hostname/fence acceptance for the host transport. It is not
production bootstrap, renderer/IPC, private backup, live Supabase authorization,
provider execution, model dispatch or whole-release acceptance. The independent
HTTP fixture and its whole-service deadline prerequisite remain separate:
[`ceo-conversation-host.test.mjs`](../ceo-conversation-host.test.mjs).

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- [`task-pipeline`](https://github.com/ssheleg/task-pipeline) — bounded implementation and review
- [`evidence-docs`](https://github.com/ssheleg/task-pipeline) — TLS command scope and receipt

<sub>A star on [the bundle](https://github.com/ssheleg/sshlg-skills) helps.</sub>
