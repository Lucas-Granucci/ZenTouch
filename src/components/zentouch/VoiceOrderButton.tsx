import { useCallback, useRef, useState } from 'react'
import { TouchlessButton } from './TouchlessButton'
import { MENU_DATA, findItem, formatMoney } from '../../state/kiosk/menuData'
import { matchOptionWithGemini, defaultGeminiModel } from '../../pages/voice/gemini'
import type { SelectableOption } from '../../pages/voice/gemini'
import { createRecognizer, isBenignSpeechError } from '../../pages/voice/speechRecognition'
import type { SpeechRecognitionLike } from '../../pages/voice/speechRecognition'
import { useKioskState } from '../../state/kiosk/KioskStateProvider'
import { useInteractionContext } from '../../hooks/useInteraction'
import type { RestaurantId, ItemId, Screen } from '../../state/kiosk/types'

type Status = 'idle' | 'listening' | 'thinking' | 'done' | 'error'

interface Candidate extends SelectableOption {
  /** The real, currently-registered touchless target this candidate resolves to. */
  readonly targetId: string
}

/** Only what's genuinely a real, currently-clickable card on screen right now —
 * voice can pick something the user could otherwise have pointed at and held,
 * never something merely present in the data but not actually rendered. Covers
 * every screen: each one's own set of real target ids, filtered to whichever
 * are actually registered and enabled at the moment of the request. */
function buildCandidates(
  screen: Screen,
  currentRestaurantId: RestaurantId | null,
  currentItemId: ItemId | null,
  registered: ReadonlySet<string>,
): Candidate[] {
  const has = (id: string) => registered.has(id)

  if (screen === 'welcome') {
    return has('welcome-begin') ? [{ targetId: 'welcome-begin', label: 'Begin order' }] : []
  }

  if (screen === 'restaurants') {
    const candidates: Candidate[] = []
    for (const restaurant of Object.values(MENU_DATA)) {
      if (!restaurant.open) continue
      for (const item of restaurant.items) {
        const targetId = `pick-${restaurant.id}-${item.id}`
        if (has(targetId)) candidates.push({ targetId, label: `${item.name} (${restaurant.name})`, description: item.desc })
      }
      const targetId = `restaurant-${restaurant.id}`
      if (has(targetId)) candidates.push({ targetId, label: `${restaurant.name} menu`, description: restaurant.tagline })
    }
    return candidates
  }

  if (screen === 'menu' && currentRestaurantId) {
    const restaurant = MENU_DATA[currentRestaurantId]
    return restaurant.items
      .map((item) => ({ targetId: `menu-item-${item.id}`, label: item.name, description: item.desc }))
      .filter((c) => has(c.targetId))
  }

  if (screen === 'item' && currentRestaurantId && currentItemId) {
    const item = findItem(currentRestaurantId, currentItemId)
    if (!item) return []
    const candidates: Candidate[] = item.sides
      .map((side) => ({ targetId: `side-${side.name}`, label: side.name, description: side.add > 0 ? `adds ${formatMoney(side.add)}` : 'included' }))
      .filter((c) => has(c.targetId))
    if (has('add-to-cart')) candidates.push({ targetId: 'add-to-cart', label: 'Add to cart' })
    return candidates
  }

  if (screen === 'cart') {
    const candidates: Candidate[] = []
    if (has('place-order')) candidates.push({ targetId: 'place-order', label: 'Place order' })
    if (has('add-more')) candidates.push({ targetId: 'add-more', label: 'Add more items' })
    if (has('browse-restaurants')) candidates.push({ targetId: 'browse-restaurants', label: 'Browse restaurants' })
    return candidates
  }

  if (screen === 'confirmation') {
    return has('done') ? [{ targetId: 'done', label: 'Done' }] : []
  }

  return []
}

/** Global, always-available voice control: hold like any other touchless target to
 * start listening, say what you want, and — only when it clearly matches something
 * really selectable on the current screen — it fires the exact same activation a
 * real hold-to-select would, through the real interaction engine. No match, no click.
 */
