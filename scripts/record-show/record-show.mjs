#!/usr/bin/env node
// record-show: record the screen (cursor visible) and the microphone in chunks while
// the owner shows and talks, and turn each chunk into context an agent reads:
// the speech with times, key frames, the cursor and clicks. One folder per session,
// outside Git, removed after a week. Usage: scripts/record-show/README.md.
//
// #region record-show-cli — docs: scripts/record-show/README.md#commands
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseDevices,
  parseSegmentsCsv,
  normalizeSegments,
  parseSceneTimes,
  parseWhisperJson,
  findCues,
  cursorAt,
  clicksBetween,
  pickKeyframes,
  toDisplayPoint,
  renderContext,
  sessionsToClean,
  responsibleApp,
  permissionError,
  permissionSettingsUrl,
  parseVolume,
  formatClock,
} from "./lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = fileURLToPath(import.meta.url);
const ROOT =
  process.env.RECORD_SHOW_DIR ?? path.join(os.homedir(), "Library/Application Support/ai.passioncode.fabric/show-recordings");
const CURRENT = path.join(ROOT, "current.json");
const KEEP_DAYS = Number(process.env.RECORD_SHOW_KEEP_DAYS ?? 7);
const SEGMENT_SECONDS = Number(process.env.RECORD_SHOW_SEGMENT_SECONDS ?? 45);
const FFMPEG = process.env.RECORD_SHOW_FFMPEG ?? firstExisting(["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg"]) ?? "ffmpeg";
const FFPROBE = FFMPEG.replace(/ffmpeg$/, "ffprobe");
const MARKER = ".record-show";

function firstExisting(paths) {
  return paths.find((p) => p && fs.existsSync(p)) ?? null;
}

const args = process.argv.slice(2);
const command = args[0] ?? "help";
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const json = flag("json");

class Refusal extends Error {
  constructor(message, code = 2) {
    super(message);
    this.code = code;
  }
}

// ---------- small process helpers ----------

const alive = (pid) => {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = (file, fallback = null) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
};
const writeJson = (file, value) => {
  fs.writeFileSync(`${file}.tmp`, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(`${file}.tmp`, file);
};
const run = (cmd, argv, opts = {}) => spawnSync(cmd, argv, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...opts });
const sound = (name) => spawn("afplay", [`/System/Library/Sounds/${name}.aiff`], { stdio: "ignore", detached: true }).unref();
const say = (msg) => !json && process.stdout.write(`${msg}\n`);

function processChain() {
  const chain = [];
  let pid = process.pid;
  for (let i = 0; i < 40 && pid > 1; i++) {
    const r = run("ps", ["-o", "ppid=,comm=", "-p", String(pid)]);
    const m = r.stdout.trim().match(/^(\d+)\s+(.+)$/);
    if (!m) break;
    chain.push(m[2]);
    pid = Number(m[1]);
  }
  return chain;
}

// ---------- the macOS helper (permissions, cursor, menu bar) ----------

function helperPath() {
  const source = path.join(HERE, "helper.swift");
  const hash = createHash("sha256").update(fs.readFileSync(source)).digest("hex").slice(0, 10);
  const dir = path.join(os.homedir(), "Library/Caches/fabric-record-show");
  const bin = path.join(dir, `helper-${hash}`);
  if (fs.existsSync(bin)) return bin;
  fs.mkdirSync(dir, { recursive: true });
  const r = run("swiftc", ["-O", source, "-o", bin]);
  if (r.status !== 0) {
    throw new Refusal(
      `Не удалось собрать помощника macOS (swiftc): ${r.stderr.trim().split("\n").slice(-3).join(" ")}\nУстановите Xcode Command Line Tools: xcode-select --install`,
    );
  }
  return bin;
}

function helper(...argv) {
  const r = run(helperPath(), argv, { timeout: 130_000 });
  if (r.status !== 0) throw new Refusal(`Помощник macOS не ответил: ${r.stderr.trim()}`);
  return JSON.parse(r.stdout);
}

