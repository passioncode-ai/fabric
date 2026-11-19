// #region ceo-voice-call — docs: docs/adr/0197-the-ceo-is-a-console-session-fabric-keeps-with-a-fallback-runner.md#the-voice-call
/**
 * The CEO popup's voice call (ADR-0197, the voice call, board task e7ff5556): xAI's realtime socket, opened with the ephemeral
 * secret main minted (`ceoAgent.voice`), never the key. The microphone is read at 24 kHz, sent as PCM16; the answer's
 * audio is played as it arrives and cut when the person speaks over it. A function call the model makes is run by
 * main (`ceoAgent.voiceTool`), with the gates the CEO's console has, and its answer is handed back before the model
 * speaks again. Pure of React; the socket and the audio are injected, so the protocol is tested without either.
 */
import type { CeoVoiceProblem, CeoVoiceSession } from '../../../shared/ceoAgent.ts'

export type CallPhase = 'idle' | 'connecting' | 'listening' | 'speaking' | 'ended' | 'failed'

/** Why a call failed, as a code the window words (0.3.24 review, ER-7): main's refusal, or the call's own. */
export type CallProblem = CeoVoiceProblem | 'unavailable' | 'microphone' | 'connection' | 'timeout'
/** Why a call that worked ended by itself: its length reached the cap, or nobody spoke for a while. */
export type CallEnd = 'limit' | 'idle'

/** How long the socket may take to open before the call fails (ER-4). */
export const CONNECT_DEADLINE_MS = 15_000
/** The longest call: xAI bills the open session and its secret does not bound the session's length (measured by the
 *  Dissy and PlaySing sessions, 2026-11-19), so the call bounds itself. */
export const MAX_CALL_MS = 30 * 60_000
/** A call nobody spoke in, and that is not answering or running a tool, for this long ends: silence is billed too. */
export const IDLE_CALL_MS = 3 * 60_000

export interface CallLine { who: 'person' | 'ceo' | 'tool'; text: string }

export interface SocketLike {
  readyState: number
  send(data: string): void
  close(): void
  onopen: ((ev: unknown) => void) | null
  onmessage: ((ev: { data: unknown }) => void) | null
  onerror: ((ev: unknown) => void) | null
  onclose: ((ev: unknown) => void) | null
}

/** Where the audio goes and comes from: the browser's in the popup, a recorder in the tests. */
export interface CallAudio {
  /** Start reading the microphone; each chunk is PCM16 at 24 kHz, base64. Resolves once it reads. */
  start(onChunk: (base64: string) => void): Promise<void>
  /** Play one chunk of PCM16 at 24 kHz, base64, after what is queued. */
  play(base64: string): void
  /** Cut what is playing and queued (the person spoke over it). */
  interrupt(): void
  stop(): void
}

export interface CallDeps {
  session(): Promise<CeoVoiceSession>
  runTool(name: string, args: unknown): Promise<Record<string, unknown>>
  socket(url: string, protocols: string[]): SocketLike
  audio: CallAudio
  onPhase(phase: CallPhase, problem?: CallProblem | CallEnd): void
  onLine(line: CallLine): void
  now?: () => number
}

/** The session the call opens with: the CEO's words and tools, server-side turn detection, PCM16 both ways. */
export function sessionUpdate(s: Extract<CeoVoiceSession, { ok: true }>): Record<string, unknown> {
  return {
    type: 'session.update',
    session: {
      instructions: s.instructions,
      voice: s.voice,
      turn_detection: { type: 'server_vad' },
      audio: {
        input: { format: { type: 'audio/pcm', rate: 24000 }, transcription: { model: 'grok-transcribe' } },
        output: { format: { type: 'audio/pcm', rate: 24000 } }
      },
      tools: s.tools
    }
  }
}

