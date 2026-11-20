# The CEO's persona, voice and calls: designed, paused (2026-11-20)

**Status:** designed and partly built on branch `feat/ceo-persona`. **Paused** by the owner on 2026-11-21 at 00:30:
new features wait for the strategic plan (fabric-workspace session 2d03ce15). Nothing here ships without the strategist's
decision.

**Source:** the owner's words, `userData/ceo/inbox/2026-11-20-home-questions-ceo-persona-voice-brief.md`, points 3 to 6
(paraphrased per ADR-0096).

**Architect consulted 2026-11-20:**
- template content-brand 1.14.1: personas, the `character` persona;
- template listening 1.6.12 and the `alert-episodes` pattern: a fire;
- template product-bot 1.7.5: Telegram.

## 1. What the owner asked

- **A livelier home header:** the CEO's face, and analytics that are more than numbers.
- **A CEO with a personality.** It comments on his projects and raises the alarm in plain words when a project is on
  fire. It adapts to how he talks. It is designed as a separate harness workflow, its texts written through copywriting.
- **A configurable voice with more choices:**
  - the Morpheus voice made for the film, in English and Russian, if possible;
  - his own cloned voice, with what we can and cannot do;
  - rights metadata for a public product.
- **A backlog row «Настройка CEO»:** the CEO calls him by phone or by Telegram from its own account.

## 2. The persona on the home

Built and tested on `feat/ceo-persona`, not wired to the home.

**`apps/desktop/src/shared/ceoPersona.ts`** (pure functions, version `ceo-persona/1`):

- `projectHeat` scores each project's heat: each abandoned task counts 2, a review older than three days counts 1, and
  work in progress with no live agent counts 1. A heat of 3 or more is a fire.
- `stepEpisodes` opens a fire after two hot readings and closes it after two calm ones. An unread reading changes
  nothing.
- `ownerManner` reads language, how casual he is, whether he swears and how short he writes, from the owner's own
  messages only.
- `ceoLine` picks one line, in this order:
  1. a fire, naming its project;
  2. what waits for him;
  3. who is working;
  4. calm.
  
  An unread home says it cannot see. Strong words appear only when the owner uses them. The wording turns every ten
  minutes; the facts follow every reading.
- `statSentences` says what each number means today.

**`apps/desktop/src/renderer/src/launch/CeoHeader.tsx`** shows:
- the face (`FabricAvatar`);
- the line (a fire opens its project);
- four numbers, each with its sentence, opening in the same places as `HomeStats`.

Styles are in `launch.css` (`.ceo-head*`), on the app's tokens.

**Tests:** `apps/desktop/test/ceo-persona.test.mjs` (6) and `renderer/src/launch/CeoHeader.test.tsx` (3).

**Agreed with the home's session (8343a070):** it would place `<CeoHeader home={reading} …handlers />` where `HomeStats`
stands in `EstateHome.tsx`. Not done, because of the pause.

**Open:**
- The line banks were not checked with the owner's text checker, which the owner's rule requires for user-facing text.
- The owner's messages are not yet passed to the header (prop `ownerWords`).
- The persona as a harness workflow (one versioned character brief shared by the CEO console, the voice and the header)
  is designed here in outline only.

## 3. The voice: what exists and what is possible

Measured 2026-11-20 with Fabric's own xAI key (vault slot `fabric/prod/XAI_API_KEY`, value never shown).

| Option | State | Evidence |
|---|---|---|
| More built-in voices | **Possible now.** xAI has 28 voices, each with a gender; Fabric offers 5. | `GET https://api.x.ai/v1/tts/voices` answered 28: altair, ara, atlas, aurora, carina, castor, celeste, cosmo, eve, helios, helix, iris, kepler, leo, liora, lumen, luna, lux, naksh, orion, perseus, rex, rigel, sal, sirius, ursa, zagan, zenith. |
| The Morpheus voice in the call, as an xAI custom voice | **Blocked for the API.** `POST /v1/custom-voices` answered 403 «Custom voices are not enabled for this team»; API creation is for Enterprise teams. The console can create one, but xAI says custom voices work only in the United States, outside Illinois. | `GET /v1/custom-voices` answered `{"voices":[],"total_count":0,"cap":30}`. docs.x.ai `model-capabilities/audio/custom-voices`, fetched 2026-11-20. |
| The Morpheus voice through ElevenLabs, with xAI answering in text | **Not without a second pipeline.** A realtime session asked for text only (`output_modalities: ["text"]`) still produced audio. The words do arrive as `response.output_audio_transcript.delta`, so ElevenLabs could speak the transcript while xAI's own audio is muted. That costs both prices and adds delay. | Test session, 2026-11-20: events `response.output_audio.delta` ×4 and `response.output_audio_transcript.delta`; `session.updated` echoes no modality field. |
| The owner's own voice | **Three routes:** an xAI custom voice from a clip of up to 120 s (console only, US only; the API gives the same 403); ElevenLabs Instant Voice Cloning (1 to 2 minutes of audio), used through the ElevenLabs pipeline above; or ElevenLabs Professional Voice Cloning, which needs the speaker to verify himself in the browser. | elevenlabs.io/docs/product-guides/voices/voice-cloning, fetched 2026-11-20. |

**The Morpheus voice:**
- ElevenLabs voice «Morpheus PassionCode», id `9uunXOmNkquAVEyETfRg`. One voice serves English, Russian and eight more
  languages.
- **Designed from a description, not cloned.** Cloning the Russian dub of the actor was refused for lack of consent.
- Its record belongs to the PassionCode PM agent: `passioncode-pm-agent/config/persona.json`, decision PM-D62.
- The lines are in the story site's `story/comic/audio/vo/` (the media agent's `speech-line` jobs).
- The media agent holds the ElevenLabs key. Fabric would call its capability or get a key of its own, never use
  that agent's key.

**Rights metadata for the character voice.** Personal use is fine; this is for a public product.
- It is a synthetic voice made with ElevenLabs Voice Design, owned under the ElevenLabs account's terms, not a copy of
  an actor.
- Label it «AI-generated voice» wherever a platform asks.
- The name «Morpheus» and the character are a close homage to «The Matrix» (Warner Bros.). The risk is low for personal
  and internal use. In a public or paid product, a rights holder or a store's impersonation policy may object, so a
  public build should ship it under another name or not at all.

## 4. «Настройка CEO»: the CEO calls the owner (backlog, not started)

A Telegram bot cannot place voice calls, but a user account can (MTProto, with a calls library). So the CEO would need
its own Telegram user account, connected through the Telegram gateway agent or a client of its own.

**The human gate, exactly:** signing in to the CEO's own Telegram account. That needs:
1. a phone number for the account: a SIM or a virtual number (buying one is a payment, also the owner's);
2. the one-time login code Telegram sends to that number, or to a session already signed in;
3. the account's cloud password, if two-step verification is on.

No route avoids this gate: Telegram issues a user session only after the code. Once signed in, the agent keeps the
session in the vault and calls through it.

A phone call over the ordinary phone network would need a telephony provider's account and number. That is a payment
and a sign-in, so it is also the owner's.

## 5. Not started

The mobile app was ordered on 2026-11-21 at 00:05. The pause began before work on it, so it was not started.
