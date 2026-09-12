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
