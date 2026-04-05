import type { AgentActivityItem } from "../types";
import { getApiBaseUrl } from "./apiBase";

/** Single-chat session: survives full page refresh while the tab stays open. */
export const CHAT_CONVERSATION_STORAGE_KEY = "balrog.chat.conversationId";

export interface ApiChatHistoryMessage {
	role: string;
	text: string;
	activity?: AgentActivityItem[] | null;
	thinking_buffer?: string | null;
}

/**
 * Load stored turns from the API (LlamaIndex in-memory buffer for this worker).
 */
export async function fetchChatHistory(
	conversationId: string,
	options?: { signal?: AbortSignal },
): Promise<ApiChatHistoryMessage[]> {
	const base = getApiBaseUrl();
	const url = new URL(`${base}/chat/messages`);
	url.searchParams.set("conversation_id", conversationId);
	const res = await fetch(url.toString(), {
		method: "GET",
		headers: { Accept: "application/json" },
		signal: options?.signal,
	});
	if (!res.ok) {
		const t = await res.text().catch(() => "");
		throw new Error(t || `${res.status} ${res.statusText}`);
	}
	const data = (await res.json()) as { messages?: ApiChatHistoryMessage[] };
	return data.messages ?? [];
}

export function readStoredConversationId(): string | null {
	try {
		return sessionStorage.getItem(CHAT_CONVERSATION_STORAGE_KEY);
	} catch {
		return null;
	}
}

export function persistConversationId(id: string): void {
	try {
		sessionStorage.setItem(CHAT_CONVERSATION_STORAGE_KEY, id);
	} catch {
		/* quota / private mode */
	}
}
