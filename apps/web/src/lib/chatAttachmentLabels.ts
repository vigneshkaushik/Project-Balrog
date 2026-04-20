import type { ChatAttachmentKind } from '../context/ChatAttachmentsContext'

/** Human-readable kind label for menus / chips. */
export function chatAttachmentKindLabel(kind: ChatAttachmentKind): string {
	if (kind === 'clash') return 'Clash'
	if (kind === 'selected_object') return 'Selected object'
	return 'Recommendation'
}