export function VoiceOrderButton() {
  const { screen, currentRestaurantId, currentItemId } = useKioskState()
  const { input, activation } = useInteractionContext()
  const recognizerRef = useRef<SpeechRecognitionLike | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [transcript, setTranscript] = useState('')
  const [message, setMessage] = useState('')
  const [showTyped, setShowTyped] = useState(false)
  const [typed, setTyped] = useState('')

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  const model = import.meta.env.VITE_GEMINI_MODEL || defaultGeminiModel

  const runMatch = useCallback(async (heard: string) => {
    const registered = new Set(input.targets.getSnapshot().filter((t) => t.enabled).map((t) => t.id))
    const candidates = buildCandidates(screen, currentRestaurantId, currentItemId, registered)
    if (candidates.length === 0) {
      setMessage("There's nothing to select by voice on this screen.")
      setStatus('done')
      return
    }
    if (!apiKey) { setMessage('Voice ordering needs VITE_GEMINI_API_KEY set in .env.local.'); setStatus('error'); return }
    setStatus('thinking')
    try {
      const { index } = await matchOptionWithGemini({ apiKey, model, transcript: heard, options: candidates })
      const match = index !== null ? candidates[index] : undefined
      if (match && activation) {
        setMessage(`Selecting ${match.label}.`)
        activation.click(match.targetId)
      } else {
        setMessage("Didn't catch a clear choice — nothing selected.")
      }
      setStatus('done')
    } catch (failure) {
      setMessage(failure instanceof Error ? failure.message : String(failure))
      setStatus('error')
    }
  }, [apiKey, model, screen, currentRestaurantId, currentItemId, input, activation])

  const startListening = useCallback(() => {
    const recognizer = createRecognizer()
    if (!recognizer) { setMessage('Speech recognition is not supported in this browser. Try Chrome or Edge.'); setStatus('error'); return }
    recognizerRef.current = recognizer
    setTranscript(''); setMessage('')
    setStatus('listening')
    recognizer.onresult = (event) => {
      const heard = event.results[0]?.[0]?.transcript ?? ''
      setTranscript(heard)
      if (heard) void runMatch(heard)
    }
    recognizer.onerror = (event) => {
      // No speech heard, or a deliberate stop — routine, not a failure. Recover quietly.
      if (isBenignSpeechError(event.error)) { setStatus('idle'); return }
      setMessage(`Speech recognition error: ${event.error}`)
      setStatus('error')
    }
    recognizer.onend = () => setStatus((current) => (current === 'listening' ? 'idle' : current))
    recognizer.start()
  }, [runMatch])

  const submitTyped = useCallback(() => {
    const heard = typed.trim()
    if (!heard) return
    setTranscript(heard)
    setTyped('')
    void runMatch(heard)
  }, [typed, runMatch])

  const busy = status === 'listening' || status === 'thinking'

  return (
    <div className="pointer-events-none fixed inset-x-0 top-5 z-50 flex flex-col items-center gap-2.5">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-paper/95 p-2 shadow-[0_10px_24px_rgba(32,28,26,.2)] backdrop-blur-sm">
        <TouchlessButton id="global-voice-order" variant="circle" tone="brand" disabled={busy} onActivate={startListening} aria-label="Order by voice">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
            <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </TouchlessButton>
        {/* Dev convenience only — types straight into the same match pipeline, bypassing the mic. */}
        <button
          type="button"
          onClick={() => setShowTyped((v) => !v)}
          aria-label="Type a voice command instead of speaking"
          aria-pressed={showTyped}
          className={`flex h-[50px] w-[50px] items-center justify-center rounded-full border border-line text-ink transition-colors ${showTyped ? 'bg-surface' : 'bg-paper'}`}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
            <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
            <path d="M6.5 10h.01M9.5 10h.01M12.5 10h.01M15.5 10h.01M17.5 10h.01M7.5 14h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {showTyped && (
        <form
          className="pointer-events-auto flex items-center gap-2 rounded-full border border-line bg-paper py-1.5 pl-4 pr-1.5 shadow-[0_10px_22px_rgba(32,28,26,.15)]"
          onSubmit={(event) => { event.preventDefault(); submitTyped() }}
        >
          <input
            type="text"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder='Type a voice command, e.g. "the burger"'
            className="w-72 bg-transparent text-[14px] text-ink outline-none placeholder:text-muted"
          />
          <button type="submit" className="rounded-full bg-brand px-4 py-2 text-[13px] font-semibold text-white">Send</button>
        </form>
      )}

      {(status !== 'idle' || message) && (
        <div className="pointer-events-none max-w-[420px] rounded-[10px] border border-line bg-paper px-4 py-2.5 text-center shadow-[0_10px_22px_rgba(32,28,26,.15)]">
          <div className="text-[12px] font-bold uppercase tracking-widest text-muted">
            {status === 'listening' && 'Listening…'}
            {status === 'thinking' && 'Finding it…'}
            {(status === 'done' || status === 'error') && (transcript ? `You said "${transcript}"` : 'Voice order')}
          </div>
          {message && <div className={`mt-0.5 text-[13.5px] font-medium ${status === 'error' ? 'text-interact' : 'text-ink'}`}>{message}</div>}
        </div>
      )}
    </div>
  )
}
