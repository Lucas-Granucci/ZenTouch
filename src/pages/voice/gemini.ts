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

export const defaultGeminiModel = 'gemini-2.5-flash'

function buildPrompt(transcript: string, items: readonly MenuItemSummary[], hasImage: boolean): string {
  const catalog = items
    .map((item) => `- id: "${item.id}" — ${item.name}${item.restaurantName ? ` (${item.restaurantName})` : ''}: ${item.description} (${item.price.toFixed(2)})`)
    .join('\n')
  const spansMultiple = new Set(items.map((item) => item.restaurantName)).size > 1
  return `You are helping a customer order at a touchless restaurant kiosk.${hasImage ? ' Attached is a photo of the on-screen menu.' : ''} The customer said: "${transcript}"

Menu items (id — name (restaurant): description (price))${spansMultiple ? ', spanning every open restaurant at this kiosk' : ''}:
${catalog}

Pick the single item id that best matches what the customer wants${spansMultiple ? ', considering items from any restaurant' : ''}.${hasImage ? ' Use the photo to confirm names and read anything not listed above.' : ''} If the request is about a quality rather than a specific dish (for example "the healthiest option", "something light", "the spiciest thing"), reason about which real item best fits using its name and description${hasImage ? ' and what you can see in the photo' : ''} — do not invent items or nutrition facts that aren't implied by the menu. If nothing on the menu reasonably matches, return null.

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

function extractText(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null || !('candidates' in data)) return undefined
  const candidates = (data as { candidates?: unknown }).candidates
  if (!Array.isArray(candidates)) return undefined
  const content = (candidates[0] as { content?: { parts?: { text?: unknown }[] } } | undefined)?.content
  const text = content?.parts?.[0]?.text
  return typeof text === 'string' ? text : undefined
}
