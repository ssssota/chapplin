import type { TargetedPointerEvent } from "preact";
import { useCallback, useRef } from "preact/hooks";

type Props = {
	children: preact.ComponentChildren;
	onResize?: (width: number) => void;
	max?: number;
	min?: number;
};

export function Resizable(props: Props) {
	const grabStateRef = useRef<number | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	const grab = useCallback((e: TargetedPointerEvent<HTMLButtonElement>) => {
		e.currentTarget.setPointerCapture(e.pointerId);
		grabStateRef.current = e.clientX;
	}, []);
	const release = useCallback((e: TargetedPointerEvent<HTMLButtonElement>) => {
		e.currentTarget.releasePointerCapture(e.pointerId);
		grabStateRef.current = null;
	}, []);
	const onMove = useCallback(
		(e: TargetedPointerEvent<HTMLButtonElement>) => {
			if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
			if (!containerRef.current || grabStateRef.current === null) return;
			const dx = e.clientX - grabStateRef.current;
			const width = clamp(
				containerRef.current.clientWidth + dx,
				props.min,
				props.max,
			);
			containerRef.current.style.width = `${width}px`;
			props.onResize?.(width);
			grabStateRef.current = e.clientX;
		},
		[props.max, props.min, props.onResize],
	);
	return (
		<div ref={containerRef} class="relative h-full">
			{props.children}
			<button
				aria-label="Drag to resize"
				type="button"
				onPointerDown={grab}
				onPointerUp={release}
				onPointerCancel={release}
				onPointerMove={onMove}
				class="absolute top-0 left-full h-full rounded-r w-2 cursor-col-resize bg-gray-200 hover:bg-gray-300 active:bg-gray-400"
			/>
		</div>
	);
}

function clamp(value: number, min = -Infinity, max = Infinity) {
	return Math.min(Math.max(value, min), max);
}
