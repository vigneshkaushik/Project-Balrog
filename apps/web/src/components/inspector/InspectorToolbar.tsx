import type { ReactNode } from 'react'

import { useFloatingChat } from '../../context/FloatingChatContext'
import { AiChatIcon } from '../layout/AiChatIcon'
import { AiIdeaIcon } from './AiIdeaIcon'

export type InspectorPanelId =
	| 'clash-controls'
	| 'clash-context'
	| 'clash-recommendations'

interface InspectorToolbarProps {
	openPanels: ReadonlySet<InspectorPanelId>
	onTogglePanel: (panelId: InspectorPanelId) => void
}

interface ToolbarButtonDef {
	id: InspectorPanelId
	label: string
	icon: ReactNode
}

const TOOLBAR_BUTTONS: ToolbarButtonDef[] = [
	{
		id: 'clash-controls',
		label: 'Clash Controls',
		icon: (
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth={1.8}
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<path d="M4 6h10" />
				<path d="M18 6h2" />
				<circle cx="16" cy="6" r="2" />
				<path d="M4 12h4" />
				<path d="M12 12h8" />
				<circle cx="10" cy="12" r="2" />
				<path d="M4 18h10" />
				<path d="M18 18h2" />
				<circle cx="16" cy="18" r="2" />
			</svg>
		),
	},
	{
		id: 'clash-context',
		label: 'Context',
		icon: (
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth={1.8}
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<circle cx="12" cy="12" r="9" />
				<path d="M12 8h.01" />
				<path d="M11 12h1v5h1" />
			</svg>
		),
	},
	{
		id: 'clash-recommendations',
		label: 'Recommendations',
		icon: <AiIdeaIcon />,
	},
]

export function InspectorToolbar({
	openPanels,
	onTogglePanel,
}: InspectorToolbarProps) {
	const { isChatOpen, toggleChat } = useFloatingChat()

	return (
		<nav
			aria-label="Inspector panels and chat"
			className="pointer-events-auto absolute left-4 top-20 z-30 flex flex-col gap-1.5 rounded-xl border border-neutral-200 bg-white/85 p-1.5 shadow-sm backdrop-blur-md"
		>
			{TOOLBAR_BUTTONS.map((btn) => {
				const isOpen = openPanels.has(btn.id)
				return (
					<button
						key={btn.id}
						type="button"
						onClick={() => onTogglePanel(btn.id)}
						aria-pressed={isOpen}
						aria-label={btn.label}
						title={btn.label}
						className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/60 ${
							isOpen
								? 'border-primary/40 bg-primary/10 text-primary'
								: 'border-transparent text-neutral-600 hover:border-neutral-200 hover:bg-neutral-100 hover:text-neutral-900'
						}`}
					>
						<span className="block h-[18px] w-[18px]">{btn.icon}</span>
					</button>
				)
			})}
			<button
				type="button"
				onClick={toggleChat}
				aria-pressed={isChatOpen}
				aria-label={isChatOpen ? 'Close chat' : 'Open chat'}
				title="Chat"
				className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/60 ${
					isChatOpen
						? 'border-primary/40 bg-primary/10 text-primary'
						: 'border-transparent text-neutral-600 hover:border-neutral-200 hover:bg-neutral-100 hover:text-neutral-900'
				}`}
			>
				<AiChatIcon className="h-[18px] w-[18px]" />
			</button>
		</nav>
	)
}
