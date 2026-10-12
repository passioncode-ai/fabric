// Vendored from passioncode-ai/fabric-agent-contract src/fabric-links.ts at bcada4acae15 (DEC-0040, DEC-0041):
// parseFabricLink and buildFabricLink, unchanged; the contract's FAC-SEM rule (deepLinkRules) is not needed here.
// Re-vendor with the contract; never edit here (only the region's docs: reference names Fabric's scenario) — a fix goes to the contract first.
import { credentialName, nameWords, rawValues, secretValue } from "./secretShape.ts";

// The credential detector moved to src/secret-shape.ts (DEC-0044); what this module exported stays exported here.
export { CREDENTIAL_PAIRS, CREDENTIAL_WORDS, JWT_SHAPE, SECRET_VALUE, credentialName, nameWords, secretValue } from "./secretShape.ts";

// #region fabric-links — docs: docs/ux/scenarios.md#scn-142-open-fabric-from-a-products-button-in-that-products-project-and-go-on-in-a-coding-agent
/**
 * `fabric://` deep links (DEC-0040): what Fabric's button in a product opens. Two actions — a conversation
 * with Fabric scoped to a service or a project, and a coding-agent session in a project. A link opens a view
 * and nothing else; it never carries a secret.
 */

/** An agent id as the hub names one (`interop-agent-call.schema.json` `agentId`): a service id, optionally `.instance`. */
export const AGENT_ID = /^[a-z][a-z0-9-]{1,62}(\.[a-z][a-z0-9-]{0,31})?$/;
/** A project id or slug: no slash, no space, no percent sign left after decoding. */
export const PROJECT_REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
/** A runner kind as the runner catalogue names one (`runners.schema.json`). */
export const RUNNER_KIND = /^[a-z][a-z0-9-]{1,62}$/;
export const MAX_LINK_LENGTH = 2048;

export type FabricLink =
  | { action: "chat"; service?: string; project?: string }
  | { action: "session.new"; project: string; runner?: string };

export type ParsedLink = { ok: true; link: FabricLink; ignored: string[] } | { ok: false; problems: string[] };

const SHAPE = /^fabric:\/\/(chat|session\/new)\/?(?:\?([^#]*))?(?:#(.*))?$/;
const KNOWN: Record<FabricLink["action"], Record<string, RegExp>> = {
  chat: { service: AGENT_ID, project: PROJECT_REF },
  "session.new": { project: PROJECT_REF, runner: RUNNER_KIND }
};
/** Words for Fabric to act on; a link carries ids only (FL-4). */
export const PROMPT_WORDS = ["prompt", "message", "msg", "text", "instruction", "instructions"] as const;
const promptName = (name: string) => nameWords(name).some((word) => (PROMPT_WORDS as readonly string[]).includes(word));
/**
 * Parse a `fabric://` link. Unknown parameters are ignored and listed; a known one that repeats or does not
 * match its id grammar, a missing required one, an unknown action, and any parameter that could carry a
 * credential refuse the whole link.
 */
export function parseFabricLink(url: string): ParsedLink {
  if (url.length > MAX_LINK_LENGTH) return { ok: false, problems: [`a link is at most ${MAX_LINK_LENGTH} characters`] };
  // The scheme is case-insensitive (RFC 3986 §3.1); the action is not.
  const match = SHAPE.exec(url.replace(/^fabric:/i, "fabric:"));
  if (!match) return { ok: false, problems: ["not fabric://chat or fabric://session/new"] };
  const action: FabricLink["action"] = match[1] === "chat" ? "chat" : "session.new";
  // A malformed percent escape stays in the value and fails its id grammar, which admits no `%`.
  const params = new URLSearchParams(match[2] ?? "");
  const problems: string[] = [];
  // The fragment is ignored, but it is part of the link a page hands over: it carries no credential either.
  const fragment = match[3] ?? "";
  if (fragment) {
    // An anchor (`#auth-settings`, `#tokens`) names a place; a credential-named piece with a value carries one.
    const pieces = new URLSearchParams(fragment);
    const raw = [...rawValues(fragment).values()].flat();
    if (secretValue(fragment) || raw.some(secretValue) || [...pieces].some(([name, value]) => (value !== "" && credentialName(name)) || secretValue(value) || secretValue(name))) problems.push("the fragment could carry a credential; a link never does");
  }
  const ignored: string[] = [];
  const values: Record<string, string> = {};
  const known = KNOWN[action];
  const raw = rawValues(match[2] ?? "");
  for (const name of new Set(params.keys())) {
    const all = params.getAll(name);
    if (promptName(name)) { problems.push(`the parameter ${name} carries words to act on; a link carries ids only`); continue; }
    if (credentialName(name) || secretValue(name) || all.some(secretValue) || (raw.get(name) ?? []).some(secretValue)) { problems.push(`the parameter ${name} could carry a credential; a link never does`); continue; }
    const grammar = Object.hasOwn(known, name) ? known[name] : undefined;
    if (!grammar) { ignored.push(name); continue; }
    if (all.length > 1) { problems.push(`${name} is given ${all.length} times`); continue; }
    const value = all[0] ?? "";
    if (!grammar.test(value)) { problems.push(`${name} is not a valid ${name === "service" ? "agent id" : name === "runner" ? "runner kind" : "project id or slug"}`); continue; }
    values[name] = value;
  }
  if (action === "chat" && values.service === undefined && values.project === undefined && !problems.some((p) => /^(service|project) /.test(p))) problems.push("a chat link names a service, a project or both");
  if (action === "session.new" && values.project === undefined && !problems.some((p) => p.startsWith("project "))) problems.push("a session link names its project");
  if (problems.length) return { ok: false, problems };
  const link: FabricLink = action === "chat"
    ? { action, ...(values.service ? { service: values.service } : {}), ...(values.project ? { project: values.project } : {}) }
    : { action, project: values.project as string, ...(values.runner ? { runner: values.runner } : {}) };
  return { ok: true, link, ignored };
}

/** Build the link for a parsed value; throws on a value the grammar refuses, so a page cannot emit a bad link. */
export function buildFabricLink(link: FabricLink): string {
  const query = new URLSearchParams();
  if (link.action === "chat") {
    if (link.service !== undefined) query.set("service", link.service);
    if (link.project !== undefined) query.set("project", link.project);
  } else {
    query.set("project", link.project);
    if (link.runner !== undefined) query.set("runner", link.runner);
  }
  const url = `fabric://${link.action === "chat" ? "chat" : "session/new"}?${query.toString()}`;
  const parsed = parseFabricLink(url);
  if (!parsed.ok) throw new TypeError(parsed.problems.join("; "));
  return url;
}

/** FAC-SEM-052 (DEC-0040): a `fabric://` link a product emits parses under the grammar and carries no credential. Input: `{ url }`. */
// #endregion fabric-links
