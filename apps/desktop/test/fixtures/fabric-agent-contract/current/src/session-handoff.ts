import { createHash } from "node:crypto";
import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Finding } from "./findings.js";

/*
 * session-handoff/1 (DEC-0042, docs/specification/session-handoff.md): the folder a host hands a coding-agent
 * session before its first turn. This module reads such a folder and checks it — the files, their modes, where
 * the folder lives, the manifest against its schema, and the rules no schema can state (FAC-SEM-053…055).
 *
 * It depends on nothing but Node's built-ins, and its one import of this kit is a type, so a consumer can copy
 * it byte for byte and run it under `node --experimental-strip-types` against a folder it wrote (Fabric does:
 * `apps/desktop/test/session-handoff-conformance.test.mjs`). Such a consumer passes its own compiled schema
 * check; inside this kit the schema check defaults to the contract's own validator.
 */

export const HANDOFF_FORMAT = "session-handoff/1";
export const MANIFEST_FILE = "handoff.json";
export const HANDOFF_FILES = ["context.md", "mcp.json", "brief.md", "task.md"] as const;
/** SH-8: an inline brief fits one argument any carrier passes — Switchboard's in-place limit is 16 × 1024. */
export const MAX_INLINE_BRIEF = 1000;
/** SH-6: the preamble is a pointer, short enough never to compete with the agent's own brief. */
export const MAX_PREAMBLE = 600;
export const MAX_LAUNCH_ARGS = 16;
export const MAX_LAUNCH_ARG = 1024;

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/;
/** A tool name as MCP servers in this family spell them: snake_case with at least one underscore. */
const TOOL_WORD = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g;
/** Names that only a credential travels under — a header, an environment variable or a config key. */
const SECRET_NAME = /(^|[._-])(token|access[_-]?token|secret|password|passwd|api[_-]?key|key|auth|authorization|bearer|cookie|credential|credentials|jwt|session[_-]?id)([._-]|$)/i;
/** Values shaped like a credential: a JWT/JWS, a bearer header value, a provider key. */
const SECRET_VALUE = /(eyJ[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]*|bearer\s+\S+|sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,})/i;
const words = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, "$1_$2");
const secretName = (name: string) => SECRET_NAME.test(words(name));

/** One entry of a handoff folder as read from disk (or written in a fixture). `mode` is octal, e.g. "600". */
export interface HandoffEntry {
  mode: string;
  kind: "file" | "directory" | "symlink";
  /** The file's bytes as UTF-8; absent for a directory or a link. */
  text?: string;
}

/** A handoff folder, read. Pure data: the rules below never touch the filesystem. */
export interface HandoffSnapshot {
  /** The folder's absolute path. */
  path: string;
  /** The folder's own mode, octal; `kind` is "symlink" when the path itself is a link. */
  mode: string;
  kind: "directory" | "symlink";
  /** `posix` checks modes; `acl` (Windows) leaves access to the profile's ACL and skips them. */
  permissions: "posix" | "acl";
  /** The nearest ancestor that holds `.git`, or null: the folder is never inside a repository. */
  repository: string | null;
  entries: Record<string, HandoffEntry>;
}

export interface SchemaError { instancePath: string; keyword: string; message?: string | undefined }
export type SchemaCheck = (manifest: unknown) => { valid: boolean; errors: SchemaError[] };
export interface SessionHandoffVerdict {
  valid: boolean;
  /** The manifest against `session-handoff.schema.json`; empty when handoff.json could not be read. */
  schemaErrors: SchemaError[];
  findings: Finding[];
}

const octal = (mode: number) => (mode & 0o777).toString(8).padStart(3, "0");

/** The nearest ancestor of `dir` (itself included) holding `.git` — a working tree, a worktree or a submodule. */
export function enclosingRepository(dir: string): string | null {
  let at = path.resolve(dir);
  for (;;) {
    if (existsSync(path.join(at, ".git"))) return at;
    const up = path.dirname(at);
    if (up === at) return null;
    at = up;
  }
}

