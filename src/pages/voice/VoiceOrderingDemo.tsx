import { useCallback, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import { MENU_DATA, formatMoney } from '../../state/kiosk/menuData'
import { matchMenuItemWithGemini, defaultGeminiModel } from './gemini'
import type { MenuItemSummary } from './gemini'
import { createRecognizer, isBenignSpeechError } from './speechRecognition'
import type { SpeechRecognitionLike } from './speechRecognition'

type Status = 'idle' | 'listening' | 'thinking' | 'done' | 'error'

/** Voice-ordering prototype: push-to-talk speech-to-text, a screenshot of the
 * rendered menu, and Gemini picking a real item id from both. Deliberately
 * standalone — no touchless engine, no cart wiring — this is a spike to prove
 * the concept before it earns a place in the real ordering flow.
 */
export function VoiceOrderingDemo() {
  const restaurants = Object.values(MENU_DATA).filter((restaurant) => restaurant.open && restaurant.items.length > 0)
  const menuRef = useRef<HTMLDivElement>(null)
  const recognizerRef = useRef<SpeechRecognitionLike | null>(null)

  const [listening, setListening] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [transcript, setTranscript] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  const model = import.meta.env.VITE_GEMINI_MODEL || defaultGeminiModel

  const runMatch = useCallback(async (heard: string) => {
    if (!apiKey) { setError('Set VITE_GEMINI_API_KEY in .env.local, then restart the dev server.'); setStatus('error'); return }
    if (!menuRef.current) return
    setStatus('thinking')
    setError('')
    try {
      const canvas = await html2canvas(menuRef.current, { backgroundColor: '#ffffff', scale: 1 })
      const imageDataUrl = canvas.toDataURL('image/png')
      const items: MenuItemSummary[] = restaurants.flatMap((restaurant) =>
        restaurant.items.map((item) => ({
          id: item.id, name: item.name, description: item.desc, price: item.price, restaurantName: restaurant.name,
        })))
      const result = await matchMenuItemWithGemini({ apiKey, model, transcript: heard, items, imageDataUrl })
      setSelectedId(result.itemId)
      setReason(result.reason || (result.itemId ? '' : "Couldn't find a match on this menu."))
      setStatus('done')
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
      setStatus('error')
    }
  }, [apiKey, model, restaurants])

  const startListening = useCallback(() => {
    const recognizer = createRecognizer()
    if (!recognizer) { setError('Speech recognition is not supported in this browser. Try Chrome or Edge.'); setStatus('error'); return }
    recognizerRef.current = recognizer
    setTranscript(''); setSelectedId(null); setReason(''); setError('')
    setStatus('listening'); setListening(true)
    recognizer.onresult = (event) => {
      const heard = event.results[0]?.[0]?.transcript ?? ''
      setTranscript(heard)
      if (heard) void runMatch(heard)
    }
    recognizer.onerror = (event) => {
      if (isBenignSpeechError(event.error)) { setStatus('idle'); setListening(false); return }
      setError(`Speech recognition error: ${event.error}`); setStatus('error'); setListening(false)
    }
    recognizer.onend = () => setListening(false)
    recognizer.start()
  }, [runMatch])

  const stopListening = useCallback(() => {
    recognizerRef.current?.stop()
    setListening(false)
  }, [])

  return (
    <main className="mx-auto min-h-dvh max-w-[1000px] p-8">
      <header className="mb-7">
        <a href="?" className="text-[13px] font-semibold text-muted">← ZenTouch</a>
        <h1 className="mt-1 font-display text-[32px] font-semibold">Voice ordering (prototype)</h1>
        <p className="mt-1.5 max-w-[62ch] text-[15px] font-medium leading-relaxed text-muted">
          Press the mic and say what you want — "I want a burger" or "the healthiest option." Gemini
          reads a screenshot of the full menu below, across every open restaurant, together with what
          you said, and picks a real item.
        </p>
      </header>

      <div className="mb-7 flex items-center gap-5">
        <button
          type="button"
          onClick={listening ? stopListening : startListening}
          aria-label={listening ? 'Stop listening' : 'Start listening'}
          className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-full text-white shadow-[0_10px_20px_rgba(32,28,26,.22)] transition-transform duration-150 ${
            listening ? 'scale-105 bg-interact' : 'bg-brand'
          }`}
        >
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden="true">
            <rect x="9" y="2" width="6" height="12" rx="3" fill="white" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v4" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <div>
          <div className="text-[13px] font-bold uppercase tracking-widest text-muted">
            {status === 'idle' && 'Press the mic to start'}
            {status === 'listening' && 'Listening…'}
            {status === 'thinking' && 'Reading the menu…'}
            {status === 'done' && 'Done'}
            {status === 'error' && 'Something went wrong'}
          </div>
          {transcript && <div className="mt-0.5 text-lg font-semibold">&ldquo;{transcript}&rdquo;</div>}
        </div>
      </div>

      {error && <p role="alert" className="mb-5 rounded-[10px] border border-line bg-paper p-4 text-[14px] font-medium text-interact">{error}</p>}
      {reason && <p role="status" className="mb-5 rounded-[10px] bg-brand-tint p-4 text-[14px] font-medium text-ink">{reason}</p>}

      <div ref={menuRef} className="bg-paper p-1">
        {restaurants.map((restaurant) => (
          <section key={restaurant.id} className="mb-6 last:mb-0">
            <h2 className="mb-3 text-[13px] font-bold uppercase tracking-widest text-muted">{restaurant.name}</h2>
            <div className="grid grid-cols-2 gap-4">
              {restaurant.items.map((item) => (
                <div
                  key={item.id}
                  className={`overflow-hidden rounded-[10px] border-2 bg-paper transition-shadow ${
                    selectedId === item.id ? 'border-brand shadow-[0_0_0_4px_rgba(31,77,58,.15)]' : 'border-line'
                  }`}
                >
                  <div className="aspect-[4/3] bg-surface">
                    <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="p-3.5">
                    <h3 className="text-[15px] font-semibold">{item.name}</h3>
                    <p className="mt-0.5 text-[13px] font-medium text-muted">{item.desc}</p>
                    <div className="mt-1.5 text-[13.5px] font-bold tabular-nums">{formatMoney(item.price)}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}
