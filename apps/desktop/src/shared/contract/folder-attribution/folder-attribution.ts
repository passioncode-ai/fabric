import { type Finding, type JsonObject, isObject, jsonEqual } from "./findings.js";
import { secretUrl } from "./secret-shape.js";

// #region folder-attribution, docs: docs/specification/folder-attribution.md
/**
 * Folder attribution (DEC-0089, CT-57): which Project a folder a coding agent works in belongs to, decided once for
 * Fabric, Fabric Switchboard and Project Observatory. `attributeFolder` reads a snapshot of what a product knows (the
 * folder, its Git facts, the Projects with their folders and sources, the work records, the tombstones) and answers in
 * the order of folder-attribution.md's AT table; it reads no file system, so every product gets the same answer from the same
 * facts. attributeFolder, explainFolder, normalizeOrigin and isPath answer any value and never throw: malformed input is
 * an answer; the other exports take the strings their types name.
 */

/** A path: absolute, `/`-separated (a Windows path written `C:/...`, its drive letter upper case), no empty, `.` or `..` segment, no trailing `/`. */
const PATH = /^(?:\/|[A-Z]:\/)(?:[^/]+(?:\/[^/]+)*)?$/;
const MAX_PATH = 4096;
const MAX_LIST = 10_000;
/** The schemes a remote names a repository by (DEC-0089 item 2). */
const SCHEMES = ["http", "https", "ssh", "git", "git+ssh", "git+https"];

const isString = (value: unknown): value is string => typeof value === "string";
/** A length in code points, as JSON Schema's `maxLength` counts. */
/**
 * Whether `value` has at most `max` code points, the schema's `maxLength`. A code point is one or two UTF-16 units, so
 * a string of at most `max` units always is and one of more than `2 * max` never is; only between them are they counted.
 */
const within = (value: string, max: number): boolean => {
  if (value.length <= max) return true;
  if (value.length > 2 * max) return false;
  let count = 0;
  for (const _ of value) if (++count > max) return false;
  return true;
};
/** `#/$defs/projectId`: 1 to 256 characters. */
const idOk = (value: unknown): value is string => isString(value) && value.length > 0 && within(value, 256);
/** An origin member: absent, `null`, or a string of at most 4096 characters. */
const originOk = (value: unknown) => value === undefined || value === null || (isString(value) && within(value, MAX_PATH));
const own = (value: unknown, key: string): unknown => (isObject(value) && Object.hasOwn(value, key) ? value[key] : undefined);
const list = (value: unknown): unknown[] | undefined => (Array.isArray(value) && value.length <= MAX_LIST ? value : undefined);
/** `value` with A to Z lower-cased and nothing else (a non-ASCII letter keeps its case). */
const asciiLower = (value: string) => value.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
/** `value` without its leading and trailing `/`, in linear time (a regular expression for the trailing run is quadratic). */
function trimSlashes(value: string, leading: boolean): string {
  let start = 0;
  let end = value.length;
  while (leading && start < end && value[start] === "/") start += 1;
  while (end > start && value[end - 1] === "/") end -= 1;
  return value.slice(start, end);
}

/** Whether `value` is a path in the form above. */
export function isPath(value: unknown): value is string {
  return isString(value) && within(value, MAX_PATH) && PATH.test(value) && !value.split("/").some((segment) => segment === "." || segment === "..");
}
const isRoot = (path: string) => path === "/" || /^[A-Z]:\/$/.test(path);
/** Whether `path` is `base` or lies under it, segment by segment (`/a/bc` is not under `/a/b`). */
export function under(path: string, base: string): boolean {
  if (path === base) return true;
  return path.startsWith(isRoot(base) ? base : `${base}/`);
}
/** The parent of a path that is not a root (callers test a root first). */
const parentOf = (path: string): string => {
  const cut = path.lastIndexOf("/");
  const parent = path.slice(0, cut);
  return parent === "" ? "/" : /^[A-Z]:$/.test(parent) ? `${parent}/` : parent;
};

/**
 * A remote's repository identity (DEC-0089 item 2): `host/path`, lower-cased, from a URL with one of `SCHEMES` or the scp
 * form `[user@]host:path`; the user, a password or token, the port, a query, a fragment, a trailing `/` and one trailing
 * `.git` dropped. The host has a dot and the path at least two segments (`owner/name`, or a group path `group/sub/name`).
 * Undefined for a local path, `file:`, another scheme or anything else.
 */
