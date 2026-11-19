// ADR-0197 §4: the voice call's protocol, with the socket and the audio replaced: the session the call opens with, the
// microphone's chunks, the answer's audio, a function call answered before the model speaks again, and the hang-up.
import { describe, expect, it, vi } from 'vitest'
import { CONNECT_DEADLINE_MS, IDLE_CALL_MS, MAX_CALL_MS, createCall, floatToPcm16Base64, pcm16Base64ToFloat, sessionUpdate, type CallAudio, type SocketLike } from './voiceCall'

function fakeSocket(): SocketLike & { sent: Record<string, unknown>[]; url?: string; protocols?: string[] } {
  return { readyState: 1, sent: [], send(d: string) { this.sent.push(JSON.parse(d)) }, close: vi.fn(), onopen: null, onmessage: null, onerror: null, onclose: null }
}
function fakeAudio(): CallAudio & { chunk?: (b: string) => void; played: string[]; cut: number; stopped: number } {
  const a = { played: [] as string[], cut: 0, stopped: 0, chunk: undefined as undefined | ((b: string) => void),
    async start(on: (b: string) => void) { a.chunk = on }, play(b: string) { a.played.push(b) }, interrupt() { a.cut++ }, stop() { a.stopped++ } }
  return a
}
const session = { ok: true as const, token: 'eph', expiresAt: 1, url: 'wss://api.x.ai/v1/realtime?model=grok-voice-latest', usdPerMinute: 0.08, instructions: 'Ты голос CEO', voice: 'eve', tools: [{ type: 'function', name: 'session_sessions' }] }

