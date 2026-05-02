import { useLocation } from 'react-router-dom'
import { useFloatingChat } from '../../context/FloatingChatContext'
import { FLOATING_OVERLAY_GUTTER } from '../../hooks/useFloatingPanel'
import { AiChatIcon } from './AiChatIcon'

export function FloatingNavbar() {
  const { pathname } = useLocation()
  const { isChatOpen, toggleChat } = useFloatingChat()
  const showChatInNavbar = pathname !== '/inspector'
  const inset = FLOATING_OVERLAY_GUTTER

  return (
    <nav
      className="pointer-events-auto absolute z-20"
      style={{ left: inset, right: inset, top: inset }}
    >
      <div className="flex h-12 w-full items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white/80 px-4 shadow-sm backdrop-blur-md">
        <span className="text-sm font-semibold tracking-wide text-neutral-900">
          Balrog
        </span>
        {showChatInNavbar ? (
          <button
            type="button"
            aria-label={isChatOpen ? 'Close chat' : 'Open chat'}
            aria-pressed={isChatOpen}
            title="Chat"
            onClick={toggleChat}
            className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/60 ${
              isChatOpen
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-transparent text-neutral-600 hover:border-neutral-200 hover:bg-neutral-100 hover:text-neutral-900'
            }`}
          >
            <AiChatIcon className="h-[18px] w-[18px]" />
          </button>
        ) : null}
      </div>
    </nav>
  )
}
