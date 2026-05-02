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

export type RecommendationAttachmentMode = 'attach' | 'modify'

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
			clashId: string
			clashLabel: string
			recommendationIndex: number
			mode: RecommendationAttachmentMode
	  }

export type ChatAttachmentKind = ChatAttachment['kind']

interface ChatAttachmentsContextValue {
	attachments: ChatAttachment[]
	/** Append or replace by id (dedupe). Replace keeps ordering stable. */
	addAttachment: (a: ChatAttachment) => void
	removeAttachment: (id: string) => void
	clearAttachments: () => void
	/** Removes clash / selected_object / attach-mode recommendation chips only;
	 * keeps sticky modify-mode recommendation chips. */
	clearOneShotAttachments: () => void
	/** Removes recommendation attachments targeting one clash (e.g. after re-run analysis). */
	removeRecommendationAttachmentsForClash: (clashId: string) => void
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

	const clearOneShotAttachments = useCallback(() => {
		setAttachments((prev) => {
			const next = prev.filter(
				(a) =>
					!(
						a.kind === 'clash' ||
						a.kind === 'selected_object' ||
						(a.kind === 'recommendation' && a.mode === 'attach')
					),
			)
			return next.length === prev.length ? prev : next
		})
	}, [])

	const removeRecommendationAttachmentsForClash = useCallback(
		(clashId: string) => {
			const id = clashId.trim()
			if (!id) return
			setAttachments((prev) => {
				const next = prev.filter(
					(a) =>
						a.kind !== 'recommendation' ||
						a.clashId.trim() !== id,
				)
				return next.length === prev.length ? prev : next
			})
		},
		[],
	)

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
			clearOneShotAttachments,
			removeRecommendationAttachmentsForClash,
			hasAttachment,
		}),
		[
			attachments,
			addAttachment,
			removeAttachment,
			clearAttachments,
			clearOneShotAttachments,
			removeRecommendationAttachmentsForClash,
			hasAttachment,
		],
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

/** Stable id for a recommendation scoped to clash + index + mode. */
// eslint-disable-next-line react-refresh/only-export-components -- pure helpers
export function recommendationAttachmentId(
	clashId: string,
	recommendationIndex: number,
	mode: RecommendationAttachmentMode,
): string {
	return `recommendation:${clashId}:${recommendationIndex}:${mode}`
}
