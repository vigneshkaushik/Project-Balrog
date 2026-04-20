import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useState,
} from 'react'
import type { Clash } from '../types'
import type {
	ContextRegionPayload,
	NearbySpeckleObjectPayload,
} from '../lib/clashContextRegion'
import type { ClashObjectWithUserMetadata } from '../lib/postClashAnalysis'

export interface ClashAttachmentContext {
	context_region: ContextRegionPayload | null
	nearby_speckle_objects: NearbySpeckleObjectPayload[]
	clash_objects_original: ClashObjectWithUserMetadata[]
	unmatched_clash_keys?: string[]
	speckle_url_count?: number
	capped?: boolean
}

export type ChatAttachment =
	| {
			kind: 'clash'
			id: string
			label: string
			clash: Clash
			clashContext: ClashAttachmentContext
	  }
	| {
			kind: 'selected_object'
			id: string
			label: string
			speckleId: string | null
			objectData: Record<string, unknown>
			userMetadata: string | null
	  }
	| {
			kind: 'recommendation'
			id: string
			label: string
			text: string
			clashId: string
			clashLabel: string
	  }

export type ChatAttachmentKind = ChatAttachment['kind']

interface ChatAttachmentsContextValue {
	attachments: ChatAttachment[]
	/** Append or replace by id (dedupe). Replace keeps ordering stable. */
	addAttachment: (a: ChatAttachment) => void
	removeAttachment: (id: string) => void
	clearAttachments: () => void
	hasAttachment: (id: string) => boolean
}

const ChatAttachmentsContext =
	createContext<ChatAttachmentsContextValue | null>(null)

export function ChatAttachmentsProvider({
	children,
}: {
	children: ReactNode
}) {
	const [attachments, setAttachments] = useState<ChatAttachment[]>([])

	const addAttachment = useCallback((a: ChatAttachment) => {
		setAttachments((prev) => {
			const idx = prev.findIndex((p) => p.id === a.id)
			if (idx === -1) return [...prev, a]
			const next = [...prev]
			next[idx] = a
			return next
		})
	}, [])

	const removeAttachment = useCallback((id: string) => {
		setAttachments((prev) => {
			if (!prev.some((p) => p.id === id)) return prev
			return prev.filter((p) => p.id !== id)
		})
	}, [])

	const clearAttachments = useCallback(() => {
		setAttachments((prev) => (prev.length === 0 ? prev : []))
	}, [])

	const hasAttachment = useCallback(
		(id: string) => attachments.some((a) => a.id === id),
		[attachments],
	)

	const value = useMemo<ChatAttachmentsContextValue>(
		() => ({
			attachments,
			addAttachment,
			removeAttachment,
			clearAttachments,
			hasAttachment,
		}),
		[attachments, addAttachment, removeAttachment, clearAttachments, hasAttachment],
	)

	return (
		<ChatAttachmentsContext.Provider value={value}>
			{children}
		</ChatAttachmentsContext.Provider>
	)
}

// eslint-disable-next-line react-refresh/only-export-components -- context hook pair
export function useChatAttachments(): ChatAttachmentsContextValue {
	const ctx = useContext(ChatAttachmentsContext)
	if (!ctx) {
		throw new Error(
			'useChatAttachments must be used within ChatAttachmentsProvider',
		)
	}
	return ctx
}

/** Stable id helpers for deduping attachments. */
// eslint-disable-next-line react-refresh/only-export-components -- pure helpers
export function clashAttachmentId(clashId: string): string {
	return `clash:${clashId}`
}

// eslint-disable-next-line react-refresh/only-export-components -- pure helpers
export function selectedObjectAttachmentId(
	speckleId: string | null | undefined,
	fallback: string,
): string {
	const id = speckleId?.trim()
	return `selected_object:${id && id.length > 0 ? id : fallback}`
}

/** Stable id for a recommendation scoped to its clash. Text is hashed for brevity. */
// eslint-disable-next-line react-refresh/only-export-components -- pure helpers
export function recommendationAttachmentId(
	clashId: string,
	text: string,
): string {
	return `recommendation:${clashId}:${djb2Hash(text)}`
}

function djb2Hash(input: string): string {
	let h = 5381
	for (let i = 0; i < input.length; i += 1) {
		h = ((h << 5) + h) ^ input.charCodeAt(i)
	}
	return (h >>> 0).toString(36)
}