describe('the CEO voice call', () => {
  it('opens with the ephemeral secret as its subprotocol, then the CEO\'s session; the microphone streams', async () => {
    const ws = fakeSocket(), audio = fakeAudio(), phases: string[] = []
    const call = createCall({ session: async () => session, runTool: vi.fn(), socket: (url, protocols) => Object.assign(ws, { url, protocols }), audio, onPhase: (p) => phases.push(p), onLine: () => {} })
    await call.start()
    expect(ws.protocols).toEqual(['xai-client-secret.eph'])
    ws.onopen?.({})
    await Promise.resolve()
    expect(ws.sent[0]).toEqual(sessionUpdate(session))
    expect((ws.sent[0].session as { turn_detection: unknown }).turn_detection).toEqual({ type: 'server_vad' })
    audio.chunk?.('AAAA')
    expect(ws.sent[1]).toEqual({ type: 'input_audio_buffer.append', audio: 'AAAA' })
    await Promise.resolve()
    expect(phases).toEqual(['connecting', 'listening'])
  })

  it('plays the answer, cuts it when the person speaks over it, and says each side\'s words', async () => {
    const ws = fakeSocket(), audio = fakeAudio(), lines: unknown[] = []
    const call = createCall({ session: async () => session, runTool: vi.fn(), socket: () => ws, audio, onPhase: () => {}, onLine: (l) => lines.push(l) })
    await call.start(); ws.onopen?.({})
    await call.receive(JSON.stringify({ type: 'response.output_audio.delta', delta: 'PCM' }))
    expect(audio.played).toEqual(['PCM'])
    expect(call.phase()).toBe('speaking')
    await call.receive(JSON.stringify({ type: 'response.output_audio_transcript.delta', delta: 'Идут две ' }))
    await call.receive(JSON.stringify({ type: 'response.output_audio_transcript.delta', delta: 'сессии' }))
    await call.receive(JSON.stringify({ type: 'input_audio_buffer.speech_started' }))
    expect(audio.cut).toBe(1)
    await call.receive(JSON.stringify({ type: 'response.done' }))
    await call.receive(JSON.stringify({ type: 'conversation.item.input_audio_transcription.completed', transcript: 'покажи сессии' }))
    expect(lines).toEqual([{ who: 'ceo', text: 'Идут две сессии' }, { who: 'person', text: 'покажи сессии' }])
  })

  it('a function call runs in main and its answer goes back before the model speaks again', async () => {
    const ws = fakeSocket(), runTool = vi.fn(async () => ({ ok: true, fabric_consoles: [] }))
    const call = createCall({ session: async () => session, runTool, socket: () => ws, audio: fakeAudio(), onPhase: () => {}, onLine: () => {} })
    await call.start(); ws.onopen?.({})
    ws.sent.length = 0
    await call.receive(JSON.stringify({ type: 'response.function_call_arguments.done', name: 'session_sessions', call_id: 'c1', arguments: '{"include_ended":false}' }))
    expect(runTool).toHaveBeenCalledWith('session_sessions', { include_ended: false })
    expect(ws.sent).toEqual([
      { type: 'conversation.item.create', item: { type: 'function_call_output', call_id: 'c1', output: JSON.stringify({ ok: true, fabric_consoles: [] }) } },
      { type: 'response.create' }
    ])
    // A tool that throws is answered as a refusal, never left unanswered.
    ws.sent.length = 0
    const failing = createCall({ session: async () => session, runTool: async () => { throw new Error('boom') }, socket: () => ws, audio: fakeAudio(), onPhase: () => {}, onLine: () => {} })
    await failing.start(); ws.onopen?.({}); ws.sent.length = 0
    await failing.receive(JSON.stringify({ type: 'response.function_call_arguments.done', name: 'x', call_id: 'c2', arguments: 'not json' }))
    expect(JSON.parse((ws.sent[0].item as { output: string }).output)).toEqual({ ok: false, reason: 'boom' })
  })

  it('a refused session says why and opens no socket; hanging up stops the microphone and the socket', async () => {
    const socket = vi.fn(), phases: Array<[string, string | undefined]> = []
    const refused = createCall({ session: async () => ({ ok: false, reason: 'no-key' }), runTool: vi.fn(), socket, audio: fakeAudio(), onPhase: (p, w) => phases.push([p, w]), onLine: () => {} })
    await refused.start()
    expect(socket).not.toHaveBeenCalled()
    expect(phases.at(-1)).toEqual(['failed', 'no-key'])
    const ws = fakeSocket(), audio = fakeAudio()
    const call = createCall({ session: async () => session, runTool: vi.fn(), socket: () => ws, audio, onPhase: () => {}, onLine: () => {} })
    await call.start(); ws.onopen?.({})
    call.say('покажи сессии')
    expect(ws.sent.slice(-2)).toEqual([
      { type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'покажи сессии' }] } },
      { type: 'response.create' }
    ])
    call.hangUp()
    expect(ws.close).toHaveBeenCalled()
    expect(audio.stopped).toBeGreaterThan(0)
    expect(call.phase()).toBe('ended')
  })

  it('ER-4: hanging up while the secret is minted opens no socket and no microphone', async () => {
    let answer: (s: typeof session) => void = () => {}
    const socket = vi.fn(), audio = fakeAudio(), phases: string[] = []
    const call = createCall({ session: () => new Promise((r) => { answer = r }), runTool: vi.fn(), socket, audio, onPhase: (p) => phases.push(p), onLine: () => {} })
    const started = call.start()
    call.hangUp()
    answer(session)
    await started
    expect(socket).not.toHaveBeenCalled()
    expect(audio.chunk).toBeUndefined()
    expect(call.phase()).toBe('ended')
    expect(phases.at(-1)).toBe('ended')
  })

  it('ER-4: hanging up before the socket opens closes it and never starts the microphone', async () => {
    const ws = fakeSocket(), audio = fakeAudio()
    const call = createCall({ session: async () => session, runTool: vi.fn(), socket: () => ws, audio, onPhase: () => {}, onLine: () => {} })
    await call.start()
    call.hangUp()
    ws.onopen?.({})
    await Promise.resolve()
    expect(audio.chunk).toBeUndefined()
    expect(ws.sent).toEqual([])
    expect(call.phase()).toBe('ended')
  })

  it('ER-4: a microphone that opens after the hang-up is stopped at once', async () => {
    const ws = fakeSocket(), audio = fakeAudio()
    let opened: () => void = () => {}
    audio.start = (on) => new Promise<void>((r) => { audio.chunk = on; opened = r })
    const call = createCall({ session: async () => session, runTool: vi.fn(), socket: () => ws, audio, onPhase: () => {}, onLine: () => {} })
    await call.start(); ws.onopen?.({})
    const stoppedBefore = audio.stopped
    call.hangUp()
    opened()
    await Promise.resolve(); await Promise.resolve()
    expect(audio.stopped).toBe(stoppedBefore + 2) // the hang-up, then the microphone that opened after it
    expect(call.phase()).toBe('ended')
  })

  it('ER-4: a socket that never opens fails the call at its deadline', async () => {
    vi.useFakeTimers()
    try {
      const ws = fakeSocket(), phases: Array<[string, string | undefined]> = []
      const call = createCall({ session: async () => session, runTool: vi.fn(), socket: () => ws, audio: fakeAudio(), onPhase: (p, w) => phases.push([p, w]), onLine: () => {} })
      await call.start()
      vi.advanceTimersByTime(CONNECT_DEADLINE_MS + 1)
      expect(phases.at(-1)).toEqual(['failed', 'timeout'])
      expect(ws.close).toHaveBeenCalled()
    } finally { vi.useRealTimers() }
  })

  it('a call ends by itself after silence, but not while a tool runs, and at its length cap whatever is said', async () => {
    vi.useFakeTimers()
    try {
      let clock = 0
      const ws = fakeSocket(), audio = fakeAudio(), phases: Array<[string, string | undefined]> = []
      let release: (v: Record<string, unknown>) => void = () => {}
      const runTool = vi.fn(() => new Promise<Record<string, unknown>>((r) => { release = r }))
      const call = createCall({ session: async () => session, runTool, socket: () => ws, audio, onPhase: (p, w) => phases.push([p, w]), onLine: () => {}, now: () => clock })
      await call.start(); ws.onopen?.({}); await Promise.resolve(); await Promise.resolve()
      // A tool that runs past the silence keeps the call.
      void call.receive(JSON.stringify({ type: 'response.function_call_arguments.done', name: 'session_sessions', call_id: 'c1', arguments: '{}' }))
      clock += IDLE_CALL_MS + 5_000; vi.advanceTimersByTime(2_000)
      expect(call.phase()).not.toBe('ended')
      release({ ok: true }); await Promise.resolve(); await Promise.resolve()
      clock += IDLE_CALL_MS + 1_000; vi.advanceTimersByTime(2_000)
      expect(phases.at(-1)).toEqual(['ended', 'idle'])
      expect(audio.stopped).toBeGreaterThan(0)
      // The cap: a second call that keeps talking ends at MAX_CALL_MS.
      const ws2 = fakeSocket(), phases2: Array<[string, string | undefined]> = []
      const c2 = createCall({ session: async () => session, runTool: vi.fn(), socket: () => ws2, audio: fakeAudio(), onPhase: (p, w) => phases2.push([p, w]), onLine: () => {}, now: () => clock })
      await c2.start(); ws2.onopen?.({}); await Promise.resolve(); await Promise.resolve()
      for (let t = 0; t < MAX_CALL_MS; t += 60_000) { clock += 60_000; void c2.receive(JSON.stringify({ type: 'input_audio_buffer.speech_started' })); vi.advanceTimersByTime(1_000) }
      expect(phases2.at(-1)).toEqual(['ended', 'limit'])
    } finally { vi.useRealTimers() }
  })

  it('ER-7: a failure is a code the window words', async () => {
    const ws = fakeSocket(), phases: Array<[string, string | undefined]> = []
    const call = createCall({ session: async () => session, runTool: vi.fn(), socket: () => ws, audio: fakeAudio(), onPhase: (p, w) => phases.push([p, w]), onLine: () => {} })
    await call.start()
    ws.onerror?.({})
    expect(phases.at(-1)).toEqual(['failed', 'connection'])
  })

  it('PCM16 both ways', () => {
    const back = pcm16Base64ToFloat(floatToPcm16Base64(new Float32Array([0, 0.5, -0.5, 1, -1])))
    expect(Array.from(back).map((v) => Math.round(v * 100) / 100)).toEqual([0, 0.5, -0.5, 1, -1])
  })
})
