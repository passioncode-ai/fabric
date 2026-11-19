// record-show: the pure parts of the show recorder. Everything here takes text or
// data and returns data, so it is tested without a screen, a microphone or ffmpeg
// (scripts/test/record-show.test.mjs). The processes live in record-show.mjs.
//
// #region record-show-lib — docs: scripts/record-show/README.md#how-it-works

/** Devices from `ffmpeg -f avfoundation -list_devices true -i ""`. */
export function parseDevices(text) {
  const screens = [];
  const audio = [];
  let section = null;
  for (const line of text.split("\n")) {
    if (/AVFoundation video devices/.test(line)) section = "video";
    else if (/AVFoundation audio devices/.test(line)) section = "audio";
    const m = line.match(/\]\s\[(\d+)\]\s(.+)$/);
    if (!m) continue;
    const device = Number(m[1]);
    const name = m[2].trim();
    if (section === "video") {
      const s = name.match(/^Capture screen (\d+)$/);
      if (s) screens.push({ device, screen: Number(s[1]) });
    } else if (section === "audio") audio.push({ device, name });
  }
  return { screens, audio };
}

/** The segment muxer's csv list: one line per finished segment, times in seconds. */
export function parseSegmentsCsv(text) {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [file, start, end] = l.split(",");
      return { file, start: Number(start), end: Number(end) };
    })
    .filter((r) => r.file && Number.isFinite(r.start) && Number.isFinite(r.end));
}

/**
 * ffmpeg runs with wall-clock timestamps (-use_wallclock_as_timestamps 1 -copyts), so
 * the csv holds epoch seconds; the first row's start is 0 because the muxer starts
 * there. A segment really starts at its end minus its own length. Times come back
 * from the first frame, with that frame's epoch as `base`, so the cursor log
 * (epoch ms) and the video share one clock. Rows already relative pass through.
 */
export function normalizeSegments(rows, durationOf) {
  if (!rows.length || rows.every((r) => r.end < 1e9)) return { base: null, segments: rows };
  const abs = rows.map((r) => {
    const d = durationOf(r.file);
    return { file: r.file, start: r.end - d, end: r.end };
  });
  const base = abs[0].start;
  return {
    base,
    segments: abs.map((r) => ({ file: r.file, start: round(r.start - base, 3), end: round(r.end - base, 3) })),
  };
}

/** Times of the frames a `select=gt(scene,…),showinfo` filter let through. */
export function parseSceneTimes(text) {
  return [...text.matchAll(/pts_time:\s*([\d.]+)/g)].map((m) => Number(m[1]));
}

/** whisper.cpp's `-oj`/`-ojf` JSON into lines in seconds. Blank and marker lines are dropped. */
export function parseWhisperJson(json) {
  const lines = (json.transcription ?? [])
    .map((s) => ({
      start: s.offsets.from / 1000,
      end: s.offsets.to / 1000,
      text: s.text.trim(),
    }))
    .filter((l) => l.text && !/^\[.*\]$/.test(l.text) && !/^\(.*\)$/.test(l.text));
  return { language: json.result?.language ?? null, lines };
}

// Words a person says while pointing at something. Russian first: it is the owner's language.
const CUE =
  /(вот\s+(?:тут|здесь|это|так|эт[оуи]т?|сюда)|смотри(?:те)?|посмотри(?:те)?|видишь|видите|обрати(?:те)?\s+внимание|look\s+at|look\s+here|right\s+here|over\s+here|see\s+this|this\s+one|notice)/giu;

/** Pointing words with the moment they were said, estimated by their place in the line. */
export function findCues(lines) {
  const cues = [];
  for (const line of lines) {
    for (const m of line.text.matchAll(CUE)) {
      const share = line.text.length ? m.index / line.text.length : 0;
      const t = line.start + share * (line.end - line.start);
      // «вот тут смотри» is one gesture, not two.
      if (cues.length && t - cues.at(-1).t < 1) continue;
      cues.push({ t, word: m[0] });
    }
  }
  return cues;
}

