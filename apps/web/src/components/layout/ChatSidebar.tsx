import { useCallback, useId, useState } from 'react'
import type { ChatMessage } from '../../types'

function UploadIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="size-5"
      aria-hidden
    >
      <title>Upload</title>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
      />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="size-5"
      aria-hidden
    >
      <title>Send</title>
      <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
    </svg>
  )
}

export function ChatSidebar() {
  const labelId = useId()
  const inputId = useId()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')

  const send = useCallback(() => {
    const text = draft.trim()
    if (!text) return
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: 'user',
        text,
        at: Date.now(),
      },
    ])
    setDraft('')
  }, [draft])

  return (
    <aside
      className="flex h-full min-h-0 w-full flex-col border-l border-neutral-200 bg-white"
      aria-labelledby={labelId}
    >
      <div className="shrink-0 border-b border-neutral-100 px-4 py-3">
        <h2 id={labelId} className="text-sm font-semibold text-neutral-900">
          Claude Opus
        </h2>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-3 py-2">
        {messages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-2 text-center text-sm text-neutral-400">
            Get started by uploading a model!
          </div>
        ) : (
          <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto py-2">
            {messages.map((m) => (
              <li
                key={m.id}
                className={`rounded-lg px-3 py-2 text-sm ${
                  m.role === 'user'
                    ? 'ml-6 bg-primary/10 text-neutral-900'
                    : 'mr-6 bg-neutral-100 text-neutral-800'
                }`}
              >
                {m.text}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="shrink-0 border-t border-neutral-100 p-3">
        <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-2 py-2 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/20">
          <label htmlFor={inputId} className="sr-only">
            Message
          </label>
          <textarea
            id={inputId}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder="Write a message here..."
            className="max-h-32 min-h-10 w-full resize-none bg-transparent text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
          />
          <div className="flex shrink-0 items-center justify-between gap-2">
            <button
              type="button"
              className="cursor-pointer rounded p-1 text-neutral-500 hover:bg-neutral-200/60 hover:text-neutral-700"
              aria-label="Upload attachment"
            >
              <UploadIcon />
            </button>
            <button
              type="button"
              onClick={send}
              className="cursor-pointer rounded-lg p-2 text-primary hover:bg-primary/15"
              aria-label="Send message"
            >
              <SendIcon />
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
