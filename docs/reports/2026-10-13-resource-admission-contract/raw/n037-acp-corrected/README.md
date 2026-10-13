# Corrected offline Hermes ACP initialization

Exact `probe.py` was saved before execution and executed once. Installed source establishes HERMES_HOME in hermes_constants.py107–114,156–163 and startup normalization in hermes_cli/main.py28–40; source-support.json binds file hashes and excerpts. No guessed equivalent was used for Kimi.

Child HOME equals the unchanged original process HOME (asserted before spawn and recorded true); CODEX_HOME was neither assigned nor redirected. Only documented HERMES_HOME selects the owned temporary data directory. Minimal environment has no inherited tokens. Sandbox denies network, real credential directories, Keychain filesystem and named keychain Mach services; all writes except the owned temporary directory are denied. A startup refusal would not widen these permissions.

Observed Hermes0.21.4 initialize reply protocolVersion1, exit0,3.105seconds. Only one initialize request was sent. No session, prompt, auth, setup, login or provider call; advertised authMethods/capabilities are not invoked or validated behavior. Kimi corrected probe is NOT_RUN because a supported host-specific isolation mechanism was not established. Prior HOME-substitution probes remain historical NONCONFORMING and are not credited; exact hashes are in correction-audit-trail.json.

Reproduction: `python3 probe.py` only under equivalent explicit task authorization. Each execution creates a fresh host-specific owned directory; this exact script expects its host directory not to exist, so use a fresh copy of public artifacts before replay. Hard bounded receive phase26s followed by <=2.5s cleanup; sequential single-host execution. Saved profiles normalize home/temp prefixes; outputs normalize paths. Captured stdout/stderr ends at initialize response or refusal, not an exhaustive shutdown trace.

Entry digest pins the small installed launcher only; installed modules have separately listed source hashes. It does not attest the whole Python environment. This is corrected protocol reconnaissance, not full N037/native acceptance. Archive only manifest-listed files, never owned-home runtime files.
