import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

type ToastVariant = "error" | "info";

interface ToastPayload {
	id: number;
	variant: ToastVariant;
	message: string;
}

const ToastContext = createContext<{
	showToast: (variant: ToastVariant, message: string) => void;
} | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
	const [toast, setToast] = useState<ToastPayload | null>(null);
	const idRef = useRef(0);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const dismissToast = useCallback(() => {
		if (timerRef.current) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
		setToast(null);
	}, []);

	const showToast = useCallback((variant: ToastVariant, message: string) => {
		idRef.current += 1;
		const id = idRef.current;
		setToast({ id, variant, message });
		if (timerRef.current) clearTimeout(timerRef.current);
		timerRef.current = setTimeout(() => {
			setToast((t) => (t?.id === id ? null : t));
			timerRef.current = null;
		}, 6000);
	}, []);

	useEffect(() => {
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, []);

	const value = useMemo(() => ({ showToast }), [showToast]);

	const closeBtnClass =
		toast?.variant === "error"
			? "text-red-800/70 hover:bg-red-100 hover:text-red-900"
			: "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900";

	return (
		<ToastContext.Provider value={value}>
			{children}
			{toast ? (
				<div
					role="alert"
					className={`fixed bottom-6 left-1/2 z-[200] flex max-w-[min(92vw,24rem)] -translate-x-1/2 items-start gap-2 rounded-lg border py-2 pl-4 pr-2 text-sm shadow-lg ${
						toast.variant === "error"
							? "border-red-200 bg-red-50 text-red-900"
							: "border-neutral-200 bg-white text-neutral-800"
					}`}
				>
					<p className="min-w-0 flex-1 py-1 pr-1 leading-snug">
						{toast.message}
					</p>
					<button
						type="button"
						aria-label="Dismiss notification"
						onClick={dismissToast}
						className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-lg font-light leading-none transition-colors ${closeBtnClass}`}
					>
						×
					</button>
				</div>
			) : null}
		</ToastContext.Provider>
	);
}

export function useToast() {
	const ctx = useContext(ToastContext);
	if (!ctx) {
		throw new Error("useToast must be used within ToastProvider");
	}
	return ctx;
}