/** Permissions first: a recording macOS would leave empty never starts. */
function requirePermissions({ audio }) {
  let state = helper("check");
  const needsAsk = state.screen !== "granted" || (audio && state.microphone === "not-determined");
  if (needsAsk && !flag("no-prompt")) state = { ...state, ...helper("request") };
  const app = responsibleApp(processChain());
  if (state.screen !== "granted") {
    if (!flag("no-prompt")) spawn("open", [permissionSettingsUrl("screen")], { stdio: "ignore", detached: true }).unref();
    throw new Refusal(permissionError("screen", app), 3);
  }
  if (audio && state.microphone !== "granted") {
    if (!flag("no-prompt")) spawn("open", [permissionSettingsUrl("microphone")], { stdio: "ignore", detached: true }).unref();
    throw new Refusal(permissionError("microphone", app), 4);
  }
  return helper("check");
}

// ---------- transcription ----------

/**
 * whisper.cpp is often already installed by another local tool under ~/.local/share/<tool>/whisper/<version>/
 * with its models under ~/.cache/<tool>/whisper/models/ or ~/.local/share/<tool>/whisper/kept/: look there,
 * one level deep, newest version first; env overrides win.
 */
function whisperCpp() {
  const share = path.join(os.homedir(), ".local/share");
  const cache = path.join(os.homedir(), ".cache");
  const cli =
    process.env.RECORD_SHOW_WHISPER_CLI ??
    firstExisting([
      "/opt/homebrew/bin/whisper-cli",
      ...listDirs(share)
        .flatMap((tool) => listDirs(path.join(tool, "whisper")))
        .sort()
        .reverse()
        .map((d) => path.join(d, "whisper-cli")),
    ]);
  const model =
    process.env.RECORD_SHOW_WHISPER_MODEL ??
    firstExisting([
      ...listDirs(cache).map((tool) => path.join(tool, "whisper/models/ggml-small.bin")),
      ...listDirs(share).map((tool) => path.join(tool, "whisper/kept/ggml-small.bin")),
    ]);
  return cli && model ? { cli, model } : null;
}

function listDirs(dir) {
  try {
    return fs.readdirSync(dir).map((d) => path.join(dir, d));
  } catch {
    return [];
  }
}

/** Speech of one wav file: whisper.cpp when present, else the openai-whisper CLI. */
function transcribe(wav, workDir) {
  const lang = process.env.RECORD_SHOW_LANGUAGE ?? "auto";
  const cpp = whisperCpp();
  if (cpp) {
    const base = path.join(workDir, "speech");
    const r = run(cpp.cli, ["-m", cpp.model, "-l", lang, "-ml", "80", "-sow", "-oj", "-of", base, "-np", wav], { timeout: 600_000 });
    if (r.status === 0 && fs.existsSync(`${base}.json`)) return parseWhisperJson(readJson(`${base}.json`));
    return { language: null, lines: [], error: `whisper.cpp: ${r.stderr.trim().split("\n").slice(-2).join(" ")}` };
  }
  const py = firstExisting(["/opt/homebrew/bin/whisper", "/usr/local/bin/whisper"]);
  if (!py) return { language: null, lines: [], error: "не найден ни whisper-cli, ни whisper: речь не распознана" };
  const argv = [wav, "--model", process.env.RECORD_SHOW_WHISPER_PY_MODEL ?? "small", "--output_format", "json", "--output_dir", workDir, "--fp16", "False"];
  if (lang !== "auto") argv.push("--language", lang);
  const r = run(py, argv, { timeout: 1_800_000 });
  const out = readJson(path.join(workDir, `${path.basename(wav, ".wav")}.json`));
  if (r.status !== 0 || !out) return { language: null, lines: [], error: `whisper: ${r.stderr.trim().split("\n").slice(-2).join(" ")}` };
  return {
    language: out.language ?? null,
    lines: out.segments.map((s) => ({ start: s.start, end: s.end, text: s.text.trim() })).filter((l) => l.text),
  };
}

// ---------- one chunk into context ----------

