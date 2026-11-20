# Setting up Fabric's CEO from a coding agent

For a person, or a coding agent working for them (Claude Code, Codex, any other), on a Mac with Fabric 0.3.24 or later.
Decision: [ADR-0197](../adr/0197-the-ceo-is-a-console-session-fabric-keeps-with-a-fallback-runner.md). Every step runs
in a terminal; none prints a key.

## 1. The CEO itself

Nothing to install: the CEO is a console Fabric keeps. It starts on Claude Code when Claude Code is installed and
signed in, else on Hermes signed in with an OpenRouter key (settings `ceoRunners`, `ceoModels`, ADR-0197 decision 2).
Open it with «Спросить CEO» on Главная or the «CEO» button.

## 2. The voice call: the person's own xAI key

Each person uses their own key from `console.x.ai` (the operator, 2026-11-19). Two ways in:

- **In the CEO window:** «Позвонить» without a key shows «Ваш ключ xAI»; paste it and press «Сохранить ключ».
- **From a coding agent**, without the agent ever reading the key: the person copies the key to the clipboard, then the
  agent runs

  ```sh
  D="$HOME/Library/Application Support/@fabric/desktop/ceo-voice"
  mkdir -p "$D" && (umask 077; pbpaste | tr -d '\r\n' > "$D/xai-key.drop")
  ```

  (Linux: `~/.config/@fabric/desktop/ceo-voice`, with `xclip -o -selection clipboard` or `wl-paste` for `pbpaste`;
  Windows: `%APPDATA%\@fabric\desktop\ceo-voice`, with `Get-Clipboard`.) Fabric takes the drop file in at the next call,
  keeps the key encrypted in `xai-key.bin` (Electron `safeStorage`, mode 0600) and deletes the drop file
  (`apps/desktop/src/main/ceoVoiceKey.ts`). A drop that is not shaped like an xAI key (`xai-` and at least 20
  characters) is deleted and changes nothing.

To check without the value: the operations log has `ceo.voice.key-set` when the window saved one, and the next call's
`ceo.voice.token` reads `ok`. To remove the key: delete `xai-key.bin` in that folder.

Without a key of the person's own, Fabric reads Project Observatory's vault slot `fabric/prod/XAI_API_KEY` (the
operator's machine), never printing it.

## 3. What a call costs and keeps

USD 0.08 a minute of open session, shown during the call
([external contracts, xAI](../architecture/external-contracts.md#xai-realtime-voice-the-ceos-call-adr-0197-decision-5)).
xAI keeps conversation data for 30 days unless the key's team has zero data retention turned on in its console; a
person who needs that turns it on there.

Fabric keeps each call on this computer too (0.3.27, [ADR-0197 amendment 4](../adr/0197-the-ceo-is-a-console-session-fabric-keeps-with-a-fallback-runner.md#amendment-4-2026-11-20-the-call-is-kept-on-this-computer-the-voice-delegates-and-finds-a-project-by-sound)):
one file a call in `<userData>/ceo/calls/` (owner-only), with what was said, each tool and its answer, the length and the
price, secrets cut before writing, removed after 30 days or past the newest 200 calls. The CEO's console reads these
files, so their text reaches the CEO's runner's provider as any file it opens. During a call, xAI receives what the
voice's tools answer: session screens and turns, the CEO's answer, board snippets and recent launches, all redacted and
bounded. To keep no calls, delete the folder; Fabric makes it again at the next call.

## 4. The microphone

macOS asks once for the microphone the first time «Позвонить» is pressed; the release build carries the audio-input
entitlement (`apps/desktop/resources/entitlements.mac.plist`). A refused permission is turned on again in System
Settings, Privacy and Security, Microphone.
