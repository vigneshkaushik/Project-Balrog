import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

const CHAT_OPEN_KEY = "balrog-floating-chat-open";

function readInitialOpenState(): boolean {
	if (typeof window === "undefined") return false;
	try {
		return window.localStorage.getItem(CHAT_OPEN_KEY) === "1";
	} catch {
		return false;
	}
}

interface FloatingChatContextValue {
	isChatOpen: boolean;
	setChatOpen: (open: boolean) => void;
	toggleChat: () => void;
}

const FloatingChatContext = createContext<FloatingChatContextValue | null>(
	null,
);

export function FloatingChatProvider({ children }: { children: ReactNode }) {
	const [isChatOpen, setChatOpenState] = useState(readInitialOpenState);

	useEffect(() => {
		try {
			window.localStorage.setItem(CHAT_OPEN_KEY, isChatOpen ? "1" : "0");
		} catch {
			// Ignore storage failures.
		}
	}, [isChatOpen]);

	const setChatOpen = useCallback((open: boolean) => {
		setChatOpenState(open);
	}, []);

	const toggleChat = useCallback(() => {
		setChatOpenState((prev) => !prev);
	}, []);

	const value = useMemo(
		() => ({ isChatOpen, setChatOpen, toggleChat }),
		[isChatOpen, setChatOpen, toggleChat],
	);

	return (
		<FloatingChatContext.Provider value={value}>
			{children}
		</FloatingChatContext.Provider>
	);
}

// Hook colocated with provider (same pattern as ToastContext).
// eslint-disable-next-line react-refresh/only-export-components -- context hook pair
export function useFloatingChat(): FloatingChatContextValue {
	const ctx = useContext(FloatingChatContext);
	if (!ctx) {
		throw new Error("useFloatingChat must be used within FloatingChatProvider");
	}
	return ctx;
}