function readMouse(dir) {
  const file = path.join(dir, "mouse.jsonl");
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function processChunk(dir, session, seg, index) {
  const video = path.join(dir, seg.file);
  const work = path.join(dir, "work", `c${String(index).padStart(3, "0")}`);
  fs.mkdirSync(work, { recursive: true });
  fs.mkdirSync(path.join(dir, "frames"), { recursive: true });
  const duration = seg.end - seg.start;
  const warnings = [];
  const epoch = (t) => session.t0 + (seg.start + t) * 1000;

  // Speech
  const wav = path.join(work, "audio.wav");
  let speech = { language: null, lines: [] };
  if (session.audio) {
    const a = run(FFMPEG, ["-y", "-loglevel", "error", "-i", video, "-vn", "-ac", "1", "-ar", "16000", wav]);
    if (a.status === 0) {
      const vol = parseVolume(run(FFMPEG, ["-hide_banner", "-i", wav, "-af", "volumedetect", "-f", "null", "-"]).stderr);
      if (vol && vol.max < -45) warnings.push("звук почти не слышен: проверьте, какой микрофон выбран и не выключен ли он");
      speech = transcribe(wav, work);
      if (speech.error) warnings.push(speech.error);
    } else warnings.push("в куске нет звуковой дорожки");
  }

  // Scene changes
  const scenes = parseSceneTimes(
    run(FFMPEG, ["-hide_banner", "-i", video, "-an", "-vf", "select='gt(scene,0.12)',showinfo", "-f", "null", "-"]).stderr,
  );

  const mouse = readMouse(dir);
  const display = session.display;
  const point = (t) => toDisplayPoint(cursorAt(mouse, epoch(t)), display);
  const clicks = clicksBetween(mouse, epoch(0), epoch(duration)).map((c) => ({
    t: (c.t - session.t0) / 1000 - seg.start,
    button: c.button,
    cursor: toDisplayPoint(c, display),
  }));
  const cues = findCues(speech.lines);

  // Key frames, the cursor ringed in red
  const frames = [];
  for (const k of pickKeyframes({ duration, scenes, cues, clicks })) {
    const at = seg.start + k.t;
    const name = `frames/c${String(index).padStart(3, "0")}-${formatClock(at).replace(":", "m")}s-${k.t.toFixed(1)}.jpg`;
    const cursor = point(k.t);
    const ring = cursor
      ? `,drawbox=x=${Math.round(cursor.nx * 1280) - 24}:y=ih*${cursor.ny}-24:w=48:h=48:color=red@0.9:t=4`
      : "";
    const r = run(FFMPEG, ["-y", "-loglevel", "error", "-ss", String(k.t), "-i", video, "-frames:v", "1", "-vf", `scale=1280:-2${ring}`, "-q:v", "4", path.join(dir, name)]);
    if (r.status === 0) frames.push({ at, file: name, why: k.why, cursor });
  }
  const yavg = run(FFMPEG, ["-hide_banner", "-ss", String(Math.min(1, duration / 2)), "-i", video, "-frames:v", "1", "-vf", "signalstats,metadata=print:key=lavfi.signalstats.YAVG", "-f", "null", "-"]).stderr.match(/YAVG=([\d.]+)/);
  if (yavg && Number(yavg[1]) < 3) warnings.push("кадр почти чёрный: возможно, macOS не даёт записывать экран");

  return {
    kind: "chunk",
    index,
    file: seg.file,
    start: seg.start,
    end: seg.end,
    language: speech.language,
    warnings,
    lines: speech.lines.map((l) => ({ start: seg.start + l.start, end: seg.start + l.end, text: l.text, cursor: point(l.start) })),
    clicks: clicks.map((c) => ({ at: seg.start + c.t, button: c.button, cursor: c.cursor })),
    frames,
    readyAt: new Date().toISOString(),
  };
}

function probeDuration(file) {
  return Number(run(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).stdout) || 0;
}

/** Shots are appended by `shot` while the worker may be writing: they live in their own log. */
function readShots(dir) {
  const file = path.join(dir, "shots.jsonl");
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

function saveManifest(dir, manifest) {
  manifest.updatedAt = new Date().toISOString();
  manifest.items = [...manifest.items.filter((i) => i.kind !== "shot"), ...readShots(dir)];
  // Shots gain the words said around them once the chunk holding them is transcribed.
  const lines = manifest.items.filter((i) => i.kind === "chunk").flatMap((c) => c.lines);
  for (const s of manifest.items.filter((i) => i.kind === "shot"))
    s.near = lines.filter((l) => l.end >= s.at - 8 && l.start <= s.at + 8).map((l) => l.text);
  writeJson(path.join(dir, "manifest.json"), manifest);
  fs.writeFileSync(path.join(dir, "context.md"), renderContext(manifest));
  // One file per chunk, for whoever attaches chunks as they get ready.
  fs.mkdirSync(path.join(dir, "chunks"), { recursive: true });
  for (const c of manifest.items.filter((i) => i.kind === "chunk")) {
    const own = { ...manifest, items: [c, ...manifest.items.filter((s) => s.kind === "shot" && s.at >= c.start && s.at < c.end)] };
    fs.writeFileSync(path.join(dir, "chunks", `${String(c.index).padStart(3, "0")}.md`), renderContext(own));
  }
}

// ---------- the worker: turns finished segments into context while recording goes on ----------

async function worker(dir) {
  const session = readJson(path.join(dir, "session.json"));
  const manifestFile = path.join(dir, "manifest.json");
  const manifest = readJson(manifestFile) ?? {
    schema: "record-show/1",
    startedAt: session.startedAt,
    status: "recording",
    display: session.display,
    items: [],
  };
  const done = () => new Set(manifest.items.filter((i) => i.kind === "chunk").map((c) => c.file));
  for (;;) {
    const stopped = fs.existsSync(path.join(dir, "stopped.json"));
    const listed = parseSegmentsCsv(fs.existsSync(path.join(dir, "segments.csv")) ? fs.readFileSync(path.join(dir, "segments.csv"), "utf8") : "");
    const { base, segments: segs } = normalizeSegments(listed, (f) => probeDuration(path.join(dir, f)));
    if (base && session.t0Source !== "wallclock") {
      // The first frame's own time replaces the moment the file appeared.
      session.t0 = Math.round(base * 1000);
      session.t0Source = "wallclock";
      writeJson(path.join(dir, "session.json"), session);
    }
    // A segment ffmpeg could not close (it was killed, the Mac restarted) is read by its own length.
    if (stopped && !alive(session.ffmpegPid)) {
      const listed = new Set(segs.map((s) => s.file));
      let at = segs.at(-1)?.end ?? 0;
      for (const f of fs.readdirSync(dir).filter((f) => /^seg-\d+\.mp4$/.test(f) && !listed.has(f)).sort()) {
        const d = probeDuration(path.join(dir, f));
        if (d > 0.5) segs.push({ file: f, start: at, end: at + d });
        if (d > 0) at += d;
      }
    }
    const shotCount = readShots(dir).length;
    if (shotCount !== manifest.items.filter((i) => i.kind === "shot").length) saveManifest(dir, manifest);
    for (const seg of segs) {
      if (done().has(seg.file)) continue;
      const index = Number(seg.file.match(/\d+/)[0]);
      manifest.items.push(processChunk(dir, session, seg, index));
      saveManifest(dir, manifest);
    }
    if (stopped && !alive(session.ffmpegPid)) {
      manifest.status = "done";
      manifest.endedAt = readJson(path.join(dir, "stopped.json"))?.at;
      saveManifest(dir, manifest);
      return;
    }
    await sleep(1000);
  }
}

// ---------- commands ----------

function current() {
  const c = readJson(CURRENT);
  if (!c) return null;
  if (!alive(c.ffmpegPid)) return { ...c, stale: true };
  return c;
}

function cleanOld() {
  if (!fs.existsSync(ROOT)) return [];
  const live = readJson(CURRENT)?.name;
  const sessions = fs
    .readdirSync(ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const p = path.join(ROOT, d.name);
      return { name: d.name, marked: fs.existsSync(path.join(p, MARKER)), mtime: fs.statSync(p).mtimeMs };
    });
  const removed = sessionsToClean(sessions, { now: Date.now(), keepDays: KEEP_DAYS, current: live });
  for (const name of removed) fs.rmSync(path.join(ROOT, name), { recursive: true, force: true });
  return removed;
}

function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

async function start() {
  const c = current();
  if (c && !c.stale) throw new Refusal(`Запись уже идёт: ${c.dir}. Остановить: record-show stop`, 5);
  if (c?.stale) fs.rmSync(CURRENT, { force: true });
  const audio = !flag("no-audio");
  const perms = requirePermissions({ audio });
  fs.mkdirSync(ROOT, { recursive: true });
  cleanOld();

  const list = run(FFMPEG, ["-hide_banner", "-f", "avfoundation", "-list_devices", "true", "-i", ""]);
  if (list.error) throw new Refusal(`Не найден ffmpeg (${FFMPEG}): brew install ffmpeg`);
  const devices = parseDevices(list.stderr);
  const main = perms.displays.find((d) => d.main) ?? perms.displays[0];
  const screenIndex = Number(option("screen", String(main?.index ?? 0)));
  const screen = devices.screens.find((s) => s.screen === screenIndex);
  if (!screen) throw new Refusal(`ffmpeg не видит экран ${screenIndex}. Видит: ${devices.screens.map((s) => s.screen).join(", ") || "ни одного"}`);
  const micName = option("mic", process.env.RECORD_SHOW_MIC ?? "");
  const mic = audio
    ? (micName
        ? devices.audio.find((a) => a.name.toLowerCase().includes(micName.toLowerCase()))
        : devices.audio.find((a) => /microphone|микрофон/i.test(a.name)) ?? devices.audio[0])
    : null;
  if (audio && !mic) throw new Refusal(`Микрофон не найден${micName ? ` по имени «${micName}»` : ""}. Есть: ${devices.audio.map((a) => a.name).join(", ") || "ничего"}`);

  const name = `${stamp()}${option("name", "") ? `_${option("name").replace(/[^\p{L}\p{N}_-]+/gu, "-")}` : ""}`;
  const dir = path.join(ROOT, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, MARKER), "record-show session; removed automatically after KEEP_DAYS\n");
  const log = fs.openSync(path.join(dir, "ffmpeg.log"), "a");
  const fps = option("fps", "10");
  const ff = spawn(
    FFMPEG,
    [
      "-hide_banner", "-nostdin", "-loglevel", "warning",
      // Wall-clock timestamps: the segment list then says when each chunk began, on the cursor log's clock.
      "-use_wallclock_as_timestamps", "1",
      "-f", "avfoundation", "-capture_cursor", "1", "-capture_mouse_clicks", "1", "-framerate", fps,
      "-i", `${screen.device}:${mic ? mic.device : "none"}`,
      "-copyts", "-vf", `fps=${fps},scale='min(1920,iw)':-2`, "-c:v", "h264_videotoolbox", "-b:v", "2500k", "-g", String(Number(fps) * 2),
      ...(mic ? ["-c:a", "aac", "-b:a", "96k", "-ac", "1"] : []),
      "-f", "segment", "-segment_time", String(SEGMENT_SECONDS), "-reset_timestamps", "1",
      "-segment_format", "mp4", "-segment_format_options", "movflags=+frag_keyframe+empty_moov+default_base_moof",
      "-segment_list", "segments.csv", "-segment_list_type", "csv",
      "seg-%03d.mp4",
    ],
    { cwd: dir, detached: true, stdio: ["ignore", log, log] },
  );
  ff.unref();
  const mouse = spawn(helperPath(), ["mouse", path.join(dir, "mouse.jsonl")], { detached: true, stdio: "ignore" });
  mouse.unref();

  // The recording counts from the moment the first segment exists: ffmpeg opens it on its first packet.
  const first = path.join(dir, "seg-000.mp4");
  const deadline = Date.now() + 12_000;
  while (!fs.existsSync(first) && Date.now() < deadline && alive(ff.pid)) await sleep(50);
  if (!fs.existsSync(first)) {
    try { process.kill(ff.pid, "SIGKILL"); } catch {}
    try { process.kill(mouse.pid, "SIGTERM"); } catch {}
    const tail = fs.readFileSync(path.join(dir, "ffmpeg.log"), "utf8").trim().split("\n").slice(-4).join("\n");
    throw new Refusal(`ffmpeg не начал запись за 12 секунд. Журнал ffmpeg:\n${tail}`, 6);
  }
  const display = perms.displays.find((d) => d.index === screenIndex);
  const session = {
    schema: "record-show-session/1",
    name,
    startedAt: new Date().toISOString(),
    t0: Date.now(),
    audio: Boolean(mic),
    mic: mic?.name ?? null,
    screen: screenIndex,
    display: display && { x: display.x, y: display.y, width: display.width, height: display.height },
    segmentSeconds: SEGMENT_SECONDS,
    ffmpegPid: ff.pid,
    mousePid: mouse.pid,
    cwd: process.cwd(),
  };
  writeJson(path.join(dir, "session.json"), session);
  const w = spawn(process.execPath, [SCRIPT, "worker", dir], { detached: true, stdio: ["ignore", fs.openSync(path.join(dir, "worker.log"), "a"), fs.openSync(path.join(dir, "worker.log"), "a")] });
  w.unref();
  writeJson(CURRENT, { name, dir, ffmpegPid: ff.pid, mousePid: mouse.pid, workerPid: w.pid, startedAt: session.startedAt });
  if (!flag("quiet")) sound("Tink");
  if (json) console.log(JSON.stringify({ recording: true, dir, mic: session.audio ? mic.name : null }));
  else say(`Запись идёт: экран ${screenIndex}${mic ? `, микрофон «${mic.name}»` : ", без звука"}.\nПапка: ${dir}\nОстановить: node ${path.relative(process.cwd(), SCRIPT)} stop`);
}