/** Read a handoff folder without following links. Throws only when the path does not exist. */
export function readSessionHandoff(dir: string): HandoffSnapshot {
  const absolute = path.resolve(dir);
  const self = lstatSync(absolute);
  const snapshot: HandoffSnapshot = {
    path: absolute,
    mode: octal(self.mode),
    kind: self.isSymbolicLink() ? "symlink" : "directory",
    permissions: process.platform === "win32" ? "acl" : "posix",
    repository: enclosingRepository(absolute),
    entries: {}
  };
  if (snapshot.kind === "symlink" || !self.isDirectory()) return snapshot;
  for (const name of readdirSync(absolute).sort()) {
    const entry = lstatSync(path.join(absolute, name));
    if (entry.isSymbolicLink()) snapshot.entries[name] = { mode: octal(entry.mode), kind: "symlink" };
    else if (entry.isDirectory()) snapshot.entries[name] = { mode: octal(entry.mode), kind: "directory" };
    else snapshot.entries[name] = { mode: octal(entry.mode), kind: "file", text: readFileSync(path.join(absolute, name), "utf8") };
  }
  return snapshot;
}

/**
 * Read a folder and check it whole: FAC-SEM-054 (files, modes, place), the manifest against the schema,
 * FAC-SEM-053 (the manifest's declarations agree) and FAC-SEM-055 (mcp.json and secrets). `schema` is a
 * compiled check of `session-handoff.schema.json`; omitted, the contract's own validator is loaded.
 */
export async function validateSessionHandoff(dir: string, options: { schema?: SchemaCheck } = {}): Promise<SessionHandoffVerdict> {
  const snapshot = readSessionHandoff(dir);
  const schema = options.schema ?? (await contractSchemaCheck());
  return checkSessionHandoff(snapshot, schema);
}

/** The same check on a snapshot already read (or built by a test). */
export function checkSessionHandoff(snapshot: HandoffSnapshot, schema: SchemaCheck): SessionHandoffVerdict {
  const manifest = parsedManifest(snapshot);
  const schemaErrors = manifest === undefined ? [] : schema(manifest).errors;
  const findings = sessionHandoffFolderFindings(snapshot);
  return { valid: schemaErrors.length === 0 && findings.length === 0, schemaErrors, findings };
}

async function contractSchemaCheck(): Promise<SchemaCheck> {
  // Loaded only inside the kit: a consumer that copied this file passes its own check and never reaches here.
  const kit = "./validator.js";
  const contract = "./contract.js";
  const { createValidator, validateDocument } = (await import(kit)) as typeof import("./validator.js");
  const { SCHEMA_PREFIX } = (await import(contract)) as typeof import("./contract.js");
  const validator = await createValidator();
  return (manifest) => validateDocument(validator, `${SCHEMA_PREFIX}schemas/session-handoff.schema.json`, manifest);
}

