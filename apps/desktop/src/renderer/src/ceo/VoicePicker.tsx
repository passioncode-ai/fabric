// #region ceo-voice-picker — docs: docs/ux/scenarios.md#scn-186-choose-the-ceos-voice
/**
 * The CEO's voice (SCN-186, the owner 2026-11-19: «по умолчанию мужской, в настройках выбор мужской/женский, в
 * зависимости от выбранного персонажа»): male or female, the character deciding which xAI voice that is
 * (`persona.ts#xaiVoiceOf`). «Послушать» plays one short sample of that voice, fetched once and kept by main; a window
 * with no xAI key shows the choice without the sample. The sample is decoded by Web Audio, so no page policy changes.
 */
import { useEffect, useRef, useState } from 'react'
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
  const [hearing, setHearing] = useState<Hearing>(null)
  const playing = useRef<{ ctx: AudioContext; node: AudioBufferSourceNode } | null>(null)

  const silence = (): void => {
    const p = playing.current
    playing.current = null
    if (!p) return
    try { p.node.stop() } catch { /* already ended */ }
    void p.ctx.close().catch(() => undefined)
  }
  useEffect(() => silence, [])

  const listen = async (voice: VoiceGender): Promise<void> => {
    silence()
    setHearing({ voice, state: 'loading' })
    try {
      const r = await window.fabric.ceoAgent.voiceSample(xaiVoiceOf({ style, voice }))
      if (!r.ok) { setHearing({ voice, state: 'failed', reason: r.reason }); return }
      const bytes = Uint8Array.from(atob(r.data), (c) => c.charCodeAt(0))
      const ctx = new AudioContext()
      const buffer = await ctx.decodeAudioData(bytes.buffer)
      const node = ctx.createBufferSource()
      node.buffer = buffer
      node.connect(ctx.destination)
      node.onended = () => { if (playing.current?.node === node) { silence(); setHearing(null) } }
      playing.current = { ctx, node }
      node.start()
      setHearing({ voice, state: 'playing' })
    } catch {
      setHearing({ voice, state: 'failed', reason: 'unavailable' })
    }
  }

  return (
    <div className="ceo-voice-picker">
      <div className="ceo-voice-options" role="radiogroup" aria-labelledby={labelledBy} aria-label={labelledBy ? undefined : t('ceoAgent.voice.label')}>
        {VOICE_GENDERS.map((g) => {
          const busy = hearing?.voice === g && hearing.state !== 'failed'
          return (
            <div key={g} className="ceo-voice-option" data-chosen={chosen === g}>
              <button type="button" role="radio" aria-checked={chosen === g} className="ceo-voice-choice" onClick={() => onChange(g)}>
                <span className="ceo-voice-dot" aria-hidden="true" />
                <span className="ceo-voice-name">{t(`ceoAgent.voice.${g}` as 'ceoAgent.voice.male')}</span>
                <small>{t(`ceoAgent.voice.tone.${xaiVoiceOf({ style, voice: g })}` as 'ceoAgent.voice.tone.rex')}</small>
              </button>
              {canSample && (
                <button type="button" className="ceo-voice-listen" aria-label={t('ceoAgent.voice.listenTo', { voice: t(`ceoAgent.voice.${g}` as 'ceoAgent.voice.male') })}
                  disabled={hearing?.voice === g && hearing.state === 'loading'}
                  onClick={() => (busy && hearing?.state === 'playing' ? (silence(), setHearing(null)) : void listen(g))}>
                  <span className={`ceo-voice-listen-icon ${busy && hearing?.state === 'playing' ? 'is-playing' : ''}`} aria-hidden="true" />
                  {t(hearing?.voice === g && hearing.state === 'loading' ? 'ceoAgent.voice.loading' : busy && hearing?.state === 'playing' ? 'ceoAgent.voice.stopListening' : 'ceoAgent.voice.listen')}
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
