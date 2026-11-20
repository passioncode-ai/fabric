// #region ceo-voice — docs: docs/adr/0197-the-ceo-is-a-console-session-fabric-keeps-with-a-fallback-runner.md#the-voice-call
/**
 * The voice call's main-process half (ADR-0197, the voice call, board task e7ff5556): the xAI key never leaves this process. It is
 * the person's own key (`ceoVoiceKey.ts`) or else Project Observatory's vault for one call (`observatoryVault.ts`, slot
 * `fabric/prod/XAI_API_KEY`), spent
 * on an ephemeral client secret (`POST /v1/realtime/client_secrets`, five minutes); the CEO window opens the realtime
 * socket with that secret alone. The call's instructions and tools are composed here, so the window holds no prompt
 * of its own, and every tool the call asks for runs here through the CEO's operations (`ceoTools.ts`) with their gates.
 */
import type { VaultPort } from './observatoryVault.ts'
import type { CeoVoiceProblem } from '../shared/ceoAgent.ts'

export const XAI_KEY_SLOT = { project: 'fabric', env: 'prod' as const, name: 'XAI_API_KEY' }
export const XAI_SECRETS_URL = 'https://api.x.ai/v1/realtime/client_secrets'
export const XAI_REALTIME_URL = 'wss://api.x.ai/v1/realtime?model=grok-voice-latest'
/** xAI's list price for a realtime minute, shown beside the call's length: USD 0.08 a minute, from
 *  `docs.x.ai/developers/models/voice-agent-api`, fetched 2026-11-19 (docs/architecture/external-contracts.md, xAI). */
export const XAI_USD_PER_MINUTE = 0.08
const TOKEN_SECONDS = 300

export interface VoiceToken { ok: true; value: string; expiresAt: number; url: string; usdPerMinute: number }
/** A refusal: its code for the window, its raw detail for the operations log only (ER-7). */
export type VoiceTokenAnswer = VoiceToken | { ok: false; reason: CeoVoiceProblem; detail: string }

/** The call's instructions: who speaks, in which language, and which tools it has. */
export function voiceInstructions(locale: string): string {
  return locale === 'en'
    ? 'You are the voice of Fabric\'s CEO agent on the owner\'s computer. Speak English, briefly. You can list, read, type into, start, stop, continue and open the coding sessions of this computer with your tools, close and arrange their windows on the screens, open and switch the dashboards of Fabric Dashboards (full screen too), and hand a longer request to the CEO console with ask_ceo. Before stopping a session, read it and say why. Never write an em dash in what you say.'
    : 'Ты голос CEO-агента Fabric на компьютере владельца. Говори по-русски, коротко. Своими инструментами ты видишь, читаешь, вводишь текст, запускаешь, останавливаешь, продолжаешь и открываешь сессии разработки этого компьютера, закрываешь и расставляешь их окна по экранам, открываешь и переключаешь дашборды Fabric Dashboards (и на весь экран), а длинную просьбу передаешь CEO в консоль инструментом ask_ceo. Прежде чем остановить сессию, прочитай ее и скажи почему. Никогда не ставь длинное тире.'
}

/** The tool that hands a request to the CEO's console, beside the session tools. */
export const ASK_CEO_TOOL = {
  type: 'function' as const,
  name: 'ask_ceo',
  description: 'Hand a request to the CEO agent\'s console in words: anything that needs planning, several steps or other tools than the session ones. The CEO answers in its console.',
  parameters: { type: 'object', properties: { text: { type: 'string', description: 'The request, in the owner\'s words.' } }, required: ['text'], additionalProperties: false }
}

export interface VoiceDeps {
  /** The person's own key (`ceoVoiceKey.ts`), tried first; null when none is set. */
  ownKey?: () => string | null
  vault: Pick<VaultPort, 'read'>
  fetch: typeof fetch
  now?: () => number
}

