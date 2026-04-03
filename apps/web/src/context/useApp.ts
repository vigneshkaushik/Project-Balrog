import { useContext } from 'react'
import { AppContext, type AppState } from './appStateContext'

export function useApp(): AppState {
  const ctx = useContext(AppContext)
  if (!ctx) {
    throw new Error('useApp must be used within AppProvider')
  }
  return ctx
}
