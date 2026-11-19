// record-show: the pure parts of the show recorder (scripts/record-show/lib.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import {
  parseDevices,
  parseSegmentsCsv,
  parseSceneTimes,
  parseWhisperJson,
  findCues,
  cursorAt,
  clicksBetween,
  pickKeyframes,
  toDisplayPoint,
  formatClock,
  renderContext,
  sessionsToClean,
  responsibleApp,
  permissionError,
  parseVolume,
  normalizeSegments,
} from "../record-show/lib.mjs";

const LIST = `[AVFoundation indev @ 0x1] AVFoundation video devices:
[AVFoundation indev @ 0x1] [0] MacBook Pro Camera
[AVFoundation indev @ 0x1] [1] MacBook Pro Desk View Camera
[AVFoundation indev @ 0x1] [2] Capture screen 0
[AVFoundation indev @ 0x1] [3] Capture screen 1
[AVFoundation indev @ 0x1] AVFoundation audio devices:
[AVFoundation indev @ 0x1] [0] ZoomAudioDevice
[AVFoundation indev @ 0x1] [1] MacBook Pro Microphone
Error opening input file .`;

test("parseDevices finds screens by their own number and audio devices by name", () => {
  const d = parseDevices(LIST);
  assert.deepEqual(d.screens, [
    { device: 2, screen: 0 },
    { device: 3, screen: 1 },
  ]);
  assert.deepEqual(d.audio, [
    { device: 0, name: "ZoomAudioDevice" },
    { device: 1, name: "MacBook Pro Microphone" },
  ]);
});

test("parseSegmentsCsv reads finished segments, ignoring blank lines", () => {
  const rows = parseSegmentsCsv("seg-000.mp4,0.000000,45.100000\nseg-001.mp4,45.100000,90.000000\n\n");
  assert.deepEqual(rows, [
    { file: "seg-000.mp4", start: 0, end: 45.1 },
    { file: "seg-001.mp4", start: 45.1, end: 90 },
  ]);
});

test("parseSceneTimes reads showinfo pts_time values", () => {
  const log = `[Parsed_showinfo_1 @ 0x1] n:   0 pts:  12 pts_time:1.2    duration
[Parsed_showinfo_1 @ 0x1] n:   1 pts:  99 pts_time:9.9 duration`;
  assert.deepEqual(parseSceneTimes(log), [1.2, 9.9]);
});

test("parseWhisperJson keeps text lines in seconds and the language", () => {
  const json = {
    result: { language: "ru" },
    transcription: [
      { offsets: { from: 0, to: 2400 }, text: " Вот тут смотри." },
      { offsets: { from: 2400, to: 2600 }, text: " " },
      { offsets: { from: 3000, to: 5000 }, text: " [BLANK_AUDIO]" },
    ],
  };
  assert.deepEqual(parseWhisperJson(json), {
    language: "ru",
    lines: [{ start: 0, end: 2.4, text: "Вот тут смотри." }],
  });
});

test("findCues finds pointing words in Russian and English with an estimated time", () => {
  const cues = findCues([
    { start: 10, end: 14, text: "Сначала открой меню, а вот тут смотри" },
    { start: 20, end: 22, text: "Look at this button" },
    { start: 30, end: 31, text: "ничего особенного" },
  ]);
  assert.equal(cues.length, 2);
  assert.equal(cues[0].word.toLowerCase(), "вот тут");
  assert.ok(cues[0].t > 12 && cues[0].t < 14, `cue time ${cues[0].t}`);
  assert.equal(cues[1].word.toLowerCase(), "look at");
  assert.equal(cues[1].t, 20);
});

const MOUSE = [
  { t: 1000, x: 10, y: 10, b: 0 },
  { t: 2000, x: 100, y: 50, b: 0 },
  { t: 2100, x: 100, y: 50, b: 1 },
  { t: 2300, x: 100, y: 50, b: 0 },
  { t: 3000, x: 200, y: 80, b: 2 },
];

test("cursorAt answers the last known position at a moment, none before the first sample", () => {
  assert.equal(cursorAt(MOUSE, 500), null);
  assert.deepEqual(cursorAt(MOUSE, 1500), { x: 10, y: 10 });
  assert.deepEqual(cursorAt(MOUSE, 2050), { x: 100, y: 50 });
});

test("clicksBetween reports presses, not releases, with the button", () => {
  assert.deepEqual(clicksBetween(MOUSE, 0, 5000), [
    { t: 2100, x: 100, y: 50, button: "left" },
    { t: 3000, x: 200, y: 80, button: "right" },
  ]);
  assert.deepEqual(clicksBetween(MOUSE, 2200, 2900), []);
});

test("toDisplayPoint maps global points into the captured display, null outside", () => {
  const display = { x: 0, y: 0, width: 1000, height: 500 };
  assert.deepEqual(toDisplayPoint({ x: 250, y: 125 }, display), { nx: 0.25, ny: 0.25 });
  assert.equal(toDisplayPoint({ x: 1200, y: 10 }, display), null);
  assert.equal(toDisplayPoint(null, display), null);
});

