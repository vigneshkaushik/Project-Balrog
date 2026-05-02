import { useMemo, useRef } from "react";
import { useFloatingChat } from "../../context/FloatingChatContext";
import {
	FLOATING_OVERLAY_GUTTER,
	getFloatingOverlayViewport,
	PANEL_GRID,
	snapToGrid,
	useFloatingPanel,
} from "../../hooks/useFloatingPanel";
import { ChatWindow } from "./ChatWindow";

const G = PANEL_GRID;
const inset = FLOATING_OVERLAY_GUTTER;

export function FloatingChat() {
	const { isChatOpen } = useFloatingChat();
	const panelRef = useRef<HTMLElement>(null);
	const initialSize = useMemo(() => {
		if (typeof window === "undefined") return { width: 416, height: 560 };
		const { width: vw, height: vh } = getFloatingOverlayViewport();
		return {
			width: snapToGrid(Math.min(416, vw - 2 * inset)),
			height: snapToGrid(Math.min(Math.round(vh * 0.64), 720)),
		};
	}, []);
	const initialPosition = useMemo(() => {
		if (typeof window === "undefined") return { x: inset, y: 96 };
		const { width: vw, height: vh } = getFloatingOverlayViewport();
		return {
			x: Math.max(inset, vw - inset - initialSize.width),
			y: inset + snapToGrid(
				Math.max(3 * G, vh - initialSize.height - 5 * G - inset),
			),
		};
	}, [initialSize.height, initialSize.width]);
	const { position, size, handleProps, getResizeHandleProps } = useFloatingPanel({
		panelId: "floating-chat-window",
		panelRef,
		initialPosition,
		initialSize,
		minSize: { width: 320, height: 320 },
	});

	return (
		<div className="pointer-events-none absolute inset-0 z-30">
			<div
				className={`pointer-events-auto origin-bottom-right transition-all duration-150 ${
					isChatOpen ? "visible opacity-100" : "invisible opacity-0"
				}`}
			>
				<section
					ref={panelRef}
					className="floating-card pointer-events-auto absolute overflow-hidden"
					style={{
						left: `${position.x}px`,
						top: `${position.y}px`,
						width: `${size.width}px`,
						height: `${size.height}px`,
					}}
				>
					<div className="h-full min-h-0">
						<ChatWindow
							className="rounded-xl border-0"
							panelBoundsRef={panelRef}
							onHeaderPointerDown={handleProps.onPointerDown}
						/>
					</div>
					<div
						className="absolute inset-y-2 right-0 w-2 cursor-e-resize"
						{...getResizeHandleProps("e")}
					/>
					<div
						className="absolute inset-y-2 left-0 w-2 cursor-w-resize"
						{...getResizeHandleProps("w")}
					/>
					<div
						className="absolute inset-x-2 bottom-0 h-2 cursor-s-resize"
						{...getResizeHandleProps("s")}
					/>
					<div
						className="absolute inset-x-2 top-0 h-2 cursor-n-resize"
						{...getResizeHandleProps("n")}
					/>
					<div
						className="absolute right-0 top-0 h-3 w-3 cursor-ne-resize"
						{...getResizeHandleProps("ne")}
					/>
					<div
						className="absolute left-0 top-0 h-3 w-3 cursor-nw-resize"
						{...getResizeHandleProps("nw")}
					/>
					<div
						className="absolute right-0 bottom-0 h-3 w-3 cursor-se-resize"
						{...getResizeHandleProps("se")}
					/>
					<div
						className="absolute bottom-0 left-0 h-3 w-3 cursor-sw-resize"
						{...getResizeHandleProps("sw")}
					/>
				</section>
			</div>
		</div>
	);
}