function parsedManifest(snapshot: HandoffSnapshot): Json | undefined {
  const entry = snapshot.entries[MANIFEST_FILE];
  if (!entry || entry.kind !== "file" || entry.text === undefined) return undefined;
  try {
    const value: unknown = JSON.parse(entry.text);
    return isObject(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

const sem053 = (instancePath: string, message: string): Finding => ({ code: "FAC-SEM-053", instancePath, message });
const sem054 = (instancePath: string, message: string): Finding => ({ code: "FAC-SEM-054", instancePath, message });
const sem055 = (instancePath: string, message: string): Finding => ({ code: "FAC-SEM-055", instancePath, message });

/** The value following `flag`, in either the spaced (`flag value`) or the joined (`flag=value`) form. */
function flagValues(args: string[], flag: string): string[] {
  const out: string[] = [];
  args.forEach((arg, index) => {
    if (arg === flag) out.push(args[index + 1] ?? "");
    else if (arg.startsWith(`${flag}=`)) out.push(arg.slice(flag.length + 1));
  });
  return out;
}
/** Codex `-c key=value` overrides, as [key, value]. */
function codexOverrides(args: string[]): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  args.forEach((arg, index) => {
    const pair = arg === "-c" || arg === "--config" ? args[index + 1] : arg.startsWith("--config=") ? arg.slice(9) : undefined;
    if (pair === undefined) return;
    const at = pair.indexOf("=");
    out.push(at < 0 ? [pair, ""] : [pair.slice(0, at), pair.slice(at + 1)]);
  });
  return out;
}

/**
 * FAC-SEM-053 (SH-5…SH-12): what the manifest declares agrees with itself — the bearer's lifetime, the preamble,
 * the brief's delivery, and the per-runtime launch table. Pure: it reads the manifest only.
 */
export function sessionHandoffManifestFindings(manifest: Json): Finding[] {
  const findings: Finding[] = [];
  const lifetime = isObject(manifest.lifetime) ? manifest.lifetime : {};
  const mcp = isObject(manifest.mcp) ? manifest.mcp : {};
  const firstCall = isObject(manifest.firstCall) ? manifest.firstCall : {};
  const brief = isObject(manifest.brief) ? manifest.brief : {};
  const launch = isObject(manifest.launch) ? manifest.launch : {};
  const files = strings(manifest.files);
  const preamble = typeof manifest.preamble === "string" ? manifest.preamble : "";
  const tool = typeof firstCall.tool === "string" ? firstCall.tool : "";
  const server = typeof firstCall.server === "string" ? firstCall.server : "";

  // SH-5 — a one-shot bearer lives in a per-session folder, never in a pack kept per agent key.
  if (mcp.auth === "bearer" && lifetime.kind !== "session") findings.push(sem053("/lifetime/kind", "a bearer is minted for one session; a pack kept per agent key holds no secret (mcp.auth none)"));

  // SH-6 — the preamble names one tool, the first call, and holds no rule; it is one line.
  if (preamble.length > MAX_PREAMBLE) findings.push(sem053("/preamble", `the preamble is at most ${MAX_PREAMBLE} characters; this one ${preamble.length}`));
  if (CONTROL.test(preamble)) findings.push(sem053("/preamble", "the preamble is one line with no control character"));
  if (tool && !new RegExp(`\\b${tool}\\b`).test(preamble)) findings.push(sem053("/preamble", `the preamble names the first call, ${tool}`));
  const named = [...new Set(preamble.match(TOOL_WORD) ?? [])].filter((word) => word !== tool);
  if (named.length) findings.push(sem053("/preamble", `the preamble names one tool, the first call; it also names ${named.join(", ")} — a rule in the preamble is a rule in two places`));

  // SH-8 — inline: one argument any carrier passes, ending with the preamble; file: brief.md.
  if (brief.delivery === "inline") {
    const text = typeof brief.text === "string" ? brief.text : "";
    if (text.length > MAX_INLINE_BRIEF) findings.push(sem053("/brief/text", `an inline brief is at most ${MAX_INLINE_BRIEF} characters; deliver this one (${text.length}) as brief.md`));
    if (CONTROL.test(text)) findings.push(sem053("/brief/text", "an inline brief holds no control character (a newline included); deliver a multi-line brief as brief.md"));
    if (preamble && !text.endsWith(preamble)) findings.push(sem053("/brief/text", "the brief ends with the preamble, so the last thing the session is told is where its rules live"));
    if (files.includes("brief.md")) findings.push(sem053("/files", "an inline brief has no brief.md: one text, one home"));
  } else if (brief.delivery === "file" && !files.includes("brief.md")) {
    findings.push(sem053("/files", "a brief delivered as a file lists brief.md"));
  }

  // SH-10 — generic launch limits: what any carrier passes, and no credential on a command line.
  const args = strings(launch.args);
  const env = isObject(launch.env) ? launch.env : {};
  args.forEach((arg, index) => {
    if (CONTROL.test(arg)) findings.push(sem053(`/launch/args/${index}`, "a launch argument holds no control character"));
    if (SECRET_VALUE.test(arg)) findings.push(sem053(`/launch/args/${index}`, "a launch argument never carries a credential: a process listing shows it"));
  });
  for (const [name, value] of Object.entries(env)) {
    if (typeof value !== "string") continue;
    if (CONTROL.test(value)) findings.push(sem053(`/launch/env/${name}`, "an environment value is recorded only when it is one plain line; withhold a document as null"));
    if (secretName(name) || SECRET_VALUE.test(value)) findings.push(sem053(`/launch/env/${name}`, "a value that carries a credential is withheld as null"));
  }

  // SH-11 — the per-runtime table.
  const runtime = typeof launch.runtime === "string" ? launch.runtime : "";
  const strict = mcp.strict === true;
  const at = "/launch/args";
  if (runtime === "claude-code") {
    if (args.includes("--mcp-config")) findings.push(sem053(at, "Claude Code takes the joined --mcp-config=<path>: the spaced form leaves its variadic list open, and the next value is read as one more config"));
    const configs = args.filter((arg) => arg.startsWith("--mcp-config="));
    if (configs.length !== 1) findings.push(sem053(at, `Claude Code is given exactly one --mcp-config=<path>/mcp.json; found ${configs.length}`));
    for (const config of configs) {
      const value = config.slice("--mcp-config=".length);
      if (!path.isAbsolute(value) || path.basename(value) !== "mcp.json") findings.push(sem053(at, `--mcp-config names the handoff's mcp.json by its absolute path; found ${value}`));
    }
    if (args.includes("--strict-mcp-config") !== strict) findings.push(sem053(at, strict ? "mcp.strict is true, so Claude Code is given --strict-mcp-config" : "mcp.strict is false, so Claude Code is not given --strict-mcp-config"));
    const inline = flagValues(args, "--append-system-prompt");
    const file = flagValues(args, "--append-system-prompt-file");
    if (brief.delivery === "inline" && (inline.length !== 1 || inline[0] !== brief.text || file.length)) findings.push(sem053(at, "an inline brief is the one value of --append-system-prompt"));
    if (brief.delivery === "file") {
      if (file.length !== 1 || inline.length) findings.push(sem053(at, "a brief file is the one value of --append-system-prompt-file"));
      for (const value of file) if (!path.isAbsolute(value) || path.basename(value) !== "brief.md") findings.push(sem053(at, `--append-system-prompt-file names the handoff's brief.md by its absolute path; found ${value}`));
    }
  } else if (runtime === "codex") {
    const overrides = codexOverrides(args);
    const own = overrides.filter(([key]) => key.startsWith(`mcp_servers.${server}.`)).map(([key]) => key.slice(`mcp_servers.${server}.`.length));
    if (mcp.auth === "none" && !own.includes("command")) findings.push(sem053(at, `Codex is given the stdio server as -c mcp_servers.${server}.command=…`));
    if (mcp.auth === "bearer") {
      if (!own.includes("url")) findings.push(sem053(at, `Codex is given the HTTP server as -c mcp_servers.${server}.url=…`));
      const variable = overrides.find(([key]) => key === `mcp_servers.${server}.bearer_token_env_var`)?.[1].replace(/^"|"$/g, "");
      if (!variable || !Object.hasOwn(env, variable) || env[variable] !== null) findings.push(sem053(at, `Codex reads the bearer from the variable bearer_token_env_var names, set and withheld as null in launch.env`));
    }
    if (strict) findings.push(sem053("/mcp/strict", "Codex offers no switch that loads only the handoff's servers; mcp.strict is false"));
  } else if (runtime === "kilo") {
    if (!Object.hasOwn(env, "KILO_CONFIG_CONTENT") || env.KILO_CONFIG_CONTENT !== null) findings.push(sem053("/launch/env", "Kilo is given its session config in KILO_CONFIG_CONTENT, withheld as null: it carries the bearer"));
    if (brief.delivery !== "file") findings.push(sem053("/brief/delivery", "Kilo reads instructions from files: its brief is brief.md"));
    if (strict) findings.push(sem053("/mcp/strict", "Kilo offers no switch that loads only the handoff's servers; mcp.strict is false"));
    if (args.length) findings.push(sem053(at, "Kilo's handoff travels in KILO_CONFIG_CONTENT, not in arguments"));
  } else if (runtime === "hermes") {
    if ((env.HERMES_ACP_SKIP_CONFIGURED_MCP === "1") !== strict) findings.push(sem053("/launch/env", strict ? "mcp.strict is true, so Hermes is started with HERMES_ACP_SKIP_CONFIGURED_MCP=1" : "mcp.strict is false, so HERMES_ACP_SKIP_CONFIGURED_MCP is not set"));
  } else if (runtime === "kimi-code" || runtime === "cline") {
    if (strict) findings.push(sem053("/mcp/strict", `${runtime} offers no measured switch that loads only the handoff's servers; mcp.strict is false`));
  }
  return findings;
}

const sha256 = (text: string) => `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;

/**
 * FAC-SEM-054 (SH-1…SH-4, SH-12) and FAC-SEM-055 (SH-9, SH-13), plus FAC-SEM-053 on the manifest the folder holds:
 * everything a folder can be checked for without its schema.
 */
export function sessionHandoffFolderFindings(snapshot: HandoffSnapshot): Finding[] {
  const findings: Finding[] = [];
  const posix = snapshot.permissions === "posix";
  // SH-1 — where it lives.
  if (snapshot.kind !== "directory") return [sem054("", "the handoff is a folder, not a link to one")];
  if (snapshot.repository !== null) findings.push(sem054("", `the handoff lives in the host's user data, never in a repository; this folder is inside ${snapshot.repository}`));
  // SH-2 — modes.
  if (posix && snapshot.mode !== "700") findings.push(sem054("", `the folder is 0700; this one ${snapshot.mode}`));
  const manifestEntry = snapshot.entries[MANIFEST_FILE];
  const manifest = parsedManifest(snapshot);
  if (!manifestEntry) return [...findings, sem054(`/${MANIFEST_FILE}`, "the folder holds handoff.json")];
  if (manifest === undefined) return [...findings, sem054(`/${MANIFEST_FILE}`, "handoff.json is a regular file holding a JSON object")];
  if (manifest.format !== HANDOFF_FORMAT) findings.push(sem054(`/${MANIFEST_FILE}`, `handoff.json declares ${HANDOFF_FORMAT}`));
  const listed = strings(manifest.files).filter((name): name is (typeof HANDOFF_FILES)[number] => (HANDOFF_FILES as readonly string[]).includes(name));
  // SH-3 — the declared files, and nothing else.
  for (const name of [MANIFEST_FILE, ...listed]) {
    const entry = snapshot.entries[name];
    if (!entry) { findings.push(sem054(`/${name}`, `${name} is listed and missing`)); continue; }
    if (entry.kind !== "file") { findings.push(sem054(`/${name}`, `${name} is a regular file, not a ${entry.kind}`)); continue; }
    if (posix && entry.mode !== "600") findings.push(sem054(`/${name}`, `${name} is 0600; this one ${entry.mode}`));
    if (name !== MANIFEST_FILE && !(entry.text ?? "").trim()) findings.push(sem054(`/${name}`, `${name} is not empty`));
  }
  for (const name of Object.keys(snapshot.entries)) {
    if (name !== MANIFEST_FILE && !(listed as string[]).includes(name)) findings.push(sem054(`/${name}`, `${name} is not a file of the handoff; a folder holds handoff.json and the files it lists, nothing else`));
  }
  const text = (name: string) => {
    const entry = snapshot.entries[name];
    return entry?.kind === "file" ? entry.text ?? "" : undefined;
  };
  // SH-12 — the integrity layer underneath: each digest names these bytes.
  const integrity = isObject(manifest.integrity) ? manifest.integrity : undefined;
  if (integrity && isObject(integrity.parts)) {
    for (const [name, digest] of Object.entries(integrity.parts)) {
      const bytes = text(name);
      if (bytes === undefined) findings.push(sem054(`/integrity/parts/${name}`, `${name} has a digest and is not in the folder`));
      else if (digest !== sha256(bytes)) findings.push(sem054(`/integrity/parts/${name}`, `${name} does not match its execution-packet digest`));
    }
  }
  // SH-4 — the launch names this folder's own files.
  const launch = isObject(manifest.launch) ? manifest.launch : {};
  const args = strings(launch.args);
  if (launch.runtime === "claude-code") {
    for (const value of flagValues(args, "--mcp-config")) if (value !== path.join(snapshot.path, "mcp.json")) findings.push(sem054("/launch/args", `--mcp-config names this folder's mcp.json, ${path.join(snapshot.path, "mcp.json")}; found ${value}`));
    for (const value of flagValues(args, "--append-system-prompt-file")) if (value !== path.join(snapshot.path, "brief.md")) findings.push(sem054("/launch/args", `--append-system-prompt-file names this folder's brief.md; found ${value}`));
  }
  const brief = isObject(manifest.brief) ? manifest.brief : {};
  const preamble = typeof manifest.preamble === "string" ? manifest.preamble : "";
  const briefText = text("brief.md");
  if (brief.delivery === "file" && briefText !== undefined && preamble && !briefText.trimEnd().endsWith(preamble)) findings.push(sem053("/brief.md", "the brief ends with the preamble, so the last thing the session is told is where its rules live"));

  findings.push(...sessionHandoffManifestFindings(manifest));
  findings.push(...mcpFindings(manifest, text));
  return findings;
}

/** FAC-SEM-055 (SH-9, SH-13): mcp.json reaches the first call's server as `mcp.auth` declares, and no secret leaves it. */
function mcpFindings(manifest: Json, text: (name: string) => string | undefined): Finding[] {
  const findings: Finding[] = [];
  const raw = text("mcp.json");
  if (raw === undefined) return findings;
  let config: unknown;
  try { config = JSON.parse(raw); } catch { return [sem055("/mcp.json", "mcp.json is JSON")]; }
  const servers = isObject(config) && isObject(config.mcpServers) ? config.mcpServers : undefined;
  if (!servers) return [sem055("/mcp.json", "mcp.json holds an mcpServers object")];
  const mcp = isObject(manifest.mcp) ? manifest.mcp : {};
  const firstCall = isObject(manifest.firstCall) ? manifest.firstCall : {};
  const server = typeof firstCall.server === "string" ? firstCall.server : "";
  const entry = servers[server];
  if (!isObject(entry)) findings.push(sem055(`/mcp.json/mcpServers/${server}`, `mcp.json names the first call's server, ${server}`));
  else if (mcp.auth === "bearer") {
    const headers = isObject(entry.headers) ? entry.headers : {};
    if (entry.type !== "http" || typeof entry.url !== "string" || !/^https?:\/\//.test(entry.url)) findings.push(sem055(`/mcp.json/mcpServers/${server}`, "a bearer server is reached over HTTP: type http and an http(s) url"));
    if (typeof headers.Authorization !== "string" || !/^Bearer \S+$/.test(headers.Authorization)) findings.push(sem055(`/mcp.json/mcpServers/${server}/headers`, "a bearer server carries Authorization: Bearer <one-shot token>"));
  } else if (mcp.auth === "none") {
    if (entry.type !== "stdio" || typeof entry.command !== "string" || !entry.command) findings.push(sem055(`/mcp.json/mcpServers/${server}`, "a server with no secret is a stdio command: type stdio and a command"));
  }
  // Every value mcp.json may hold a secret in: header values and environment values.
  const secrets: string[] = [];
  for (const [name, value] of Object.entries(servers)) {
    if (!isObject(value)) continue;
    const headers = isObject(value.headers) ? value.headers : {};
    const env = isObject(value.env) ? value.env : {};
    for (const [header, headerValue] of Object.entries(headers)) {
      if (typeof headerValue !== "string") continue;
      if (mcp.auth === "none") findings.push(sem055(`/mcp.json/mcpServers/${name}/headers/${header}`, "a handoff with no secret carries no header"));
      secrets.push(headerValue.replace(/^Bearer\s+/i, ""));
    }
    for (const [variable, envValue] of Object.entries(env)) {
      if (typeof envValue !== "string") continue;
      const credential = secretName(variable) || SECRET_VALUE.test(envValue);
      if (credential) secrets.push(envValue);
      if (credential && mcp.auth === "none") findings.push(sem055(`/mcp.json/mcpServers/${name}/env/${variable}`, "a handoff with no secret carries no credential in a server's environment"));
    }
    for (const field of ["url", "command"] as const) {
      const value2 = value[field];
      if (mcp.auth === "none" && typeof value2 === "string" && SECRET_VALUE.test(value2)) findings.push(sem055(`/mcp.json/mcpServers/${name}/${field}`, "a handoff with no secret carries no credential"));
    }
    for (const [index, arg] of strings(value.args).entries()) if (SECRET_VALUE.test(arg)) findings.push(sem055(`/mcp.json/mcpServers/${name}/args/${index}`, "a server's arguments never carry a credential: a process listing shows them"));
  }
  // SH-13 — a secret lives in mcp.json and nowhere else in the folder.
  for (const secret of secrets.filter((value) => value.length >= 8)) {
    for (const name of [MANIFEST_FILE, "context.md", "brief.md", "task.md"]) {
      if ((text(name) ?? "").includes(secret)) findings.push(sem055(`/${name}`, `${name} repeats a credential from mcp.json; a secret lives in mcp.json only`));
    }
  }
  return findings;
}

/**
 * The semantic-rule entry points (`evaluateSemanticRules`): `session-handoff` is a manifest, `session-handoff-folder`
 * a snapshot whose entries may give a file's `json` instead of its `text` (fixtures are easier to read that way).
 */
export function sessionHandoffRules(kind: string, value: Json): Finding[] | undefined {
  if (kind === "session-handoff") return sessionHandoffManifestFindings(value);
  if (kind === "session-handoff-folder") return sessionHandoffFolderFindings(snapshotFromFixture(value));
  return undefined;
}

/** A fixture's folder: `entries.<name>.json` is serialised to `text`. */
export function snapshotFromFixture(value: Json): HandoffSnapshot {
  const entries: Record<string, HandoffEntry> = {};
  for (const [name, raw] of Object.entries(isObject(value.entries) ? value.entries : {})) {
    if (!isObject(raw)) continue;
    const kind = raw.kind === "directory" || raw.kind === "symlink" ? raw.kind : "file";
    const text = typeof raw.text === "string" ? raw.text : raw.json !== undefined ? `${JSON.stringify(raw.json, null, 2)}\n` : undefined;
    entries[name] = { mode: String(raw.mode ?? "600"), kind, ...(kind === "file" && text !== undefined ? { text } : {}) };
  }
  return {
    path: String(value.path ?? ""),
    mode: String(value.mode ?? "700"),
    kind: value.kind === "symlink" ? "symlink" : "directory",
    permissions: value.permissions === "acl" ? "acl" : "posix",
    repository: typeof value.repository === "string" ? value.repository : null,
    entries
  };
}
