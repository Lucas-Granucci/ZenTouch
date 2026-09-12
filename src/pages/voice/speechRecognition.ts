export interface SpeechRecognitionLike extends EventTarget {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  onresult: ((event: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

/** Web Speech API isn't in the DOM lib types and is still webkit-prefixed in some browsers. */
export function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function createRecognizer(): SpeechRecognitionLike | null {
  const Recognizer = getSpeechRecognitionConstructor()
  if (!Recognizer) return null
  const recognizer = new Recognizer()
  recognizer.lang = 'en-US'
  recognizer.interimResults = false
  recognizer.maxAlternatives = 1
  return recognizer
}

/** "no-speech" (the mic timed out hearing nothing) and "aborted" (a deliberate
 * .stop() call) are expected, routine outcomes, not failures — callers should
 * recover quietly rather than surface them as errors. */
export function isBenignSpeechError(error: string): boolean {
  return error === 'no-speech' || error === 'aborted'
}
