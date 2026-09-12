import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react'
import { initialKioskState, kioskReducer } from './reducer'
import type { KioskAction, KioskState } from './types'

const KioskStateContext = createContext<KioskState | null>(null)
const KioskDispatchContext = createContext<Dispatch<KioskAction> | null>(null)

export function KioskStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(kioskReducer, initialKioskState)
  return (
    <KioskStateContext.Provider value={state}>
      <KioskDispatchContext.Provider value={dispatch}>{children}</KioskDispatchContext.Provider>
    </KioskStateContext.Provider>
  )
}

export function useKioskState(): KioskState {
  const state = useContext(KioskStateContext)
  if (!state) throw new Error('useKioskState must be used within KioskStateProvider')
  return state
}

export function useKioskDispatch(): Dispatch<KioskAction> {
  const dispatch = useContext(KioskDispatchContext)
  if (!dispatch) throw new Error('useKioskDispatch must be used within KioskStateProvider')
  return dispatch
}
