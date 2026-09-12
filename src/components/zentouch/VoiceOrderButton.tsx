import { useCallback, useRef, useState } from 'react'
import { TouchlessButton } from './TouchlessButton'
import { MENU_DATA } from '../../state/kiosk/menuData'
import { matchMenuItemWithGemini, defaultGeminiModel } from '../../pages/voice/gemini'
import type { MenuItemSummary } from '../../pages/voice/gemini'
import { createRecognizer } from '../../pages/voice/speechRecognition'
import type { SpeechRecognitionLike } from '../../pages/voice/speechRecognition'
import { useKioskDispatch } from '../../state/kiosk/KioskStateProvider'
import type { RestaurantId } from '../../state/kiosk/types'

type Status = 'idle' | 'listening' | 'thinking' | 'done' | 'error'

const CATALOG: readonly (MenuItemSummary & { restaurantId: RestaurantId })[] = Object.values(MENU_DATA)
  .filter((restaurant) => restaurant.open && restaurant.items.length > 0)
  .flatMap((restaurant) =>
    restaurant.items.map((item) => ({
      id: item.id, name: item.name, description: item.desc, price: item.price,
      restaurantName: restaurant.name, restaurantId: restaurant.id,
    })))

/** Global, always-available voice control: hold like any other touchless target to
 * start listening, say what you want, and it jumps straight to that item's
 * customization screen (skipping restaurant → menu browsing) via a text-only Gemini
 * match against the full catalog — there's no reliable "menu photo" to send here
 * since this can activate from any screen, not just the menu.
 */
export function VoiceOrderButton() {
  const dispatch = useKioskDispatch()
  const recognizerRef = useRef<SpeechRecognitionLike | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [transcript, setTranscript] = useState('')
  const [message, setMessage] = useState('')

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  const model = import.meta.env.VITE_GEMINI_MODEL || defaultGeminiModel

  const runMatch = useCallback(async (heard: string) => {
    if (!apiKey) { setMessage('Voice ordering needs VITE_GEMINI_API_KEY set in .env.local.'); setStatus('error'); return }
    setStatus('thinking')
    try {
      const result = await matchMenuItemWithGemini({ apiKey, model, transcript: heard, items: CATALOG })
      const match = result.itemId ? CATALOG.find((item) => item.id === result.itemId) : undefined
      if (match) {
        setMessage(result.reason || `Here's the ${match.name}.`)
        dispatch({ type: 'OPEN_ITEM', restaurantId: match.restaurantId, itemId: match.id })
      } else {
        setMessage(result.reason || "Couldn't find anything matching that on today's menu.")
      }
      setStatus('done')
    } catch (failure) {
      setMessage(failure instanceof Error ? failure.message : String(failure))
      setStatus('error')
    }
  }, [apiKey, model, dispatch])

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
    <div className="pointer-events-none fixed inset-x-0 top-6 z-50 flex flex-col items-center gap-3">
      <div className="pointer-events-auto">
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