export function createCall(deps: CallDeps) {
  const now = deps.now ?? Date.now
  let ws: SocketLike | null = null
  let phase: CallPhase = 'idle'
  let startedAt = 0
  let usdPerMinute = 0
  let ceoLine = ''
  /** The person's words so far, as the cumulative transcript reports them; said once the answer starts. */
  let personLine = ''
  /** Function calls of the current response not answered yet; the next response waits for all of them. */
  const pending = new Set<string>()
  let respondAfterTools = false

  /** Each start and each hang-up is a new generation: an await that comes back to an older one stops there (ER-4). */
  let generation = 0
  let deadline: ReturnType<typeof setTimeout> | null = null
  let watch: ReturnType<typeof setInterval> | null = null
  let lastActivity = 0
  const touch = (): void => { lastActivity = now() }

  const set = (p: CallPhase, problem?: CallProblem | CallEnd): void => { phase = p; deps.onPhase(p, problem) }
  const send = (o: Record<string, unknown>): void => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)) }
  const clearDeadline = (): void => { if (deadline) { clearTimeout(deadline); deadline = null } }

  /** End the call: the microphone, the socket and the deadline; `failed` with its code, else `ended`. */
  function end(problem?: CallProblem, ended?: CallEnd): void {
    generation++
    clearDeadline()
    if (watch) { clearInterval(watch); watch = null }
    deps.audio.stop()
    const socket = ws
    ws = null
    if (socket) { try { socket.close() } catch { /* already closed: the call has ended either way */ } }
    if (problem) set('failed', problem)
    else if (phase !== 'failed') set('ended', ended)
  }

  async function start(): Promise<void> {
    if (phase === 'connecting' || phase === 'listening' || phase === 'speaking') return
    const gen = ++generation
    set('connecting')
    let s: CeoVoiceSession
    try { s = await deps.session() } catch { if (gen === generation) end('unavailable'); return }
    // Hung up while the secret was minted: no socket, no microphone.
    if (gen !== generation) return
    if (!s.ok) { end(s.reason); return }
    usdPerMinute = s.usdPerMinute
    const ready = s
    let socket: SocketLike
    try {
      socket = deps.socket(s.url, [`xai-client-secret.${s.token}`])
    } catch {
      end('connection')
      return
    }
    ws = socket
    deadline = setTimeout(() => { if (gen === generation && phase === 'connecting') end('timeout') }, CONNECT_DEADLINE_MS)
    socket.onopen = () => {
      if (gen !== generation) { try { socket.close() } catch { /* closing a call already ended */ } return }
      clearDeadline()
      send(sessionUpdate(ready))
      startedAt = now()
      touch()
      watch = setInterval(() => {
        if (gen !== generation) return
        if (now() - startedAt >= MAX_CALL_MS) end(undefined, 'limit')
        else if (phase === 'listening' && pending.size === 0 && now() - lastActivity >= IDLE_CALL_MS) end(undefined, 'idle')
      }, 1000)
      deps.audio.start((chunk) => { if (gen === generation) send({ type: 'input_audio_buffer.append', audio: chunk }) })
        .then(() => {
          // The microphone opened after the hang-up: it is closed again at once.
          if (gen !== generation) { deps.audio.stop(); return }
          if (phase === 'connecting') set('listening')
        })
        .catch(() => { if (gen === generation) end('microphone') })
    }
    socket.onerror = () => { if (gen === generation && phase !== 'ended') end('connection') }
    socket.onclose = () => { if (gen === generation) end() }
    socket.onmessage = (ev) => { if (gen === generation) void receive(typeof ev.data === 'string' ? ev.data : '') }
  }

  async function receive(raw: string): Promise<void> {
    let m: Record<string, unknown>
    try { m = JSON.parse(raw) as Record<string, unknown> } catch { return /* not an event: nothing to do */ }
    const type = String(m.type ?? '')
    switch (type) {
      case 'response.output_audio.delta':
      case 'response.audio.delta':
        if (typeof m.delta === 'string') { deps.audio.play(m.delta); if (phase !== 'speaking') set('speaking') }
        return
      case 'response.output_audio_transcript.delta':
      case 'response.audio_transcript.delta':
        if (typeof m.delta === 'string') ceoLine += m.delta
        return
      case 'response.output_audio_transcript.done':
      case 'response.audio_transcript.done':
      case 'response.done':
        if (ceoLine.trim()) deps.onLine({ who: 'ceo', text: ceoLine.trim() })
        ceoLine = ''
        if (type === 'response.done' && phase === 'speaking') set('listening')
        return
      case 'input_audio_buffer.speech_started':
        touch()
        deps.audio.interrupt()
        if (phase === 'speaking') set('listening')
        return
      case 'conversation.item.input_audio_transcription.updated':
        if (typeof m.transcript === 'string') personLine = m.transcript
        return
      case 'conversation.item.input_audio_transcription.completed':
        if (typeof m.transcript === 'string') personLine = m.transcript
        if (personLine.trim()) deps.onLine({ who: 'person', text: personLine.trim() })
        personLine = ''
        return
      case 'response.created':
        touch()
        if (personLine.trim()) deps.onLine({ who: 'person', text: personLine.trim() })
        personLine = ''
        return
      case 'response.function_call_arguments.done':
        await callTool(String(m.name ?? ''), String(m.call_id ?? ''), String(m.arguments ?? '{}'))
        return
      case 'error': {
        const e = m.error as { message?: unknown } | undefined
        deps.onLine({ who: 'tool', text: `xAI: ${typeof e?.message === 'string' ? e.message : 'error'}` })
        return
      }
      default:
    }
  }

  async function callTool(name: string, callId: string, argsText: string): Promise<void> {
    if (!callId) return
    touch()
    pending.add(callId)
    let args: unknown = {}
    try { args = JSON.parse(argsText || '{}') } catch { args = {} /* unreadable arguments: the tool refuses them by its own schema */ }
    deps.onLine({ who: 'tool', text: name })
    let result: Record<string, unknown>
    try { result = await deps.runTool(name, args) } catch (e) { result = { ok: false, reason: e instanceof Error ? e.message : String(e) } }
    send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: callId, output: JSON.stringify(result).slice(0, 60_000) } })
    pending.delete(callId)
    touch()
    respondAfterTools = true
    if (pending.size === 0 && respondAfterTools) { respondAfterTools = false; send({ type: 'response.create' }) }
  }

  /** Words typed instead of spoken: the same conversation, answered aloud. */
  function say(text: string): void {
    if (!text.trim()) return
    touch()
    deps.onLine({ who: 'person', text: text.trim() })
    send({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: text.trim() }] } })
    send({ type: 'response.create' })
  }

  function hangUp(): void { end() }

  return {
    start, say, hangUp, receive,
    phase: (): CallPhase => phase,
    /** Minutes on the call and their price at xAI's list rate. */
    spent: (): { minutes: number; usd: number } => {
      const minutes = startedAt ? (now() - startedAt) / 60_000 : 0
      return { minutes, usd: Math.round(minutes * usdPerMinute * 100) / 100 }
    }
  }
}