async function stop() {
  const c = readJson(CURRENT);
  if (!c) throw new Refusal("Запись не идёт.", 7);
  writeJson(path.join(c.dir, "stopped.json"), { at: new Date().toISOString() });
  if (alive(c.ffmpegPid)) process.kill(c.ffmpegPid, "SIGINT");
  const until = Date.now() + 15_000;
  while (alive(c.ffmpegPid) && Date.now() < until) await sleep(100);
  if (alive(c.ffmpegPid)) process.kill(c.ffmpegPid, "SIGKILL");
  if (alive(c.mousePid)) process.kill(c.mousePid, "SIGTERM");
  fs.rmSync(CURRENT, { force: true });
  if (!flag("quiet")) sound("Pop");
  if (!alive(c.workerPid)) spawn(process.execPath, [SCRIPT, "worker", c.dir], { detached: true, stdio: "ignore" }).unref();
  const context = path.join(c.dir, "context.md");
  if (!flag("no-wait")) {
    say("Запись остановлена, дописываю последний кусок…");
    const wait = Date.now() + 10 * 60_000;
    while (readJson(path.join(c.dir, "manifest.json"))?.status !== "done" && Date.now() < wait) await sleep(500);
    if (!flag("no-copy") && fs.existsSync(context)) spawnSync("pbcopy", { input: context });
    if (!flag("quiet")) sound("Glass");
  }
  if (json) console.log(JSON.stringify({ recording: false, dir: c.dir, context }));
  else say(`Готово: ${context}${flag("no-copy") || flag("no-wait") ? "" : "\nПуть скопирован: вставьте его в задачу или чат агента."}`);
}

