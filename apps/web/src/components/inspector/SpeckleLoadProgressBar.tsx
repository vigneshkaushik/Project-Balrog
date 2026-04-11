export interface SpeckleLoadProgressBarProps {
	percent: number;
}

/**
 * Speckle-style pill progress bar (clash inspector canvas overlay).
 */
export function SpeckleLoadProgressBar({
	percent,
}: SpeckleLoadProgressBarProps) {
	const clamped = Math.min(100, Math.max(0, percent));

	return (
		<div
			className="pointer-events-none absolute left-1/2 top-3 z-20 w-[min(78vw,11rem)] -translate-x-1/2 px-1"
			role="status"
			aria-live="polite"
			aria-label={`Loading model, ${clamped} percent`}
		>
			<div className="relative h-[11px] w-full overflow-hidden rounded-full bg-[#c8daf4] shadow-sm">
				<div
					className="absolute inset-y-0 left-0 rounded-full bg-[#2463eb] transition-[width] duration-150 ease-out"
					style={{ width: `${clamped}%` }}
				/>
				<div className="absolute inset-0 flex items-center justify-center text-[8px] font-semibold leading-none tracking-tight text-white [text-shadow:0_0_1px_rgb(0_0_0/0.45)]">
					{clamped}%
				</div>
			</div>
		</div>
	);
}