/** One ephemeral secret for one call; the key itself is held for this request only. */
export async function mintVoiceToken(deps: VoiceDeps): Promise<VoiceTokenAnswer> {
  const own = deps.ownKey?.() ?? null
  const key = own ? { ok: true as const, value: own } : await deps.vault.read(XAI_KEY_SLOT)
  if (!key.ok) return { ok: false, reason: 'no-key', detail: `no xAI key of the person's, and Observatory's could not be read: ${key.reason}` }
  let res: Response
  try {
    res = await deps.fetch(XAI_SECRETS_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${key.value}`, 'content-type': 'application/json' },
      body: JSON.stringify({ expires_after: { seconds: TOKEN_SECONDS } }),
      signal: AbortSignal.timeout(15_000)
    })
  } catch (e) {
    return { ok: false, reason: 'unreachable', detail: `xAI did not answer: ${e instanceof Error ? e.name : String(e)}` }
  }
  if (!res.ok) return { ok: false, reason: 'refused', detail: `xAI refused the call: HTTP ${res.status}` }
  let body: { value?: unknown; expires_at?: unknown }
  try { body = (await res.json()) as typeof body } catch {
    // Not JSON: no secret to hand over.
    return { ok: false, reason: 'no-secret', detail: 'xAI answered without a secret' }
  }
  if (typeof body.value !== 'string' || !body.value) return { ok: false, reason: 'no-secret', detail: 'xAI answered without a secret' }
  const expiresAt = typeof body.expires_at === 'number' ? body.expires_at * 1000 : (deps.now ?? Date.now)() + TOKEN_SECONDS * 1000
  return { ok: true, value: body.value, expiresAt, url: XAI_REALTIME_URL, usdPerMinute: XAI_USD_PER_MINUTE }
}
/** xAI's text to speech: one short sample of a voice, so the person hears it before choosing (onboarding, Settings).
 *  USD 15 per million characters (docs.x.ai/developers/pricing, fetched 2026-11-19): a sample of about 90 characters is
 *  well under a cent, and each voice and language is fetched once, then kept on this computer. */
export const XAI_TTS_URL = 'https://api.x.ai/v1/tts'
export const XAI_BUILT_IN_VOICES = ['ara', 'eve', 'leo', 'rex', 'sal'] as const
/** The cache's version: a new sample text takes a new name, an old file is never played for the new words. */
const SAMPLE_VERSION = 1

export function sampleText(locale: string): string {
  return locale === 'en'
    ? 'Hello. I am the CEO of your Fabric. I watch your sessions and answer you by voice.'
    : 'Здравствуйте. Я CEO вашего Fabric. Слежу за сессиями и отвечаю вам голосом.'
}

export interface SampleDeps extends Omit<VoiceDeps, 'now'> {
  cache: { read(name: string): Buffer | null; write(name: string, bytes: Buffer): void }
}
export type VoiceSampleAnswer = { ok: true; data: string } | { ok: false; reason: CeoVoiceProblem | 'unknown-voice'; detail: string }

/** One sample of `voice` in `locale`, as base64 MP3: from the cache, else from xAI with the key held for this request. */
export async function voiceSample(deps: SampleDeps, voice: string, locale: string): Promise<VoiceSampleAnswer> {
  if (!(XAI_BUILT_IN_VOICES as readonly string[]).includes(voice)) return { ok: false, reason: 'unknown-voice', detail: 'not a built-in voice' }
  const lang = locale === 'en' ? 'en' : 'ru'
  const name = `${voice}-${lang}-v${SAMPLE_VERSION}.mp3`
  const kept = deps.cache.read(name)
  if (kept && kept.length > 0) return { ok: true, data: kept.toString('base64') }
  const own = deps.ownKey?.() ?? null
  const key = own ? { ok: true as const, value: own } : await deps.vault.read(XAI_KEY_SLOT)
  if (!key.ok) return { ok: false, reason: 'no-key', detail: `no xAI key: ${key.reason}` }
  let res: Response
  try {
    res = await deps.fetch(XAI_TTS_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${key.value}`, 'content-type': 'application/json' },
      body: JSON.stringify({ text: sampleText(lang), voice_id: voice, language: lang }),
      signal: AbortSignal.timeout(20_000)
    })
  } catch (e) {
    return { ok: false, reason: 'unreachable', detail: `xAI did not answer: ${e instanceof Error ? e.name : String(e)}` }
  }
  if (!res.ok) return { ok: false, reason: 'refused', detail: `xAI refused the sample: HTTP ${res.status}` }
  const bytes = Buffer.from(await res.arrayBuffer())
  if (bytes.length === 0) return { ok: false, reason: 'no-secret', detail: 'xAI answered without audio' }
  // A sample that cannot be kept is still played; it is fetched again next time.
  try { deps.cache.write(name, bytes) } catch { /* the cache is a saving, not a requirement */ }
  return { ok: true, data: bytes.toString('base64') }
}
// #endregion ceo-voice