test("pickKeyframes prefers pointing words and clicks, keeps a gap, caps the count", () => {
  const frames = pickKeyframes(
    {
      duration: 45,
      scenes: [5, 5.4, 20],
      cues: [{ t: 5.2, word: "вот тут" }],
      clicks: [{ t: 30, button: "left" }],
    },
    { minGap: 1.5, max: 3 },
  );
  assert.equal(frames.length, 3);
  const at = (t) => frames.find((f) => Math.abs(f.t - t) < 0.01);
  assert.ok(at(5.5), "the cue frame sits just after the word");
  assert.deepEqual(at(5.5).why.sort(), ["scene", "word: вот тут"].sort());
  assert.ok(at(30.2));
  assert.ok(frames.every((f, i) => i === 0 || f.t > frames[i - 1].t), "sorted by time");
});

test("pickKeyframes always keeps one frame for a quiet chunk", () => {
  const frames = pickKeyframes({ duration: 45, scenes: [], cues: [], clicks: [] });
  assert.equal(frames.length, 1);
  assert.deepEqual(frames[0].why, ["start"]);
});

test("formatClock prints minutes and seconds", () => {
  assert.equal(formatClock(0), "00:00");
  assert.equal(formatClock(65.4), "01:05");
  assert.equal(formatClock(3725), "62:05");
});

test("renderContext orders speech, clicks, frames and shots, with no em dash", () => {
  const md = renderContext({
    startedAt: "2026-11-19T18:00:00.000Z",
    status: "done",
    display: { width: 1728, height: 1117 },
    items: [
      {
        kind: "chunk",
        index: 0,
        start: 0,
        end: 45,
        language: "ru",
        warnings: ["Звук очень тихий"],
        lines: [{ start: 3, end: 5, text: "Вот тут смотри", cursor: { nx: 0.42, ny: 0.31 } }],
        clicks: [{ at: 7, button: "left", cursor: { nx: 0.5, ny: 0.2 } }],
        frames: [{ at: 3.3, file: "frames/c000-0003.3.jpg", why: ["word: вот тут"], cursor: { nx: 0.42, ny: 0.31 } }],
      },
      { kind: "shot", at: 50, file: "shots/shot-0050.png", mode: "area", near: ["А это настройки"] },
    ],
  });
  assert.ok(md.includes("«Вот тут смотри»"));
  assert.ok(md.includes("frames/c000-0003.3.jpg"));
  assert.ok(md.includes("42% слева, 31% сверху"));
  assert.ok(md.includes("shots/shot-0050.png"));
  assert.ok(md.includes("Звук очень тихий"));
  const order = ["«Вот тут смотри»", "c000-0003.3.jpg", "левой", "shot-0050"].map((s) => md.indexOf(s));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.ok(!md.includes("—"), "no em dash in text for people");
});

test("sessionsToClean picks only marked sessions older than the limit, never the current one", () => {
  const now = Date.parse("2026-11-19T12:00:00Z");
  const day = 86_400_000;
  const picked = sessionsToClean(
    [
      { name: "old", marked: true, mtime: now - 9 * day },
      { name: "fresh", marked: true, mtime: now - 1 * day },
      { name: "foreign", marked: false, mtime: now - 30 * day },
      { name: "live", marked: true, mtime: now - 30 * day },
    ],
    { now, keepDays: 7, current: "live" },
  );
  assert.deepEqual(picked, ["old"]);
});

test("responsibleApp names the first .app up the process chain", () => {
  const chain = ["/bin/zsh", "/opt/tools/bin/claude", "/Applications/Fabric.app/Contents/MacOS/Fabric"];
  assert.equal(responsibleApp(chain), "Fabric");
  assert.equal(responsibleApp(["/bin/zsh", "/usr/sbin/sshd"]), null);
});

test("permissionError says what to switch on, in which app, and where", () => {
  const msg = permissionError("screen", "Fabric");
  assert.match(msg, /Запись экрана/);
  assert.match(msg, /Fabric/);
  assert.match(msg, /Privacy_ScreenCapture/);
  assert.ok(!msg.includes("—"));
  assert.match(permissionError("microphone", null), /Микрофон/);
});

test("parseVolume reads volumedetect output", () => {
  assert.deepEqual(parseVolume("[Parsed_volumedetect_0] mean_volume: -42.1 dB\n[Parsed_volumedetect_0] max_volume: -20.0 dB"), {
    mean: -42.1,
    max: -20,
  });
  assert.equal(parseVolume("nothing"), null);
});

test("normalizeSegments turns wall-clock rows into times from the first frame", () => {
  const rows = parseSegmentsCsv(
    "seg-000.mp4,0.000000,1795114063.600000\nseg-001.mp4,1795114063.600000,1795114067.600000\n",
  );
  const lengths = { "seg-000.mp4": 6.1, "seg-001.mp4": 4 };
  const { base, segments } = normalizeSegments(rows, (f) => lengths[f]);
  assert.equal(base, 1795114057.5);
  assert.deepEqual(segments, [
    { file: "seg-000.mp4", start: 0, end: 6.1 },
    { file: "seg-001.mp4", start: 6.1, end: 10.1 },
  ]);
  assert.deepEqual(normalizeSegments([{ file: "a", start: 0, end: 45 }], () => 45).segments, [{ file: "a", start: 0, end: 45 }]);
});