export function normalizeOrigin(raw: unknown): string | undefined {
  if (!isString(raw) || !within(raw, MAX_PATH)) return undefined;
  const value = raw.trim();
  let host: string;
  let path: string;
  const scheme = /^([a-z][a-z0-9+.-]*):\/\//i.exec(value);
  if (scheme) {
    if (!SCHEMES.includes(String(scheme[1]).toLowerCase())) return undefined;
    const rest = String(value.slice(scheme[0].length).split(/[?#]/)[0]);
    const slash = rest.indexOf("/");
    if (slash < 0) return undefined;
    host = rest.slice(0, slash);
    path = rest.slice(slash + 1);
  } else {
    if (value.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value) || value.startsWith(".")) return undefined;
    const scp = /^(?:[^@/\s]+@)?([^:/\s]+):([^\s]+)$/.exec(value);
    if (!scp) return undefined;
    host = String(scp[1]);
    path = String(String(scp[2]).split(/[?#]/)[0]);
  }
  host = asciiLower(host.slice(host.lastIndexOf("@") + 1).replace(/:[0-9]*$/, ""));
  path = asciiLower(trimSlashes(path, true));
  if (path.endsWith(".git")) path = path.slice(0, -4);
  const segments = path.split("/");
  if (!/^[a-z0-9.-]+$/.test(host) || !host.includes(".") || segments.length < 2 || segments.some((segment) => segment === "" || /\s/.test(segment))) return undefined;
  return `${host}/${segments.join("/")}`;
}
/**
 * The origin a record keeps (*Recording the answer*): the raw remote without what can carry a credential, so no
 * product's store holds a token from a remote URL. An `http`/`https` URL loses its user information, any URL its
 * password, query and fragment, the scp form `user:secret@host:path` its `:secret` and its query; a local path is kept.
 * Its identity is the raw remote's. `null` when what is left still has the shape of a secret.
 */
export function recordOrigin(origin: string | null): string | null {
  if (origin === null) return null;
  let value = origin.trim();
  const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):\/\//.exec(value);
  const userOf = (info: string) => String(info.split(":")[0]);
  if (scheme) {
    // A URL with no repository identity names no repository a rule could match, and its authority cannot be read
    // reliably (a password holding `/`, `?` or `#`): nothing of it is kept.
    if (normalizeOrigin(value) === undefined) return null;
    const rest = String(value.slice(scheme[0].length).split(/[?#]/)[0]);
    // A URL with an identity has a path, so its authority ends at the first `/`.
    const slash = rest.indexOf("/");
    const authority = rest.slice(0, slash);
    const at = authority.lastIndexOf("@");
    const user = at < 0 || /http/i.test(String(scheme[1])) ? "" : userOf(authority.slice(0, at));
    value = `${scheme[0]}${user === "" ? "" : `${user}@`}${authority.slice(at + 1)}${rest.slice(slash)}`;
  } else if (!(value.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value) || value.startsWith("."))) {
    const scp = /^(?:([^@/\s]+)@)?([^:/\s]+):([^\s]+)$/.exec(value);
    // The host ends the user information at its last `@`, as normalizeOrigin reads it, so no part of a password is kept.
    const host = String(scp?.[2]);
    // A remote that is not a local path and has no identity cannot be read reliably: nothing of it is kept.
    if (!scp || normalizeOrigin(value) === undefined) return null;
    value = `${scp[1] === undefined ? "" : `${userOf(scp[1])}@`}${host.slice(host.lastIndexOf("@") + 1)}:${String(String(scp[3]).split(/[?#]/)[0])}`;
  }
  // The kept origin names the same repository as the raw one, by construction: a rebuilt form whose identity differs
  // (an scp remote read as a URL, say) is not kept.
  return secretUrl(value) || normalizeOrigin(value) !== normalizeOrigin(origin) ? null : value;
}

/** The owner of a normalized repository identity: every segment but the last (`host/owner`, `host/group/sub`). */
export const ownerOf = (repository: string): string => repository.slice(0, repository.lastIndexOf("/"));

/** `path` relative to `top`, which holds it: `""` for the top itself, else its segments below it. */
const relativeTo = (path: string, top: string): string => (path === top ? "" : path.slice(isRoot(top) ? top.length : top.length + 1));
/** Whether the relative path `rel` is `base` or lies under it (`""` holds every path). */
const relUnder = (rel: string, base: string): boolean => base === "" || rel === base || rel.startsWith(`${base}/`);

/** Whether `path` lies in a tool's own folder: a hidden folder directly in home, `Library` or `AppData` (Switchboard SB-131). */
function inToolFolder(path: string, home: string): boolean {
  if (path === home || !under(path, home)) return false;
  const first = String(path.slice(home.length).replace(/^\//, "").split("/")[0]);
  return first.startsWith(".") || first === "Library" || first === "AppData";
}

/** What a product records after an answer (folder-attribution.md, *Recording the answer*): a folder of the attached Project. */
export interface AttributionRecord {
  path: string;
  commonDir: string | null;
  origin: string | null;
  toplevel: string | null;
}
/** The answer, the AT row that decided it, and what to record (`null`: nothing). */
export interface AttributionExplained {
  answer: Attribution;
  row: number;
  record: AttributionRecord | null;
}
export type AttributionRule = "explicit" | "folder" | "worktree" | "repository" | "owner" | "work";
export type Attribution =
  | { outcome: "attached"; project: string; rule: AttributionRule }
  | { outcome: "new"; root: string }
  | { outcome: "refused"; reason: "transient" | "tombstoned" | "container" | "tool" }
  | { outcome: "ambiguous"; rule: AttributionRule; projects: string[] }
  | { fault: "input-invalid" };

interface ProjectFolder {
  path: string;
  commonDir: string | undefined;
  /** Its raw origin; `repositoryOf` normalizes it once, when a row first reads it. */
  origin: unknown;
  repository?: string | null;
  /** Its place in its repository: the path below the folder's Git top level, `""` at the top or when not given. */
  rel: string;
}
interface Project {
  id: string;
  folders: ProjectFolder[];
  sources: string[];
}

/** The snapshot's Projects, or undefined when any is malformed (a fault, never a guess). */
function projectsOf(value: unknown): Project[] | undefined {
  const raw = list(value);
  if (!raw) return undefined;
  const projects: Project[] = [];
  for (const entry of raw) {
    const id = own(entry, "id");
    const folders = list(own(entry, "folders"));
    const sources = own(entry, "sources") === undefined ? [] : list(own(entry, "sources"));
    if (!idOk(id) || !folders || !sources || !sources.every((source) => isString(source) && source.length > 0 && within(source, MAX_PATH))) return undefined;
    const parsed: ProjectFolder[] = [];
    for (const folder of folders) {
      const path = own(folder, "path");
      const commonDir = own(folder, "commonDir");
      const origin = own(folder, "origin");
      const toplevel = own(folder, "toplevel");
      if (!isPath(path) || (commonDir !== undefined && commonDir !== null && !isPath(commonDir)) || !originOk(origin)) return undefined;
      if (toplevel !== undefined && toplevel !== null && !(isPath(toplevel) && under(path, toplevel))) return undefined;
      parsed.push({ path, commonDir: isString(commonDir) ? commonDir : undefined, origin, rel: isString(toplevel) ? relativeTo(path, toplevel) : "" });
    }
    projects.push({ id, folders: parsed, sources: sources.map((source) => trimSlashes(asciiLower(source as string), false)) });
  }
  return new Set(projects.map((project) => project.id)).size === projects.length ? projects : undefined;
}

/** A Project folder's repository identity, normalized on first read. */
function repositoryOf(entry: ProjectFolder): string | undefined {
  if (entry.repository === undefined) entry.repository = normalizeOrigin(entry.origin) ?? null;
  return entry.repository ?? undefined;
}
/** The distinct ids of `projects`, in the snapshot's order. */
const ids = (projects: Project[]) => [...new Set(projects.map((project) => project.id))];
/**
 * The Projects whose folder in this repository holds the folder's place in it, nearest first: of the folders `matches`
 * picks, those whose `rel` holds `rel`, and of them the longest (so a worktree or clone of the outer of two nested
 * Projects joins the outer one, and a folder inside the inner one the inner one).
 */
function nearestIn(projects: Project[], matches: (entry: ProjectFolder) => boolean, rel: string): { owners: Project[]; place: string } {
  let nearest = -1;
  let place = "";
  let owners: Project[] = [];
  for (const project of projects) {
    for (const entry of project.folders) {
      if (!matches(entry) || !relUnder(rel, entry.rel)) continue;
      if (entry.rel.length > nearest) [nearest, place, owners] = [entry.rel.length, entry.rel, [project]];
      else if (entry.rel.length === nearest) owners.push(project);
    }
  }
  return { owners, place };
}
/** One project attached by `rule`, or ambiguous when more than one matches; undefined when none does. */
function decide(matches: Project[], rule: AttributionRule): Extract<Attribution, { outcome: string }> | undefined {
  const [first, ...others] = ids(matches);
  if (first === undefined) return undefined;
  return others.length === 0 ? { outcome: "attached", project: first, rule } : { outcome: "ambiguous", rule, projects: [first, ...others] };
}

/**
 * The Project of one folder (DEC-0089 item 1), in the order of folder-attribution.md's AT table. `snapshot` is
 * `{folder, home, tempRoots, git, projects, work?, tombstones?, containers?, explicit?}`:
 *
 * - AT-0: a snapshot that is not of the schema's shape, or `explicit` naming no Project: `{fault: "input-invalid"}`;
 * - AT-1: `explicit` names a Project: attached to it (`explicit`), whatever else holds;
 * - AT-2: the folder is at or under a tombstone, and no Project lists a folder below it that holds the folder: refused
 *   `tombstoned`;
 * - AT-3: a Project folder holds the folder (`folder`): one of the folder's own repository decides by place (by common
 *   dir, then by identity), else the nearest listed folder by path; a broad folder (a root, home, an ancestor of
 *   home, a declared container) is never so listed;
 * - AT-4: the folder or its root is at or under a temporary root: refused `transient`;
 * - AT-5: the folder or its root is broad, or right under home and listed by no Project (a root only when no Project
 *   folder is in its repository): refused `container`;
 * - AT-6: a Project's folder has the same Git common dir, or is the main checkout (`worktree`), nearest by place;
 * - AT-7: the same repository identity (`repository`), nearest by place;
 * - AT-8: the root (the main checkout) lies in a folder a Project lists, AT-3's search (`worktree`);
 * - AT-9: the repository has Project folders, but none at a place that holds the folder's: refused `container`;
 * - AT-10: the repository's owner is a source of a Project (`owner`);
 * - AT-11: the folder or its root is in a tool's folder: refused `tool`;
 * - AT-12: a work record names the repository (its common dir or its identity) for a Project (`work`);
 * - AT-13: the root is at or under a tombstone: refused `tombstoned`;
 * - AT-14: the root holds another Project's folder: refused `container` (no Project is made around another);
 * - AT-15: otherwise a new Project at the root.
 *
 * Two Projects matching at one row answer `ambiguous` with both, and nothing is attached. It never throws.
 */
export function attributeFolder(snapshot: unknown): Attribution {
  return explainFolder(snapshot).answer;
}

/** `attributeFolder`'s answer with the AT row that decided it and the folder a product records after it. */
export function explainFolder(snapshot: unknown): AttributionExplained {
  const at = (row: number, answer: Attribution, record: AttributionRecord | null = null): AttributionExplained => ({ answer, row, record });
  const fault = at(0, { fault: "input-invalid" });
  const folder = own(snapshot, "folder");
  const home = own(snapshot, "home");
  const tempRoots = list(own(snapshot, "tempRoots"));
  const git = own(snapshot, "git");
  const projects = projectsOf(own(snapshot, "projects"));
  const work = own(snapshot, "work") === undefined ? [] : list(own(snapshot, "work"));
  const tombstones = own(snapshot, "tombstones") === undefined ? [] : list(own(snapshot, "tombstones"));
  const explicit = own(snapshot, "explicit");
  const containers = own(snapshot, "containers") === undefined ? [] : list(own(snapshot, "containers"));
  if (!isPath(folder) || !isPath(home) || !tempRoots || !tempRoots.every(isPath) || !projects || !work || !tombstones || !tombstones.every(isPath) || !containers || !containers.every(isPath)) return fault;
  if (git !== null && !isObject(git)) return fault;
  const toplevel = own(git, "toplevel");
  const commonDir = own(git, "commonDir");
  const mainCheckout = own(git, "mainCheckout");
  const origin = own(git, "origin");
  if (git !== null && (!isPath(toplevel) || !isPath(commonDir) || !isPath(mainCheckout) || !under(folder, toplevel) || !originOk(origin))) return fault;
  const records: Array<{ project: string; commonDir: string; origin: unknown }> = [];
  for (const record of work) {
    const project = own(record, "project");
    const repo = own(record, "commonDir");
    const recordOrigin = own(record, "origin");
    if (!idOk(project) || !isPath(repo) || !originOk(recordOrigin)) return fault;
    records.push({ project, commonDir: repo, origin: recordOrigin });
  }
  const declared = new Set(containers as string[]);
  /** Never a Project and never listed: a root, home, an ancestor of home, a container a person declared. */
  const broad = (path: string) => isRoot(path) || under(home, path) || declared.has(path);
  /** The deepest declared container at or above `path`, where a listed folder's reach ends. */
  const cutOf = (path: string): string | undefined => {
    let cut: string | undefined;
    for (const container of declared) if (under(path, container) && (cut === undefined || container.length > cut.length)) cut = container;
    return cut;
  };
  /**
   * Whether a listed folder at `entry` reaches `path` (DEC-0089 item 3): it holds it, and no declared container lies
   * strictly below it on the way, so a container inside a Project's folder keeps what it holds to their own rows. The
   * containers holding `path` are a chain of its ancestors, so the deepest one, `cut`, decides.
   */
  const reaches = (path: string, cut: string | undefined, entry: string) => under(path, entry) && !(cut !== undefined && cut !== entry && under(cut, entry));
  const keptOrigin = recordOrigin(isString(origin) ? origin : null);
  /** The record of a folder of this repository at `path`, its top level `top` (null: none). */
  const gitRecord = (path: string, top: string | null): AttributionRecord | null => (broad(path) ? null : { path, commonDir: commonDir as string, origin: keptOrigin, toplevel: top });
  if (explicit !== undefined) {
    const target = idOk(explicit) ? projects.find((project) => project.id === explicit) : undefined;
    if (!target) return fault;
    const record = broad(folder) ? null : git === null ? { path: folder, commonDir: null, origin: null, toplevel: null } : gitRecord(folder, toplevel as string);
    return at(1, { outcome: "attached", project: target.id, rule: "explicit" }, record);
  }

  const root = git === null ? folder : (mainCheckout as string);
  const listed = (path: string) => projects.some((project) => project.folders.some((entry) => entry.path === path));
  /** A folder right under home that no Project lists (a root is broad, so it is never asked). */
  const looseUnderHome = (path: string) => parentOf(path) === home && !listed(path);
  /** The Projects whose listed folder is `path` or its nearest ancestor that reaches it (AT-3's search), broad folders skipped. */
  const byPath = (path: string): Project[] => {
    const cut = cutOf(path);
    let nearest = -1;
    let owners: Project[] = [];
    for (const project of projects) {
      for (const entry of project.folders) {
        if (!reaches(path, cut, entry.path) || broad(entry.path)) continue;
        if (entry.path.length > nearest) [nearest, owners] = [entry.path.length, [project]];
        else if (entry.path.length === nearest) owners.push(project);
      }
    }
    return owners;
  };
  const repository = git === null ? undefined : normalizeOrigin(origin);
  const place = git === null ? "" : relativeTo(folder, toplevel as string);
  const sameCommon = (entry: ProjectFolder) => git !== null && !broad(entry.path) && (entry.commonDir === commonDir || entry.path === mainCheckout);
  const sameIdentity = (entry: ProjectFolder) => repository !== undefined && !broad(entry.path) && repositoryOf(entry) === repository;
  const sameRepository = (entry: ProjectFolder) => sameCommon(entry) || sameIdentity(entry);
  const anyFolder = (test: (entry: ProjectFolder) => boolean) => projects.some((project) => project.folders.some(test));
  // AT-2: a tombstone keeps out its folder, unless a Project lists a folder below the tombstone that holds this one. The
  // listed folders that hold the folder are a chain of its ancestors, so one is below a tombstone exactly when the deepest
  // is: one pass over the folders, then one over the tombstones.
  let deepest: string | undefined;
  const folderCut = cutOf(folder);
  for (const project of projects) for (const entry of project.folders) if (!broad(entry.path) && reaches(folder, folderCut, entry.path) && (deepest === undefined || entry.path.length > deepest.length)) deepest = entry.path;
  const stoned = tombstones.some((stone) => under(folder, stone as string) && !(deepest !== undefined && deepest !== stone && under(deepest, stone as string)));
  if (stoned) return at(2, { outcome: "refused", reason: "tombstoned" });
  // AT-3: a Project folder holds the folder; when one of the folder's own repository does, the nearest place among that
  // repository's folders decides, by common dir or by identity, the same common dir at equal depth (so recording the
  // outer Project's clone never takes a nested Project's place).
  if (anyFolder((entry) => sameRepository(entry) && reaches(folder, folderCut, entry.path))) {
    const common = nearestIn(projects, sameCommon, place);
    const identity = nearestIn(projects, sameIdentity, place);
    const nearer = common.owners.length === 0 || identity.place.length > common.place.length ? identity : common;
    const byPlace = decide(nearer.owners, "folder");
    if (byPlace) return at(3, byPlace);
  }
  const byFolder = decide(byPath(folder), "folder");
  if (byFolder) return at(3, byFolder);
  if (tempRoots.some((temp) => under(folder, temp as string) || under(root, temp as string))) return at(4, { outcome: "refused", reason: "transient" });
  // AT-5: a checkout right under home is a container whatever folder of it the agent starts in: its own top level when
  // it is a worktree, its main checkout unless a Project folder of the repository lies in it (or, for a worktree, a
  // Project folder of the repository anywhere).
  const checkoutTop = git === null ? undefined : (toplevel as string);
  const looseRoot = looseUnderHome(root) && !anyFolder((entry) => sameRepository(entry) && (checkoutTop !== root || under(entry.path, root)));
  if (broad(folder) || broad(root) || looseUnderHome(folder) || (checkoutTop !== undefined && checkoutTop !== root && (looseUnderHome(checkoutTop) || declared.has(checkoutTop))) || looseRoot) return at(5, { outcome: "refused", reason: "container" });
  if (git !== null) {
    const top = toplevel as string;
    const atPlace = (found: { owners: Project[]; place: string }, row: number, rule: AttributionRule) => {
      const answer = decide(found.owners, rule);
      return answer && at(row, answer, answer.outcome === "attached" ? gitRecord(found.place === "" ? top : `${isRoot(top) ? top : `${top}/`}${found.place}`, top) : null);
    };
    // AT-6 and AT-7 weigh the same places AT-3 does: the nearest across common dir and identity, the same common dir
    // at equal depth, so an answer and the answer after its record is applied name one Project.
    const common = nearestIn(projects, sameCommon, place);
    const identity = nearestIn(projects, sameIdentity, place);
    const identityNearer = common.owners.length === 0 || identity.place.length > common.place.length;
    const byPlace = identityNearer ? atPlace(identity, 7, "repository") : atPlace(common, 6, "worktree");
    if (byPlace) return byPlace;
    const whole = (row: number, answer: ReturnType<typeof decide>) => answer && at(row, answer, answer.outcome === "attached" ? gitRecord(top, top) : null);
    // AT-8: a worktree goes where its main checkout goes by AT-3.
    const byCheckout = whole(8, decide(byPath(root), "worktree"));
    if (byCheckout) return byCheckout;
    // AT-9: the repository has Projects, but only at places deeper than the folder's: it holds them.
    if (anyFolder(sameRepository)) return at(9, { outcome: "refused", reason: "container" });
    if (repository !== undefined) {
      const byOwner = whole(10, decide(projects.filter((project) => project.sources.includes(ownerOf(repository))), "owner"));
      if (byOwner) return byOwner;
    }
    if (inToolFolder(folder, home) || inToolFolder(root, home)) return at(11, { outcome: "refused", reason: "tool" });
    const workers = new Set(records.filter((record) => record.commonDir === commonDir || (repository !== undefined && normalizeOrigin(record.origin) === repository)).map((record) => record.project));
    const byWork = whole(12, decide(projects.filter((project) => workers.has(project.id)), "work"));
    if (byWork) return byWork;
  } else if (inToolFolder(folder, home)) {
    return at(11, { outcome: "refused", reason: "tool" });
  }
  if (tombstones.some((stone) => under(root, stone as string))) return at(13, { outcome: "refused", reason: "tombstoned" });
  if (anyFolder((entry) => under(entry.path, root))) return at(14, { outcome: "refused", reason: "container" });
  const record = git === null ? { path: root, commonDir: null, origin: null, toplevel: null } : gitRecord(root, root === commonDir ? null : root);
  return at(15, { outcome: "new", root }, record);
}

// ---- Rules -------------------------------------------------------------------------------------------------------

/**
 * FAC-SEM-121 (kind `folder-attribution`, `{snapshot, answer}`): an implementation's attribution equals
 * `attributeFolder`'s, row for row of the AT table.
 */
export function folderAttributionRules(kind: string, value: JsonObject): Finding[] | undefined {
  if (kind !== "folder-attribution") return undefined;
  const expected = attributeFolder(value.snapshot);
  if (jsonEqual(value.answer, expected)) return [];
  return [{ code: "FAC-SEM-121", instancePath: "/answer", message: `the attribution answers ${JSON.stringify(expected)} as attributeFolder does` }];
}
// #endregion folder-attribution