function status() {
  const c = current();
  const recording = Boolean(c && !c.stale);
  const manifest = c ? readJson(path.join(c.dir, "manifest.json")) : null;
  const value = {
    recording,
    dir: c?.dir ?? null,
    startedAt: c?.startedAt ?? null,
    chunksReady: manifest?.items.filter((i) => i.kind === "chunk").length ?? 0,
    root: ROOT,
  };
  if (json) console.log(JSON.stringify(value));
  else say(recording ? `Идёт запись с ${c.startedAt}: ${c.dir} (готово кусков: ${value.chunksReady})` : "Запись не идёт.");
}

/** A still of an area, a window or the whole screen, into the live session or today's shots. */
async function shot() {
  requirePermissions({ audio: false });
  const c = current();
  const live = c && !c.stale ? c : null;
  let dir = live?.dir;
  if (!dir) {
    dir = path.join(ROOT, `${stamp().slice(0, 10)}_shots`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, MARKER), "record-show shots\n");
    if (!fs.existsSync(path.join(dir, "session.json")))
      writeJson(path.join(dir, "session.json"), { schema: "record-show-session/1", name: path.basename(dir), startedAt: new Date().toISOString(), t0: Date.now(), audio: false, shotsOnly: true });
  }
  const session = readJson(path.join(dir, "session.json"));
  const mode = flag("window") ? "window" : flag("screen") ? "screen" : "area";
  const at = (Date.now() - session.t0) / 1000;
  fs.mkdirSync(path.join(dir, "shots"), { recursive: true });
  const file = `shots/shot-${formatClock(at).replace(":", "m")}s-${Date.now() % 100000}.png`;
  const argv = ["-x", ...(mode === "area" ? ["-i", "-s"] : mode === "window" ? ["-i", "-w"] : []), path.join(dir, file)];
  const r = run("screencapture", argv);
  if (r.status !== 0 || !fs.existsSync(path.join(dir, file))) {
    if (json) console.log(JSON.stringify({ shot: null, cancelled: true }));
    else say("Снимок отменён.");
    return;
  }
  fs.appendFileSync(path.join(dir, "shots.jsonl"), `${JSON.stringify({ kind: "shot", at, file, mode, takenAt: new Date().toISOString(), near: [] })}\n`);
  // While recording, the worker folds the shot into context.md within a second; otherwise do it here.
  if (!live || !alive(live.workerPid)) {
    const manifest = readJson(path.join(dir, "manifest.json")) ?? { schema: "record-show/1", startedAt: session.startedAt, status: live ? "recording" : "done", display: session.display, items: [] };
    saveManifest(dir, manifest);
  }
  if (!flag("quiet")) sound("Tink");
  if (json) console.log(JSON.stringify({ shot: path.join(dir, file), dir, context: path.join(dir, "context.md") }));
  else say(`Снимок: ${path.join(dir, file)}\nКонтекст: ${path.join(dir, "context.md")}`);
}

