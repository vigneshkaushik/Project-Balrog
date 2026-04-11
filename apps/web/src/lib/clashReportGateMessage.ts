/**
 * User-facing copy when opening the clash report without required setup.
 */
export function clashReportGateMessage(
	hasSpeckleUrl: boolean,
	hasClashReport: boolean,
): string {
	if (!hasSpeckleUrl && !hasClashReport) {
		return "Upload a Navisworks clash report and add at least one Speckle model URL before opening the clash report.";
	}
	if (!hasSpeckleUrl) {
		return "Add at least one Speckle model URL before opening the clash report.";
	}
	return "Upload a Navisworks clash report before opening the clash report.";
}
