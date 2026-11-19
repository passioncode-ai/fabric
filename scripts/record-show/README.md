# record-show: record a show for an agent

The owner shows something with the mouse and talks; `record-show` records the screen (cursor
visible) and the microphone in chunks of 45 seconds and turns each chunk into context an agent
reads whole: the speech with times, key frames, where the cursor was and what was clicked.
Screenshots of an area, a window or the whole screen go into the same context. Asked for by the
owner on 2026-11-19 (board thread of the voice CEO backlog, items 1 and 2).

## Commands

```bash
node scripts/record-show/record-show.mjs toggle      # start, or stop and finish the context
node scripts/record-show/record-show.mjs menubar     # menu bar item: ⌃⌥⌘R record or stop, ⌃⌥⌘S area screenshot
node scripts/record-show/record-show.mjs shot [--window | --screen]
node scripts/record-show/record-show.mjs start [--screen N] [--mic name] [--no-audio] [--name label]
node scripts/record-show/record-show.mjs stop [--no-wait] [--no-copy]
node scripts/record-show/record-show.mjs status [--json]
node scripts/record-show/record-show.mjs open | clean | help
node scripts/record-show/record-show.mjs process <session folder>   # rebuild the context of a session
```

`stop` waits for the last chunk, prints the path of `context.md` and copies it to the clipboard:
paste it into a task or an agent's chat. Every command takes `--json` for a program to read.

## What a session folder holds

Sessions live in `~/Library/Application Support/ai.passioncode.fabric/show-recordings/`
(`RECORD_SHOW_DIR` overrides it), outside every Git repository, and are removed after 7 days
(`RECORD_SHOW_KEEP_DAYS`) when the next recording starts or on `clean`. Only folders carrying the
`.record-show` marker are ever removed, never the live one.

| File | What |
|---|---|
| `context.md` | The whole show in order: what was said (with the cursor), clicks, key frames, screenshots |
| `chunks/NNN.md` | The same for one chunk, written as soon as that chunk is ready |
| `manifest.json` | `record-show/1`: every chunk (lines, clicks, frames, warnings) and shot, with times in seconds from the first frame |
| `frames/*.jpg` | Key frames, 1280 px wide, the cursor ringed in red |
| `shots/*.png` | Screenshots |
| `seg-NNN.mp4` | The chunks themselves (H.264, 10 fps, AAC mono) |
| `mouse.jsonl` | The cursor every 0.1 s while it moves and every button change (epoch ms, global points) |

## How it works

- **Capture.** ffmpeg's `avfoundation` input records the screen with the cursor and mouse clicks
  drawn, and the microphone, through the segment muxer (`seg-%03d.mp4`, fragmented MP4, so a chunk
  is readable even if ffmpeg is killed). The input runs on wall-clock timestamps
  (`-use_wallclock_as_timestamps 1 -copyts`), so the segment list says when each chunk began on the
  same clock as the cursor log; `fps=10` is required, without it avfoundation's timestamps keep the
  segment muxer from ever cutting.
- **Cursor and clicks.** `helper.swift`, compiled once into `~/Library/Caches/fabric-record-show/`,
  reads `CGEvent(source: nil).location` and `CGEventSource.buttonState`; neither needs
  Accessibility or Input Monitoring.
- **Speech.** whisper.cpp (`whisper-cli` from Homebrew or another local tool's install under `~/.local/share`, the `ggml-small` model,
  language detected per chunk); without it the `openai-whisper` CLI. Override with
  `RECORD_SHOW_WHISPER_CLI`, `RECORD_SHOW_WHISPER_MODEL`, `RECORD_SHOW_LANGUAGE`.
- **Key frames.** Moments where a pointing word was said («вот тут», «смотри», «обрати внимание»,
  "look at", …), a button was pressed or the picture changed (`select=gt(scene,0.12)`); close
  moments merge, at most 12 per chunk, at least one.
- **Worker.** A detached worker turns each chunk into context as soon as the segment muxer lists
  it, so a long show is ready a few seconds after it ends. Code: `lib.mjs` (pure, tested in
  `scripts/test/record-show.test.mjs`) and `record-show.mjs` (the processes).

## Permissions

The app the command runs in (Terminal, iTerm, Fabric) needs **Screen Recording** and, for sound,
**Microphone** in System Settings, Privacy & Security. Before anything is recorded the helper asks
macOS (`CGPreflightScreenCaptureAccess`, `AVCaptureDevice.authorizationStatus`); without them the
command shows the system prompt or opens the right settings pane and exits 3 (screen) or 4
(microphone) with a message naming the app, and no file is written. A chunk with a near-silent
track or a black first frame carries a warning in `context.md`.

Exit codes: 0 done, 2 helper or tool failure, 3 no Screen Recording, 4 no Microphone, 5 already
recording, 6 ffmpeg did not start, 7 not recording.