/** The cursor's last known global point at epoch ms `t`; null before the first sample. */
export function cursorAt(samples, t) {
  let found = null;
  for (const s of samples) {
    if (s.t > t) break;
    found = s;
  }
  return found ? { x: found.x, y: found.y } : null;
}

/** Button presses (0 to 1 on a bit) between two epoch ms moments. */
export function clicksBetween(samples, from, to) {
  const clicks = [];
  let prev = 0;
  for (const s of samples) {
    const pressed = s.b & ~prev;
    if (s.t >= from && s.t < to) {
      if (pressed & 1) clicks.push({ t: s.t, x: s.x, y: s.y, button: "left" });
      if (pressed & 2) clicks.push({ t: s.t, x: s.x, y: s.y, button: "right" });
    }
    prev = s.b;
  }
  return clicks;
}

/** A global point as shares of the captured display (0 to 1 from the top left); null outside it. */
export function toDisplayPoint(point, display) {
  if (!point || !display) return null;
  const nx = (point.x - display.x) / display.width;
  const ny = (point.y - display.y) / display.height;
  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return null;
  return { nx: round(nx, 3), ny: round(ny, 3) };
}

const round = (v, n) => Math.round(v * 10 ** n) / 10 ** n;

/**
 * Which moments of a chunk become key frames. Pointing words weigh most, then
 * clicks, then scene changes; a frame is taken a moment after the word or click
 * so the screen has answered. Candidates closer than `minGap` merge into one.
 */
export function pickKeyframes({ duration, scenes, cues, clicks }, { minGap = 1.5, max = 12 } = {}) {
  const clamp = (t) => Math.min(Math.max(t, 0), Math.max(duration - 0.1, 0));
  const candidates = [
    ...cues.map((c) => ({ t: clamp(c.t + 0.3), weight: 3, why: `word: ${c.word.toLowerCase()}` })),
    ...clicks.map((c) => ({ t: clamp(c.t + 0.2), weight: 2, why: `click: ${c.button}` })),
    ...scenes.map((t) => ({ t: clamp(t), weight: 1, why: "scene" })),
  ].sort((a, b) => b.weight - a.weight || a.t - b.t);
  const picked = [];
  for (const c of candidates) {
    const near = picked.find((p) => Math.abs(p.t - c.t) < minGap);
    if (near) {
      if (!near.why.includes(c.why)) near.why.push(c.why);
      continue;
    }
    if (picked.length < max) picked.push({ t: round(c.t, 2), why: [c.why] });
  }
  if (!picked.length) picked.push({ t: clamp(Math.min(0.5, duration / 2)), why: ["start"] });
  return picked.sort((a, b) => a.t - b.t);
}

