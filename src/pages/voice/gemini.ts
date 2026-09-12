export interface MenuItemSummary {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly price: number
  /** Which restaurant this item belongs to, when the menu spans more than one. */
  readonly restaurantName?: string
}

export interface VoiceMatchResult {
  /** Null when nothing on the menu matches, or the request is unclear. */
  readonly itemId: string | null
  /** One short sentence explaining the pick, meant to be shown back to the customer. */
  readonly reason: string
}

// gemini-2.5-flash was retired for new API keys (confirmed via a live 404 pointing
// here); VITE_GEMINI_MODEL still overrides this without a code change if it moves again.
export const defaultGeminiModel = 'gemini-3.6-flash'

function buildPrompt(transcript: string, items: readonly MenuItemSummary[], hasImage: boolean): string {
  const catalog = items
    .map((item) => `- id: "${item.id}" — ${item.name}${item.restaurantName ? ` (${item.restaurantName})` : ''}: ${item.description} (${item.price.toFixed(2)})`)
    .join('\n')
  const spansMultiple = new Set(items.map((item) => item.restaurantName)).size > 1
  return `You are helping a customer order at a touchless restaurant kiosk.${hasImage ? ' Attached is a photo of the on-screen menu.' : ''} The customer said: "${transcript}"

Menu items (id — name (restaurant): description (price))${spansMultiple ? ', spanning every open restaurant at this kiosk' : ''}:
${catalog}

Pick the single item id that best matches what the customer wants${spansMultiple ? ', considering items from any restaurant' : ''}.${hasImage ? ' Use the photo to confirm names and read anything not listed above.' : ''} If the request is about a quality rather than a specific dish (for example "the healthiest option", "something light", "the spiciest thing"), reason about which real item best fits using its name and description${hasImage ? ' and what you can see in the photo' : ''} — do not invent items or nutrition facts that aren't implied by the menu.

Only return an item id when the customer's request clearly and specifically identifies one of the items above — by name, category, or an unambiguous quality judgment you can defend from its name/description. If the request is vague, off-topic, small talk, only partially heard, or you are not genuinely confident which single item they mean, return null rather than guessing. Never pick "the closest thing" out of politeness.

Respond with strict JSON only, no markdown fences, matching exactly this shape:
{"itemId": "<one of the ids above, or null>", "reason": "<one short sentence, spoken directly to the customer, explaining the pick>"}`
}

/** Throws on network/HTTP failure or a response that doesn't parse as the expected shape.
 * Never trusts the model's itemId without checking it against the real menu. */
export async function matchMenuItemWithGemini(options: {
  readonly apiKey: string
  readonly model?: string
  readonly transcript: string
  readonly items: readonly MenuItemSummary[]
  /** "data:image/png;base64,...." from canvas.toDataURL(). Omit for a text-only match
   * (e.g. when there's no on-screen menu to photograph, such as a global voice control
   * activated from a screen that isn't showing the menu). */
  readonly imageDataUrl?: string
}): Promise<VoiceMatchResult> {
  const { apiKey, model = defaultGeminiModel, transcript, items, imageDataUrl } = options
  const base64 = imageDataUrl ? imageDataUrl.slice(imageDataUrl.indexOf(',') + 1) : null
  if (imageDataUrl && !base64) throw new Error('Empty menu screenshot; nothing to send to Gemini')

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: buildPrompt(transcript, items, !!base64) },
          ...(base64 ? [{ inlineData: { mimeType: 'image/png', data: base64 } }] : []),
        ],
      }],
      generationConfig: { responseMimeType: 'application/json' },
    }),
  })
  if (!response.ok) throw new Error(`Gemini request failed (${response.status}): ${await response.text()}`)

  const data: unknown = await response.json()
  const text = extractText(data)
  if (typeof text !== 'string' || !text) throw new Error('Gemini returned no text')

  let parsed: unknown
  try { parsed = JSON.parse(text) }
  catch { throw new Error(`Gemini response was not valid JSON: ${text}`) }
  if (typeof parsed !== 'object' || parsed === null || !('itemId' in parsed) || !('reason' in parsed)) {
    throw new Error(`Gemini response missing expected fields: ${text}`)
  }
  const { itemId, reason } = parsed as { itemId: unknown; reason: unknown }
  return {
    itemId: typeof itemId === 'string' && items.some((item) => item.id === itemId) ? itemId : null,
    reason: typeof reason === 'string' ? reason : '',
  }
}

export interface SelectableOption {
  readonly label: string
  readonly description?: string
}

function buildOptionPrompt(transcript: string, options: readonly SelectableOption[]): string {
  const list = options.map((option, i) => `${i + 1}. ${option.label}${option.description ? ` — ${option.description}` : ''}`).join('\n')
  return `A customer at a touchless kiosk said: "${transcript}"

On-screen buttons:
${list}

Reply with ONLY the number of the single button that clearly matches what they said. If it's unclear, off-topic, small talk, or doesn't clearly match exactly one button, reply with the word none. No explanation, no punctuation, nothing else — just the number or the word none.`
}

/** Much leaner than matchMenuItemWithGemini: no image, no JSON, no reasoning
 * sentence — just a numbered pick against whatever's really on screen right now.
 *
 * By default 2.5 Flash's "thinking" pass can silently burn the entire output
 * budget on hidden reasoning before ever emitting the answer (confirmed: at
 * maxOutputTokens: 12 with unbounded thinking, it hit MAX_TOKENS with nothing
 * visible at all). Fully disabling it (thinkingBudget: 0) fixes that and is
 * fast (~600ms), but measurably hurts accuracy on anything needing even a
 * hair of reasoning — e.g. it failed to connect "add it to my cart" to an
 * "Add to cart" option it otherwise matches instantly once thinking is
 * allowed at all. A small fixed budget (50) is the sweet spot: same ~650ms
 * (vs. 1.3s+ for the default unbounded budget) with correct matches restored,
 * since the model only needs a handful of thinking tokens for this task, not
 * an open-ended budget. maxOutputTokens leaves headroom beyond that budget so
 * the visible one-token answer always has room after thinking. */
export async function matchOptionWithGemini(params: {
  readonly apiKey: string
  readonly model?: string
  readonly transcript: string
  readonly options: readonly SelectableOption[]
}): Promise<{ readonly index: number | null }> {
  const { apiKey, model = defaultGeminiModel, transcript, options } = params
  if (options.length === 0) return { index: null }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildOptionPrompt(transcript, options) }] }],
      generationConfig: { maxOutputTokens: 80, temperature: 0, thinkingConfig: { thinkingBudget: 50 } },
    }),
  })
  if (!response.ok) throw new Error(`Gemini request failed (${response.status}): ${await response.text()}`)

  const data: unknown = await response.json()
  const text = extractText(data)
  if (typeof text !== 'string') throw new Error('Gemini returned no text')
  const match = text.trim().match(/\d+/)
  const n = match ? parseInt(match[0], 10) : NaN
  return { index: Number.isInteger(n) && n >= 1 && n <= options.length ? n - 1 : null }
}

function extractText(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null || !('candidates' in data)) return undefined
  const candidates = (data as { candidates?: unknown }).candidates
  if (!Array.isArray(candidates)) return undefined
  const content = (candidates[0] as { content?: { parts?: { text?: unknown }[] } } | undefined)?.content
  const text = content?.parts?.[0]?.text
  return typeof text === 'string' ? text : undefined
}