function menubar() {
  const bin = helperPath();
  const running = run("pgrep", ["-f", `${bin} menubar`]).stdout.trim();
  if (running) return say("Значок записи уже в строке меню.");
  spawn(bin, ["menubar", process.execPath, SCRIPT], { detached: true, stdio: "ignore" }).unref();
  say("Значок записи добавлен в строку меню. Запись: ⌃⌥⌘R, снимок области: ⌃⌥⌘S.");
}

function help() {
  say(`record-show: записать показ (экран с курсором и микрофон) кусками для агента.

  node scripts/record-show/record-show.mjs toggle     начать или остановить запись
  node scripts/record-show/record-show.mjs start [--screen N] [--mic имя] [--no-audio] [--name метка]
  node scripts/record-show/record-show.mjs stop [--no-wait]
  node scripts/record-show/record-show.mjs shot [--window | --screen]   снимок области, окна или экрана
  node scripts/record-show/record-show.mjs status [--json]
  node scripts/record-show/record-show.mjs menubar    значок в строке меню, горячие клавиши ⌃⌥⌘R и ⌃⌥⌘S
  node scripts/record-show/record-show.mjs open       открыть папку записей
  node scripts/record-show/record-show.mjs clean      удалить записи старше ${KEEP_DAYS} дней
  node scripts/record-show/record-show.mjs process <папка>   пересобрать контекст записи

Записи: ${ROOT}`);
}

