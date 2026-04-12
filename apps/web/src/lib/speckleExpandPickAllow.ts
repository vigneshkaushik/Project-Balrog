import type { NodeRenderView, TreeNode, Viewer } from '@speckle/viewer'

function addPickKey(allow: Set<string>, value: string | undefined | null): void {
	if (typeof value !== 'string') return
	const t = value.trim()
	if (!t.length) return
	allow.add(t)
	if (t.includes('-') && t.length >= 32) allow.add(t.toLowerCase())
}

function pickKeyMatches(allow: Set<string>, value: string | undefined | null): boolean {
	if (typeof value !== 'string') return false
	const t = value.trim()
	if (!t.length) return false
	if (allow.has(t)) return true
	if (t.includes('-') && t.length >= 32 && allow.has(t.toLowerCase())) return true
	return false
}

function collectRenderViewKeys(
	viewer: Viewer,
	node: TreeNode,
	allow: Set<string>,
): void {
	const rt = viewer.getWorldTree().getRenderTree()
	const rvs = rt.getRenderViewsForNode(node)
	for (const rv of rvs) {
		addPickKey(allow, rv.renderData.id)
		addPickKey(allow, rv.guid)
		addPickKey(allow, rv.hasMetadata?.id)
	}
}

function walkMatchedSubtree(viewer: Viewer, root: TreeNode, allow: Set<string>): void {
	const visit = (node: TreeNode) => {
		collectRenderViewKeys(viewer, node, allow)
		const nested = node.model.nestedNodes
		if (Array.isArray(nested)) {
			for (const ch of nested) visit(ch)
		}
		const children = node.children as TreeNode[] | undefined
		if (Array.isArray(children)) {
			for (const ch of children) visit(ch)
		}
	}
	visit(root)
}

/**
 * Ids that raycasts may report on `NodeRenderView` / metadata — usually not the same
 * as `WorldTree` object ids alone. Expand so clash-highlighted geometry stays pickable.
 */
export function expandClashPickAllowIds(
	viewer: Viewer,
	matchedObjectIds: readonly string[],
): Set<string> {
	const allow = new Set<string>()
	for (const id of matchedObjectIds) {
		addPickKey(allow, id)
	}

	const tree = viewer.getWorldTree()
	for (const objectId of matchedObjectIds) {
		const trimmed = objectId?.trim()
		if (!trimmed) continue
		const found = tree.findId(trimmed) ?? []
		for (const n of found) {
			walkMatchedSubtree(viewer, n, allow)
		}
	}

	return allow
}

export function renderViewAllowedForClashPick(
	allow: Set<string>,
	rv: NodeRenderView,
): boolean {
	if (pickKeyMatches(allow, rv.hasMetadata?.id)) return true
	if (pickKeyMatches(allow, rv.renderData.id)) return true
	if (pickKeyMatches(allow, rv.guid)) return true
	return false
}
