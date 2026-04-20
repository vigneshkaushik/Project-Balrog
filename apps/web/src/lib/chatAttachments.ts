import type { Clash } from '../types'
import type { ChatAttachment } from '../context/ChatAttachmentsContext'
import type {
	ContextRegionPayload,
	NearbySpeckleObjectPayload,
} from './clashContextRegion'
import type { ClashObjectWithUserMetadata } from './postClashAnalysis'

/**
 * Keys on a Speckle `raw` object that are large or not useful for an LLM (they
 * mirror the set used by `SpeckleObjectOverlay` and `clashContextRegion`). We
 * trim them client-side before shipping `object_data` over the wire so the
 * chat payload stays small and doesn't include geometry / display blobs.
 */
const HIDDEN_OBJECT_DATA_KEYS = new Set([
	'__closure',
	'__parents',
	'bbox',
	'children',
	'displayStyle',
	'displayValue',
	'elements',
	'geometry',
	'renderMaterial',
	'transform',
	'@displayValue',
])

function trimObjectData(
	source: Record<string, unknown>,
): Record<string, unknown> {
	const out: Record<string, unknown> = {}
	for (const [k, v] of Object.entries(source)) {
		if (HIDDEN_OBJECT_DATA_KEYS.has(k) || k.startsWith('__')) continue
		out[k] = v
	}
	return out
}

// --- Wire (JSON) shapes: these match apps/api/app/routes/chat.py ---

export interface ChatAttachmentClashWire {
	kind: 'clash'
	label: string
	clash: Clash
	clash_context: {
		context_region: ContextRegionPayload | null
		nearby_speckle_objects: NearbySpeckleObjectPayload[]
		clash_objects_original: ClashObjectWithUserMetadata[]
		unmatched_clash_keys?: string[]
		speckle_url_count?: number
		capped?: boolean
	}
}

export interface ChatAttachmentSelectedObjectWire {
	kind: 'selected_object'
	label: string
	speckle_id: string | null
	object_data: Record<string, unknown>
	user_metadata: string | null
}

export interface ChatAttachmentRecommendationWire {
	kind: 'recommendation'
	label: string
	text: string
	clash_id: string
	clash_label: string
}

export type ChatAttachmentWire =
	| ChatAttachmentClashWire
	| ChatAttachmentSelectedObjectWire
	| ChatAttachmentRecommendationWire

/** Convert an in-memory `ChatAttachment` into the wire shape sent to `POST /chat`. */
export function toChatAttachmentWire(
	attachment: ChatAttachment,
): ChatAttachmentWire {
	switch (attachment.kind) {
		case 'clash':
			return {
				kind: 'clash',
				label: attachment.label,
				clash: attachment.clash,
				clash_context: {
					context_region: attachment.clashContext.context_region,
					nearby_speckle_objects:
						attachment.clashContext.nearby_speckle_objects,
					clash_objects_original:
						attachment.clashContext.clash_objects_original,
					...(attachment.clashContext.unmatched_clash_keys?.length
						? {
								unmatched_clash_keys:
									attachment.clashContext.unmatched_clash_keys,
							}
						: {}),
					...(typeof attachment.clashContext.speckle_url_count === 'number'
						? { speckle_url_count: attachment.clashContext.speckle_url_count }
						: {}),
					...(typeof attachment.clashContext.capped === 'boolean'
						? { capped: attachment.clashContext.capped }
						: {}),
				},
			}
		case 'selected_object':
			return {
				kind: 'selected_object',
				label: attachment.label,
				speckle_id: attachment.speckleId,
				object_data: trimObjectData(attachment.objectData),
				user_metadata: attachment.userMetadata,
			}
		case 'recommendation':
			return {
				kind: 'recommendation',
				label: attachment.label,
				text: attachment.text,
				clash_id: attachment.clashId,
				clash_label: attachment.clashLabel,
			}
	}
}

export function toChatAttachmentsWire(
	attachments: readonly ChatAttachment[] | null | undefined,
): ChatAttachmentWire[] | undefined {
	if (!attachments || attachments.length === 0) return undefined
	return attachments.map(toChatAttachmentWire)
}
