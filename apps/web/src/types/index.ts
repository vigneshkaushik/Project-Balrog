export interface Clash {
  id: string
  label: string
  severity: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  at: number
}
