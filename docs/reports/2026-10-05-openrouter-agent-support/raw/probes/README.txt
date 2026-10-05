Probed 2026-10-05 on macOS (Darwin 25.6.0) with acp-initialize-probe.mjs: initialize {protocolVersion: 1, clientCapabilities: {fs: false, terminal: false}}.
kilo 7.4.17 (/opt/homebrew/bin/kilo): `kilo acp` -> mcpCapabilities {http: true, sse: true}, loadSession true.
cline 3.0.46 (/opt/homebrew/bin/cline): `cline --acp` -> no mcpCapabilities (stdio MCP only, the ACP baseline), loadSession true.

Later the same day (Fabric P-10, ADR-0119 amendments 1-2):
- kilo 7.4.17: KILO_CONFIG_CONTENT outranks a project kilo.json, KILO_CONFIG does not (kilo-7.4.17-config-precedence.txt);
  the bundle compiler's own config connects (kilo-7.4.17-bundle-end-to-end.txt); over ACP the shell used HTTP, 4 requests
  (kilo-acp-shell-end-to-end.txt).
- hermes 0.21.4 (brew hermes-agent 2026.9.21): `hermes acp` declares no mcpCapabilities (hermes-0.21.4-initialize.json);
  through Fabric's real launch path it took the stdio bridge and made 4 authorised requests
  (hermes-0.21.4-fabric-pty-end-to-end.txt, hermes-0.21.4-acp-shell-end-to-end.txt). Its provider refused the brief:
  no model chosen in Hermes on this machine.
- cline 3.0.46: session/new answers "Authentication required: Call authenticate before creating a session."; the
  global `cline` package disappeared from /opt/homebrew/lib/node_modules twice on this machine after a run (reinstalled
  with npm install -g cline@3.0.46, npm skipping its install scripts by policy). Not connected.
- Probe ports moved to 48100+ after one collided with the communicator gateway on 47835.
