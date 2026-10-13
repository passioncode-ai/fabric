# Kimi startup failure: bounded read-only diagnosis

## What is actually observed

The one corrected binary probe remains FAILED_STARTUP: exit -11/SIGSEGV,4.590s, no initialize response, empty captured stdout/stderr, owned data directory empty. No new Kimi/Node/provider/native process was launched in this diagnosis. No sandbox permission changed.

A filename/mtime-only scan of the two standard macOS DiagnosticReports directories found zero files modified within +/-15minutes of the probe receipt mtime2026-10-13T12:01:10.247905Z. No Kimi/Bun report was found. This is not proof macOS never recorded anything: directories outside these two, delayed reports and unified log were not read. The runner did not persist the child PID or exact UTC launch time, so exact PID-correlated crash attribution is unavailable. No unrelated crash body/environment was opened; therefore there is no stack/module receipt to provide.

## Source-backed startup seams, not crash attribution

Installed @moonshot-ai/kimi-code2.1.1 dist/main.mjs490677–490713 executes main → crash handler setup → maybeRelaunchWithStagedNativeUpdate → bootstrap before command parsing. bootstrap installs the native module hook, Minidb text worker and search worker, then creates/parses the CLI. Only later ACP constructs app/core, config/logging and runtime provider before serving initialize (313011–313045,313103–313111). No session is implied by this app bootstrap.

A concrete missing isolation input is visible: getNativeCacheBase381195–381205 uses **KIMI_CODE_CACHE_DIR**, otherwise macOS resolves the real HOME/Library/Caches/kimi-code; KIMI_CODE_HOME does not redirect this native asset cache. Prior strict sandbox denied writes there. This is a relevant source dependency and a testable hypothesis, NOT an established explanation for SIGSEGV. Optional worker extraction catches errors and returns failed/not-sea, so ordinary denied cache writes alone do not establish a fatal code path. Empty owned data output is compatible with early failure but does not identify the last executed line.

Source also supports KIMI_STARTUP_TRACE and KIMI_STARTUP_TRACE_LOG (382036–382057). Trace goes to its explicitly selected file; source labels reveal stage, not credentials. No trace was enabled during the failed run, so none is invented afterward.

## Smallest next acceptance packet (proposed, NOT_RUN)

First preserve the exact failed receipt and restrictive sandbox. A separately authorized single binary initialize-only run can set supported KIMI_CODE_HOME=<owned>/data AND KIMI_CODE_CACHE_DIR=<owned>/cache, preserving original HOME/CODEX_HOME. Optionally add KIMI_STARTUP_TRACE=1 with KIMI_STARTUP_TRACE_LOG=<owned>/startup.log; its diagnostic difference must be explicit. Keep network denied, real credentials/.kimi-code denied except exact executable, and writes only under the same owned root. Do not permit reads of live credentials or global cache writes to get green.

Save script before execution, exact env-key allowlist and sandbox, child PID plus UTC start/end, bounded output, own-group cleanup, executable path/stat/digest and trace before claiming anything. Expected positive is only matching initialize id/protocolVersion with normal bounded exit. Failure remains failure with same strict bounds; no retries or automatic permission expansion. To attribute cause, a passing combined cache+trace run is insufficient proof which input caused prior SIGSEGV; report only contrast under the changed documented inputs. No session/new, prompt, auth, login or provider request. No claim of runtime acceptance or instruction consumption.

## Supported npm entry is a separate runtime comparison

Installed package.json declares bin kimi=dist/main.mjs and engines node>=22.19.0; README documents npm installation as supported alternative. The entry shebang is Node. Existing node resolves to /opt/homebrew/Cellar/node/26.10.0_2/bin/node (path metadata only, not executed); installed external imports include ws8.22.0 and qrcode1.5.4. Do not install or change either.

`<existing node> <installed package>/dist/main.mjs acp` is a distinct interpreter/distribution runtime, not a transparent repair of the tested188MB native executable. Source detectNativeInstall uses node:sea.isSea313942–313950; update preflight skips for non-native490289–490290 and embedded worker setup returns not-sea490389–490392,490435–490438. That makes npm a useful separately authorized diagnostic control, but a PASS there does not clear the native binary SIGSEGV or establish native asset correctness.

A future npm comparison needs its own unchanged-HOME sandbox, declared supported paths, actual Node version/architecture and identity, entry/dependency source hashes, exact command, same initialize-only request, output/exit/timing and boundaries. Source excerpts currently bind only installed npm file fragments, not byte-equivalence to the native executable. No npm comparison was executed here.
