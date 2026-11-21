// #region canvas-designer — docs: docs/adr/0201-the-canvas-is-an-excalidraw-window-a-designer-draws-on.md#decision
/**
 * The canvas's designer (ADR-0201 §5): one model call that turns an idea said in the CEO's call into a diagram (nodes,
 * links, groups) and a tour through it. Kimi K3.1 Pro on OpenRouter, the owner's model map's planning model, with
 * Fabric's own key read from Observatory's vault for this call only; at most `MAX_TOKENS` out and `DEADLINE_MS`. The
 * answer is checked by the same rule as the call's own diagrams (`shared/canvas.ts#parseDiagram`); anything else is a
 * refusal in words, and nothing is drawn. A function, not a session: it keeps nothing and runs nothing afterwards.
 */
import type { VaultPort } from './observatoryVault.ts'
import { parseDiagram, type Diagram, type ElementSummary } from '../shared/canvas.ts'

export const DESIGNER_KEY_SLOT = { project: 'fabric', env: 'prod' as const, name: 'OPENROUTER_API_KEY' }
export const DESIGNER_URL = 'https://openrouter.ai/api/v1/chat/completions'
/** The model map's planning model (wiki `synthesis/llm-models.md`, the owner's map of 2026-11-06); listed by OpenRouter's
 *  models API on 2026-11-19. */
export const DESIGNER_MODEL = 'moonshotai/kimi-k3.1-pro'
export const MAX_TOKENS = 2500
export const DEADLINE_MS = 60_000

export type DesignAnswer =
  | { ok: true; diagram: Diagram; usage: { promptTokens: number; completionTokens: number; costUsd: number | null } }
  | { ok: false; reason: 'no-key' | 'unreachable' | 'refused' | 'unreadable'; detail: string }

export interface DesignerDeps {
  vault: Pick<VaultPort, 'read'>
  fetch: typeof fetch
}

/** What the designer is told: the shape to answer, how to think about a board, and what the canvas holds already. */
export function designerPrompt(idea: string, existing: readonly ElementSummary[], locale: string): Array<{ role: 'system' | 'user'; content: string }> {
  const lang = locale === 'en' ? 'English' : 'Russian'
  const system = [
    'You are the designer of a canvas, a board like an investigator\'s wall. The owner said an idea aloud; draw it as a clear scheme.',
    'Answer ONE JSON object and nothing else:',
    '{"title": string, "nodes": [{"id": string, "text": string, "kind": "box"|"note"|"ellipse"|"diamond"|"text", "group"?: string}], "edges": [{"from": string, "to": string, "label"?: string}], "tour": [{"node": string, "say": string}]}',
    'Rules: 4 to 14 nodes; ids short, letters, digits, - or _; each text at most 8 words; "note" for a remark or an open question, "diamond" for a decision, "ellipse" for a start or an end, "box" otherwise;',
    'links follow the flow left to right (cause to effect, step to step), with a label only where it adds meaning; a group names nodes that belong together (2 to 4 groups at most);',
    `the tour visits 3 to 6 nodes in the order to explain them, each "say" one short spoken sentence; write every text in ${lang}; never an em dash.`
  ].join('\n')
  const holds = existing.length
    ? `The canvas already holds (do not redraw these; you may link to them by their name): ${existing.slice(0, 40).map((e) => `${e.name}: ${e.text}`).join('; ')}`
    : 'The canvas is empty.'
  return [{ role: 'system', content: system }, { role: 'user', content: `${holds}\n\nThe idea: ${idea}` }]
}

/** The JSON object in a model's answer: the whole answer, or the one fenced block in it. */
export function jsonOf(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text)
  const body = (fenced ? fenced[1]! : text).trim()
  const start = body.indexOf('{'), end = body.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try { return JSON.parse(body.slice(start, end + 1)) } catch { return null /* not JSON: the caller says unreadable */ }
}

export async function designDiagram(idea: string, existing: readonly ElementSummary[], locale: string, deps: DesignerDeps): Promise<DesignAnswer> {
  const key = await deps.vault.read(DESIGNER_KEY_SLOT)
  if (!key.ok) return { ok: false, reason: 'no-key', detail: `Fabric's OpenRouter key could not be read: ${key.reason}` }
  let res: Response
  try {
    res = await deps.fetch(DESIGNER_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${key.value}`, 'content-type': 'application/json', 'x-title': 'Fabric canvas designer' },
      body: JSON.stringify({
        model: DESIGNER_MODEL,
        messages: designerPrompt(idea, existing, locale),
        max_tokens: MAX_TOKENS,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        usage: { include: true }
      }),
      signal: AbortSignal.timeout(DEADLINE_MS)
    })
  } catch (e) {
    return { ok: false, reason: 'unreachable', detail: `OpenRouter did not answer: ${e instanceof Error ? e.name : String(e)}` }
  }
  if (!res.ok) return { ok: false, reason: 'refused', detail: `OpenRouter refused the designer: HTTP ${res.status}` }
  let body: { choices?: Array<{ message?: { content?: unknown } }>; usage?: { prompt_tokens?: unknown; completion_tokens?: unknown; cost?: unknown } }
  try { body = (await res.json()) as typeof body } catch {
    // Not JSON at all: the designer said nothing usable.
    return { ok: false, reason: 'unreadable', detail: 'OpenRouter answered without JSON' }
  }
  const content = body.choices?.[0]?.message?.content
  const parsed = parseDiagram(typeof content === 'string' ? jsonOf(content) : null)
  if (!parsed.ok) return { ok: false, reason: 'unreadable', detail: `the designer's diagram was not usable: ${parsed.reason}` }
  const u = body.usage ?? {}
  return {
    ok: true,
    diagram: parsed.value,
    usage: {
      promptTokens: Number(u.prompt_tokens) || 0,
      completionTokens: Number(u.completion_tokens) || 0,
      costUsd: typeof u.cost === 'number' ? u.cost : null
    }
  }
}
// #endregion canvas-designer
