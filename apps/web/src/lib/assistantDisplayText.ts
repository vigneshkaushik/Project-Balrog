import { splitAnswerStream } from "./answerStreamSplit";

/** ReAct / agent preamble: ``Thought:`` … ``Action:`` (including ``Action: None``). */
const THOUGHT_ACTION_BLOCK =
	/(?:^|\r?\n)\s*Thought:\s*[\s\S]*?\r?\n\s*Action:\s*[^\r\n]*/gi;

/** Same block when the model opens with a markdown fence before ``Thought:``. */
const FENCED_THOUGHT_ACTION =
	/`{3,}\s*Thought:\s*[\s\S]*?\r?\n\s*Action:\s*[^\r\n]*/gi;

function stripReactThoughtActionNoise(text: string): string {
	let s = text;
	for (let i = 0; i < 64; i++) {
		const next = s
			.replace(FENCED_THOUGHT_ACTION, "\n")
			.replace(THOUGHT_ACTION_BLOCK, "\n")
			.replace(/\n{3,}/g, "\n\n");
		if (next === s) {
			break;
		}
		s = next;
	}
	s = s.replace(/`{3,}/g, "");
	s = s.replace(/^-{5,}\s*$/gm, "");
	return s.trim();
}

/**
 * User-visible assistant bubble: text after the last answer marker only, with
 * ReAct noise stripped from that slice. Preamble stays in metadata.
 */
export function assistantBubbleText(raw: string): string {
	const { answer } = splitAnswerStream(raw);
	return stripReactThoughtActionNoise(answer.trim());
}
