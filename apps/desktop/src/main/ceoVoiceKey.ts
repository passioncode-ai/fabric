// #region ceo-voice-key — docs: docs/adr/0197-the-ceo-is-a-console-session-fabric-keeps-with-a-fallback-runner.md#the-voice-call
/**
 * The person's own xAI key for the CEO's voice call (the operator, 2026-11-19: «Токен ... пусть каждый свой кастомный
 * просто вставляет и все ... XAI токен выставляется и она начинает работать. Это все сетапится клауд-кодом»).
 *
 * Two ways in, neither printing the value:
 * - the CEO window's field (IPC `ceoAgentVoiceKeySet`): the person pastes it;
 * - a drop file for a coding agent: `userData/ceo/xai-key.drop`, written with mode 0600 from the clipboard
 *   (`pbpaste > …`), so the agent never reads the value. The next read takes it in and deletes the file.
 *
 * The key is kept in `userData/ceo/xai-key.bin` (0600), encrypted with Electron's `safeStorage` when the platform
 * offers it (the app's own Keychain item on macOS; no item of Fabric's), else in plain text under the same mode.
 * It is read in the main process only and spent on an ephemeral secret (`ceoVoice.ts`); nothing logs it.
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export interface SafeStoragePort {
  isEncryptionAvailable(): boolean
  encryptString(plain: string): Buffer
  decryptString(encrypted: Buffer): string
}

export type VoiceKeySource = 'own' | 'none'
export type VoiceKeySetAnswer = { ok: true } | { ok: false; reason: 'empty' | 'malformed' | 'unwritable' }

/** An xAI API key's shape: `xai-` and at least 20 characters of key, no whitespace. */
export function voiceKeyShapeOk(value: string): boolean {
  return /^xai-[A-Za-z0-9_-]{20,}$/.test(value)
}

const ENC = 'enc1:'
const PLAIN = 'plain1:'

export function createVoiceKeyStore(dir: string, safe: SafeStoragePort | null) {
  const file = path.join(dir, 'xai-key.bin')
  const drop = path.join(dir, 'xai-key.drop')

  function write(value: string): VoiceKeySetAnswer {
    const key = value.trim()
    if (!key) return { ok: false, reason: 'empty' }
    if (!voiceKeyShapeOk(key)) return { ok: false, reason: 'malformed' }
    try {
      mkdirSync(dir, { recursive: true, mode: 0o700 })
      const body = safe?.isEncryptionAvailable()
        ? Buffer.concat([Buffer.from(ENC), safe.encryptString(key)])
        : Buffer.from(PLAIN + key)
      writeFileSync(file, body, { mode: 0o600 })
      chmodSync(file, 0o600)
      return { ok: true }
    } catch {
      return { ok: false, reason: 'unwritable' }
    }
  }

  /** A key a coding agent dropped is taken in once, then the drop file is removed whatever its content. */
  function takeDrop(): void {
    if (!existsSync(drop)) return
    let text = ''
    try { text = readFileSync(drop, 'utf8') } catch { /* unreadable: removed below */ }
    try { rmSync(drop, { force: true }) } catch { /* left for the next read */ }
    if (text.trim()) write(text)
  }

  function read(): string | null {
    takeDrop()
    if (!existsSync(file)) return null
    try {
      const body = readFileSync(file)
      const head = body.subarray(0, ENC.length).toString()
      if (head === ENC) return safe ? safe.decryptString(body.subarray(ENC.length)) : null
      const text = body.toString('utf8')
      return text.startsWith(PLAIN) ? text.slice(PLAIN.length) : null
    } catch {
      return null
    }
  }

  return {
    set: write,
    read,
    clear(): void { rmSync(file, { force: true }); rmSync(drop, { force: true }) },
    source(): VoiceKeySource { return read() ? 'own' : 'none' },
    dropPath: drop
  }
}
export type VoiceKeyStore = ReturnType<typeof createVoiceKeyStore>
// #endregion ceo-voice-key
