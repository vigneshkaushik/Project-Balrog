/** Match start of line (or start of string) answer section headers. */
const ANSWER_MARKERS: RegExp[] = [
	/(?:^|\r?\n)\s*Answer:\s*/gi,
	/(?:^|\r?\n)\s*Final answer:\s*/gi,
	/(?:^|\r?\n)\s*###\s*Answer\s*(?:\r?\n|$)/gi,
];

function allMarkerMatches(raw: string): { index: number; length: number }[] {
	const out: { index: number; length: number }[] = [];
	for (const re of ANSWER_MARKERS) {
		re.lastIndex = 0;
		let m = re.exec(raw);
		while (m !== null) {
			out.push({ index: m.index, length: m[0].length });
			m = re.exec(raw);
		}
	}
	return out;
}

/**
 * Split raw assistant output into preamble (metadata / scratch) and user-facing answer.
 * Uses the **last** matching answer marker so stray earlier labels stay in the preamble.
 */
export function splitAnswerStream(raw: string): {
	preamble: string;
	answer: string;
} {
	const matches = allMarkerMatches(raw);
	if (matches.length === 0) {
		return { preamble: raw, answer: "" };
	}
	let best = matches[0];
	for (const m of matches) {
		if (m.index > best.index) best = m;
	}
	const cut = best.index + best.length;
	return {
		preamble: raw.slice(0, best.index),
		answer: raw.slice(cut),
	};
}