export function formatClock(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

const where = (c) => (c ? `${Math.round(c.nx * 100)}% слева, ${Math.round(c.ny * 100)}% сверху` : "вне записанного экрана");
const WHY = { scene: "сменилась картинка", start: "начало куска" };
const whyText = (why) =>
  why
    .map((w) =>
      w.startsWith("word: ") ? `сказано «${w.slice(6)}»` : w.startsWith("click: ") ? "клик" : (WHY[w] ?? w),
    )
    .join(", ");

/**
 * context.md: everything the owner showed, in the order it happened, for an agent
 * to read whole. Times count from the start of the recording; frames and shots
 * are paths relative to the session folder.
 */
export function renderContext(manifest) {
  const started = new Date(manifest.startedAt);
  const chunks = manifest.items.filter((i) => i.kind === "chunk").sort((a, b) => a.start - b.start);
  const shots = manifest.items.filter((i) => i.kind === "shot").sort((a, b) => a.at - b.at);
  const end = Math.max(0, ...chunks.map((c) => c.end), ...shots.map((s) => s.at));
  const out = [
    `# Показ владельца, ${started.toLocaleString("ru-RU", { dateStyle: "long", timeStyle: "short" })}`,
    "",
    `Запись экрана с курсором и речью, ${formatClock(end)} всего${manifest.status === "done" ? "" : " (запись ещё идёт, файл дописывается)"}.`,
    "Время считается от начала записи. Положение курсора дано в долях экрана: проценты слева и сверху.",
    "На кадрах курсор обведён красной рамкой. Пути к кадрам и снимкам даны от папки этого файла; открой их, чтобы увидеть, что показано.",
    "",
  ];
  const shotLine = (s) => {
    const near = s.near?.length ? `; рядом сказано: ${s.near.map((t) => `«${t}»`).join(" ")}` : "";
    return { at: s.at, text: `снимок ${s.mode === "window" ? "окна" : s.mode === "screen" ? "экрана" : "области"}: ${s.file}${near}` };
  };
  const used = new Set();
  for (const c of chunks) {
    out.push(`## Кусок ${c.index + 1}: с ${formatClock(c.start)} по ${formatClock(c.end)}`, "");
    for (const w of c.warnings ?? []) out.push(`> Внимание: ${w}`, "");
    const entries = [
      ...c.lines.map((l) => ({ at: l.start, text: `сказано: «${l.text}» (курсор: ${where(l.cursor)})` })),
      ...c.clicks.map((k) => ({ at: k.at, text: `клик ${k.button === "right" ? "правой" : "левой"} кнопкой (${where(k.cursor)})` })),
      ...c.frames.map((f) => ({ at: f.at, text: `кадр: ${f.file} (почему: ${whyText(f.why)}; курсор: ${where(f.cursor)})` })),
      ...shots
        .filter((s) => s.at >= c.start && s.at < c.end + (c === chunks.at(-1) ? Infinity : 0))
        .map((s) => {
          used.add(s);
          return shotLine(s);
        }),
    ].sort((a, b) => a.at - b.at);
    if (!c.lines.length) out.push("Речи в этом куске не слышно.", "");
    for (const e of entries) out.push(`- **${formatClock(e.at)}** ${e.text}`);
    out.push("");
  }
  const rest = shots.filter((s) => !used.has(s));
  if (rest.length) {
    out.push("## Снимки", "");
    for (const s of rest) out.push(`- **${formatClock(s.at)}** ${shotLine(s).text}`);
    out.push("");
  }
  return out.join("\n");
}

/** Session folders to remove: ours (marked), older than keepDays, never the live one. */
export function sessionsToClean(sessions, { now, keepDays, current }) {
  const limit = now - keepDays * 86_400_000;
  return sessions.filter((s) => s.marked && s.name !== current && s.mtime < limit).map((s) => s.name);
}

/** macOS asks the app at the top of the process chain for permissions: name it. */
export function responsibleApp(chain) {
  for (let i = chain.length - 1; i >= 0; i--) {
    const m = chain[i].match(/\/([^/]+)\.app\/Contents\/MacOS\//);
    if (m) return m[1];
  }
  return null;
}

const SETTINGS = {
  screen: {
    name: "Запись экрана и системного аудио",
    url: "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture",
  },
  microphone: {
    name: "Микрофон",
    url: "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone",
  },
};

export function permissionSettingsUrl(kind) {
  return SETTINGS[kind].url;
}

/** One message a person can act on: which permission, for which app, where to switch it on. */
export function permissionError(kind, app) {
  const s = SETTINGS[kind];
  const who = app ? `приложению «${app}»` : "приложению, из которого запущен скрипт (Терминал или Fabric)";
  return [
    `Нет разрешения macOS «${s.name}». Запись не начата, пустой файл не создан.`,
    `Включите его ${who}: Системные настройки, Конфиденциальность и безопасность, ${s.name}.`,
    `Открыть настройки: open "${s.url}"`,
    kind === "screen" ? "После включения macOS просит перезапустить приложение: перезапустите и повторите." : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** ffmpeg volumedetect: mean and max level in dB. */
export function parseVolume(text) {
  const mean = text.match(/mean_volume:\s*(-?[\d.]+|-inf) dB/);
  const max = text.match(/max_volume:\s*(-?[\d.]+|-inf) dB/);
  if (!mean || !max) return null;
  const n = (v) => (v === "-inf" ? -Infinity : Number(v));
  return { mean: n(mean[1]), max: n(max[1]) };
}

// #endregion record-show-lib