const commands = {
  start,
  stop,
  toggle: async () => (current() && !current().stale ? stop() : start()),
  status,
  shot,
  menubar,
  open: () => {
    fs.mkdirSync(ROOT, { recursive: true });
    spawnSync("open", [ROOT]);
  },
  clean: () => {
    const removed = cleanOld();
    say(removed.length ? `Удалено: ${removed.join(", ")}` : "Удалять нечего.");
  },
  worker: () => worker(path.resolve(args[1])),
  process: async () => {
    const dir = path.resolve(args[1]);
    if (!fs.existsSync(path.join(dir, "stopped.json"))) writeJson(path.join(dir, "stopped.json"), { at: new Date().toISOString() });
    fs.rmSync(path.join(dir, "manifest.json"), { force: true });
    await worker(dir);
    say(path.join(dir, "context.md"));
  },
  help,
};

try {
  if (!commands[command]) throw new Refusal(`Нет команды «${command}». Список: record-show help`, 64);
  await commands[command]();
} catch (e) {
  if (e instanceof Refusal) {
    if (json) console.log(JSON.stringify({ error: e.message, code: e.code }));
    else process.stderr.write(`${e.message}\n`);
    if (flag("from-menu")) execFileSync("osascript", ["-e", `display notification ${JSON.stringify(e.message.split("\n")[0])} with title "Запись показа"`]);
    process.exit(e.code);
  }
  throw e;
}
// #endregion record-show-cli
