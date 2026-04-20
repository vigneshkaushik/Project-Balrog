/** Plain-string title suitable for labels / chips (no ReactNode). */
export function getSelectedObjectTitleText(
	objectData: Record<string, unknown>,
): string {
	const name = objectData.name
	const type = objectData.type
	const speckleType = objectData.speckle_type
	if (typeof name === 'string' && name.trim()) return name.trim()
	if (typeof type === 'string' && type.trim()) return type.trim()
	if (typeof speckleType === 'string' && speckleType.trim())
		return speckleType.trim()
	return 'Selected object'
}

/** Extract a Speckle object id (`raw.id`) as a trimmed string, or `null`. */
export function readSelectedSpeckleId(
	objectData: Record<string, unknown>,
): string | null {
	const id = objectData.id
	return typeof id === 'string' && id.trim().length > 0 ? id.trim() : null
}
