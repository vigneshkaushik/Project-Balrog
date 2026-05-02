import type {
	ChatAttachment,
	ClashAttachmentContext,
	RecommendationAttachmentMode,
} from '../context/ChatAttachmentsContext'
import {
	clashAttachmentId,
	recommendationAttachmentId,
	selectedObjectAttachmentId,
} from '../context/ChatAttachmentsContext'
import type { Clash } from '../types'
import {
	getSelectedObjectTitleText,
	readSelectedSpeckleId,
} from './selectedObjectDescriptors'

function clashAttachmentLabel(clash: Clash): string {
	const label = clash.label?.trim()
	const test = clash.testName?.trim()
	const name = label && label.length > 0 ? label : 'Clash'
	return test && test.length > 0 ? `${name} (${test})` : name
}

export function buildClashAttachment(
	clash: Clash,
	clashContext: ClashAttachmentContext,
): ChatAttachment {
	return {
		kind: 'clash',
		id: clashAttachmentId(clash.id),
		label: `Clash: ${clashAttachmentLabel(clash)}`,
		clash,
		clashContext,
	}
}

export function buildSelectedObjectAttachment(
	objectData: Record<string, unknown>,
	userMetadata: string | null,
): ChatAttachment {
	const speckleId = readSelectedSpeckleId(objectData)
	const titleText = getSelectedObjectTitleText(objectData)
	const fallback = speckleId ?? 'selected'
	return {
		kind: 'selected_object',
		id: selectedObjectAttachmentId(speckleId, fallback),
		label: `Selected: ${titleText}`,
		speckleId,
		objectData,
		userMetadata: userMetadata && userMetadata.trim().length > 0 ? userMetadata : null,
	}
}

export function buildRecommendationAttachment(
	clash: Clash,
	index: number,
	mode: RecommendationAttachmentMode,
): ChatAttachment {
	const clashLabel = clashAttachmentLabel(clash)
	const n = index + 1
	const label =
		mode === 'modify'
			? `Modifying Rec #${n} for '${clashLabel}'`
			: `Recommendation #${n} for '${clashLabel}'`
	return {
		kind: 'recommendation',
		id: recommendationAttachmentId(clash.id, index, mode),
		label,
		clashId: clash.id,
		clashLabel,
		recommendationIndex: index,
		mode,
	}
}
