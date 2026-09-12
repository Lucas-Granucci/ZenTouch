import { useCallback, useRef, useState } from 'react'
import { TouchlessButton } from './TouchlessButton'
import { MENU_DATA } from '../../state/kiosk/menuData'
import { matchMenuItemWithGemini, defaultGeminiModel } from '../../pages/voice/gemini'
import type { MenuItemSummary } from '../../pages/voice/gemini'
import { createRecognizer } from '../../pages/voice/speechRecognition'
import type { SpeechRecognitionLike } from '../../pages/voice/speechRecognition'
import { useKioskState } from '../../state/kiosk/KioskStateProvider'
import { useInteractionContext } from '../../hooks/useInteraction'
import type { RestaurantId, Screen } from '../../state/kiosk/types'

type Status = 'idle' | 'listening' | 'thinking' | 'done' | 'error'

interface Candidate {
  readonly summary: MenuItemSummary
  /** The real, currently-registered touchless target this candidate resolves to. */
  readonly targetId: string
}

/** Only what's genuinely a real, currently-clickable card on screen right now —
 * voice can pick something the user could otherwise have pointed at and held,
 * never something merely present in the data but not actually rendered. */
function buildCandidates(screen: Screen, currentRestaurantId: RestaurantId | null, registered: ReadonlySet<string>): Candidate[] {
  const candidates: Candidate[] = []
  if (screen === 'menu' && currentRestaurantId) {
    const restaurant = MENU_DATA[currentRestaurantId]
    for (const item of restaurant.items) {
      const targetId = `menu-item-${item.id}`
      if (registered.has(targetId)) {
        candidates.push({ targetId, summary: { id: item.id, name: item.name, description: item.desc, price: item.price, restaurantName: restaurant.name } })
      }
    }
  } else if (screen === 'restaurants') {
    for (const restaurant of Object.values(MENU_DATA)) {
      if (!restaurant.open) continue
      for (const item of restaurant.items) {
        const targetId = `pick-${restaurant.id}-${item.id}`
        if (registered.has(targetId)) {
          candidates.push({ targetId, summary: { id: item.id, name: item.name, description: item.desc, price: item.price, restaurantName: restaurant.name } })
        }
      }
      const restaurantTargetId = `restaurant-${restaurant.id}`
      if (registered.has(restaurantTargetId)) {
        candidates.push({
          targetId: restaurantTargetId,
          summary: { id: `restaurant:${restaurant.id}`, name: restaurant.name, description: `${restaurant.tagline} — say this to open ${restaurant.name}'s menu`, price: 0 },
        })
      }
    }
  }
  return candidates
}

/** Global, always-available voice control: hold like any other touchless target to
 * start listening, say what you want, and — only when it clearly matches something
 * really selectable on the current screen — it fires the exact same activation a
 * real hold-to-select would, through the real interaction engine. No match, no click.
 */
export function VoiceOrderButton() {
  const { screen, currentRestaurantId } = useKioskState()
  const { input, activation } = useInteractionContext()
  const recognizerRef = useRef<SpeechRecognitionLike | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [transcript, setTranscript] = useState('')
  const [message, setMessage] = useState('')

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  const model = import.meta.env.VITE_GEMINI_MODEL || defaultGeminiModel

  const runMatch = useCallback(async (heard: string) => {
    const registered = new Set(input.targets.getSnapshot().filter((t) => t.enabled).map((t) => t.id))
    const candidates = buildCandidates(screen, currentRestaurantId, registered)
    if (candidates.length === 0) {
      setMessage("There's nothing to select by voice on this screen — try the restaurants or menu screen.")
      setStatus('done')
      return
    }
    if (!apiKey) { setMessage('Voice ordering needs VITE_GEMINI_API_KEY set in .env.local.'); setStatus('error'); return }
    setStatus('thinking')
    try {
      const result = await matchMenuItemWithGemini({ apiKey, model, transcript: heard, items: candidates.map((c) => c.summary) })
      const match = result.itemId ? candidates.find((c) => c.summary.id === result.itemId) : undefined
      if (match && activation) {
        setMessage(result.reason || `Selecting ${match.summary.name}.`)
        activation.click(match.targetId)
      } else {
        setMessage(result.reason || "I didn't catch a clear choice there — nothing selected.")
      }
      setStatus('done')
    } catch (failure) {
      setMessage(failure instanceof Error ? failure.message : String(failure))
      setStatus('error')
    }
  }, [apiKey, model, screen, currentRestaurantId, input, activation])

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
    recognizer.onerror = (event) => { setMessage(`Speech recognition error: ${event.error}`); setStatus('error') }
    recognizer.onend = () => setStatus((current) => (current === 'listening' ? 'idle' : current))
    recognizer.start()
  }, [runMatch])

  const busy = status === 'listening' || status === 'thinking'

  return (
    <div className="pointer-events-none fixed inset-x-0 top-5 z-50 flex flex-col items-center gap-2.5">
      <div className="pointer-events-auto rounded-full bg-paper/95 p-2 shadow-[0_10px_24px_rgba(32,28,26,.2)] backdrop-blur-sm">
        <TouchlessButton id="global-voice-order" variant="circle" tone="brand" disabled={busy} onActivate={startListening} aria-label="Order by voice">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
            <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </TouchlessButton>
      </div>
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
