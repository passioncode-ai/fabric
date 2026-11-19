// #region ceo-voice-picker — docs: docs/ux/scenarios.md#scn-186-choose-the-ceos-voice
/**
 * The CEO's voice (SCN-186, the owner 2026-11-19: «по умолчанию мужской, в настройках выбор мужской/женский, в
 * зависимости от выбранного персонажа»): male or female, the character deciding which xAI voice that is
 * (`persona.ts#xaiVoiceOf`). «Послушать» plays one short sample of that voice, fetched once and kept by main; a window
 * with no xAI key shows the choice without the sample. The sample is decoded by Web Audio, so no page policy changes.
 */
import { useEffect, useId, useRef, useState } from 'react'
import { VOICE_GENDERS, voiceGenderOf, xaiVoiceOf, type PersonaStyle, type VoiceGender } from '../../../shared/persona.ts'
import { useT } from '../i18n'

type Hearing = { voice: VoiceGender; state: 'loading' | 'playing' } | { voice: VoiceGender; state: 'failed'; reason: string } | null

/** Whether this computer can call the CEO: the person's xAI key or Observatory's. Null while it is asked. */
export function useVoiceReady(): boolean | null {
  const [ready, setReady] = useState<boolean | null>(null)
  useEffect(() => {
    let live = true
    const ask = window.fabric.ceoAgent?.voiceReady
    if (!ask) { setReady(false); return }
    ask().then((r) => { if (live) setReady(r.ready) }, () => { if (live) setReady(false) })
    return () => { live = false }
  }, [])
  return ready
}

export function VoicePicker({ style, value, onChange, canSample, labelledBy }: {
  style: PersonaStyle
  value: VoiceGender | undefined
  onChange(next: VoiceGender): void
  /** A sample needs an xAI key; without one the choice is still kept for the first call. */
  canSample: boolean
  labelledBy?: string
}): React.JSX.Element {
  const t = useT()
  const chosen = voiceGenderOf({ voice: value })
  const name = useId()
  const [hearing, setHearing] = useState<Hearing>(null)
  const playing = useRef<{ ctx: AudioContext; node: AudioBufferSourceNode } | null>(null)
  /** Each listen is a generation: a sample that arrives for an older one, or after unmount, is closed unplayed (ER-5). */
  const generation = useRef(0)

  const silence = (): void => {
    const p = playing.current
    playing.current = null
    if (!p) return
    try { p.node.stop() } catch { /* already ended */ }
    void p.ctx.close().catch(() => undefined)
  }
  useEffect(() => () => { generation.current++; silence() }, [])

  const listen = async (voice: VoiceGender): Promise<void> => {
    silence()
    const gen = ++generation.current
    setHearing({ voice, state: 'loading' })
    let ctx: AudioContext | null = null
    try {
      const r = await window.fabric.ceoAgent.voiceSample(xaiVoiceOf({ style, voice }))
      if (gen !== generation.current) return
      if (!r.ok) { setHearing({ voice, state: 'failed', reason: r.reason }); return }
      const bytes = Uint8Array.from(atob(r.data), (c) => c.charCodeAt(0))
      ctx = new AudioContext()
      const buffer = await ctx.decodeAudioData(bytes.buffer)
      if (gen !== generation.current) { void ctx.close().catch(() => undefined); return }
      const node = ctx.createBufferSource()
      node.buffer = buffer
      node.connect(ctx.destination)
      node.onended = () => { if (playing.current?.node === node) { silence(); setHearing(null) } }
      playing.current = { ctx, node }
      node.start()
      setHearing({ voice, state: 'playing' })
    } catch {
      // ER-4 (0.3.25): a sample that does not decode or start closes its context.
      if (ctx && playing.current?.ctx !== ctx) void ctx.close().catch(() => undefined)
      if (gen === generation.current) setHearing({ voice, state: 'failed', reason: 'unavailable' })
    }
  }

  const voiceName = (g: VoiceGender): string => t(`ceoAgent.voice.${g}` as 'ceoAgent.voice.male')
  return (
    <div className="ceo-voice-picker">
      <div className="ceo-voice-options" role="radiogroup" aria-labelledby={labelledBy} aria-label={labelledBy ? undefined : t('ceoAgent.voice.label')}>
        {VOICE_GENDERS.map((g) => {
          const loading = hearing?.voice === g && hearing.state === 'loading'
          const isPlaying = hearing?.voice === g && hearing.state === 'playing'
          const word = loading ? 'ceoAgent.voice.loading' : isPlaying ? 'ceoAgent.voice.stopListening' : 'ceoAgent.voice.listen'
          return (
            <div key={g} className="ceo-voice-option" data-chosen={chosen === g}>
              {/* Native radios (UX-3, 0.3.25): one tab stop, arrow keys move the choice. */}
              <label className="ceo-voice-choice">
                <input type="radio" name={name} value={g} checked={chosen === g} onChange={() => onChange(g)} />
                <span className="ceo-voice-name">{voiceName(g)}</span>
                <small>{t(`ceoAgent.voice.tone.${xaiVoiceOf({ style, voice: g })}` as 'ceoAgent.voice.tone.rex')}</small>
              </label>
              {canSample && (
                <button type="button" className="ceo-voice-listen" disabled={loading}
                  aria-label={`${t(word)}: ${voiceName(g)}`}
                  onClick={() => (isPlaying ? (generation.current++, silence(), setHearing(null)) : void listen(g))}>
                  <span className={`ceo-voice-listen-icon ${isPlaying ? 'is-playing' : ''}`} aria-hidden="true" />
                  {t(word)}
                </button>
              )}
            </div>
          )
        })}
      </div>
      {hearing?.state === 'failed' && <p className="field-problem" role="status">{t(`ceoAgent.voice.sampleFailed.${hearing.reason === 'no-key' || hearing.reason === 'refused' ? hearing.reason : 'other'}` as 'ceoAgent.voice.sampleFailed.other')}</p>}
      <small className="ceo-voice-hint">{t(canSample ? 'ceoAgent.voice.hint' : 'ceoAgent.voice.hintNoKey')}</small>
    </div>
  )
}
// #endregion ceo-voice-picker