export type Call = ReturnType<typeof createCall>

/** PCM16 little-endian, base64, from float samples in [-1, 1]. */
export function floatToPcm16Base64(samples: Float32Array): string {
  const bytes = new Uint8Array(samples.length * 2)
  const view = new DataView(bytes.buffer)
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]!))
    view.setInt16(i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true)
  }
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

/** Float samples from PCM16 little-endian, base64. */
export function pcm16Base64ToFloat(b64: string): Float32Array {
  const bin = atob(b64)
  const out = new Float32Array(Math.floor(bin.length / 2))
  for (let i = 0; i < out.length; i++) {
    const lo = bin.charCodeAt(i * 2), hi = bin.charCodeAt(i * 2 + 1)
    let v = (hi << 8) | lo
    if (v >= 0x8000) v -= 0x10000
    out[i] = v / 0x8000
  }
  return out
}

/** The browser's audio: the microphone through a ScriptProcessor (no worklet module to load under the page's policy). */
export function browserAudio(): CallAudio {
  let ctx: AudioContext | null = null
  let stream: MediaStream | null = null
  let proc: ScriptProcessorNode | null = null
  let next = 0
  const playing = new Set<AudioBufferSourceNode>()
  const ensure = (): AudioContext => (ctx ??= new AudioContext({ sampleRate: 24000 }))
  return {
    async start(onChunk) {
      const c = ensure()
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      const src = c.createMediaStreamSource(stream)
      proc = c.createScriptProcessor(4096, 1, 1)
      proc.onaudioprocess = (ev) => onChunk(floatToPcm16Base64(ev.inputBuffer.getChannelData(0)))
      src.connect(proc)
      // A ScriptProcessor runs only while it is connected to the destination; it writes silence there.
      proc.connect(c.destination)
    },
    play(b64) {
      const c = ensure()
      const samples = pcm16Base64ToFloat(b64)
      if (!samples.length) return
      const buf = c.createBuffer(1, samples.length, 24000)
      buf.getChannelData(0).set(samples)
      const node = c.createBufferSource()
      node.buffer = buf
      node.connect(c.destination)
      next = Math.max(next, c.currentTime + 0.02)
      node.start(next)
      next += buf.duration
      playing.add(node)
      node.onended = () => playing.delete(node)
    },
    interrupt() {
      for (const n of playing) { try { n.stop() } catch { /* ended already */ } }
      playing.clear()
      next = 0
    },
    stop() {
      this.interrupt()
      proc?.disconnect()
      proc = null
      for (const t of stream?.getTracks() ?? []) t.stop()
      stream = null
      void ctx?.close().catch(() => undefined)
      ctx = null
    }
  }
}
// #endregion ceo-voice-call
