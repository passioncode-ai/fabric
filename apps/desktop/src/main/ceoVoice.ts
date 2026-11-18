// #region ceo-voice — docs: docs/adr/0197-the-ceo-is-a-console-session-fabric-keeps-with-a-fallback-runner.md#the-voice-call
/**
 * The voice call's main-process half (ADR-0197 §4, board task e7ff5556): the xAI key never leaves this process. It is
 * read from Project Observatory's vault for one call (`observatoryVault.ts`, slot `fabric/prod/XAI_API_KEY`) and spent
 * on an ephemeral client secret (`POST /v1/realtime/client_secrets`, five minutes); the CEO window opens the realtime
 * socket with that secret alone. The call's instructions and tools are composed here, so the window holds no prompt
 * of its own, and every tool the call asks for runs here through the CEO's operations (`ceoTools.ts`) with their gates.
 */
import type { VaultPort } from './observatoryVault.ts'

export const XAI_KEY_SLOT = { project: 'fabric', env: 'prod' as const, name: 'XAI_API_KEY' }
export const XAI_SECRETS_URL = 'https://api.x.ai/v1/realtime/client_secrets'
export const XAI_REALTIME_URL = 'wss://api.x.ai/v1/realtime?model=grok-voice-latest'
/** xAI's list price for a realtime minute (2026-11-18), shown beside the call's length. */
export const XAI_USD_PER_MINUTE = 0.08
const TOKEN_SECONDS = 300

export interface VoiceToken { ok: true; value: string; expiresAt: number; url: string; usdPerMinute: number }
export type VoiceTokenAnswer = VoiceToken | { ok: false; reason: string }

/** The call's instructions: who speaks, in which language, and which tools it has. */
export function voiceInstructions(locale: string): string {
  return locale === 'en'
    ? 'You are the voice of Fabric\'s CEO agent on the owner\'s computer. Speak English, briefly. You can list, read, type into, start, stop, continue and open the coding sessions of this computer with your tools, and hand a longer request to the CEO console with ask_ceo. Before stopping a session, read it and say why. Never write an em dash in what you say.'
    : 'Ты голос CEO-агента Fabric на компьютере владельца. Говори по-русски, коротко. Своими инструментами ты видишь, читаешь, вводишь текст, запускаешь, останавливаешь, продолжаешь и открываешь сессии разработки этого компьютера, а длинную просьбу передаешь CEO в консоль инструментом ask_ceo. Прежде чем остановить сессию, прочитай ее и скажи почему. Никогда не ставь длинное тире.'
}

/** The tool that hands a request to the CEO's console, beside the session tools. */
export const ASK_CEO_TOOL = {
  type: 'function' as const,
  name: 'ask_ceo',
  description: 'Hand a request to the CEO agent\'s console in words: anything that needs planning, several steps or other tools than the session ones. The CEO answers in its console.',
  parameters: { type: 'object', properties: { text: { type: 'string', description: 'The request, in the owner\'s words.' } }, required: ['text'], additionalProperties: false }
}

export interface VoiceDeps {
  vault: Pick<VaultPort, 'read'>
  fetch: typeof fetch
  now?: () => number
}

/** One ephemeral secret for one call; the key itself is held for this request only. */
export async function mintVoiceToken(deps: VoiceDeps): Promise<VoiceTokenAnswer> {
  const key = await deps.vault.read(XAI_KEY_SLOT)
  if (!key.ok) return { ok: false, reason: `the xAI key could not be read from Observatory: ${key.reason}` }
  let res: Response
  try {
    res = await deps.fetch(XAI_SECRETS_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${key.value}`, 'content-type': 'application/json' },
      body: JSON.stringify({ expires_after: { seconds: TOKEN_SECONDS } }),
      signal: AbortSignal.timeout(15_000)
    })
  } catch (e) {
    return { ok: false, reason: `xAI did not answer: ${e instanceof Error ? e.message : String(e)}` }
  }
  if (!res.ok) return { ok: false, reason: `xAI refused the call: HTTP ${res.status}` }
  let body: { value?: unknown; expires_at?: unknown }
  try { body = (await res.json()) as typeof body } catch {
    // Not JSON: no secret to hand over.
    return { ok: false, reason: 'xAI answered without a secret' }
  }
  if (typeof body.value !== 'string' || !body.value) return { ok: false, reason: 'xAI answered without a secret' }
  const expiresAt = typeof body.expires_at === 'number' ? body.expires_at * 1000 : (deps.now ?? Date.now)() + TOKEN_SECONDS * 1000
  return { ok: true, value: body.value, expiresAt, url: XAI_REALTIME_URL, usdPerMinute: XAI_USD_PER_MINUTE }
}
// #endregion ceo-voice
