export interface PreviewEventLogEntry {
	id: string;
	label: string;
	text: string;
	payload: unknown;
	timestamp: number;
}

interface PreviewEventLogProps {
	events: PreviewEventLogEntry[];
}

function formatTimestamp(timestamp: number): string {
	const date = new Date(timestamp);
	return `${date.getHours().toString().padStart(2, "0")}:${date
		.getMinutes()
		.toString()
		.padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`;
}

export function PreviewEventLog({ events }: PreviewEventLogProps) {
	return (
		<div class="border border-slate-300 dark:border-slate-700">
			<div class="border-b border-slate-300 bg-slate-100 px-2 py-1 text-[11px] font-semibold tracking-wide text-slate-600 uppercase dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
				Event Log
			</div>
			<div
				class="max-h-44 overflow-y-auto bg-white px-2 py-1 font-mono text-[11px] text-slate-700 dark:bg-slate-950 dark:text-slate-300"
				data-testid="preview-event-log"
			>
				{events.length === 0 ? (
					<div class="text-slate-400 dark:text-slate-500">No events yet.</div>
				) : (
					events
						.slice()
						.reverse()
						.map((event) => (
							<div
								key={event.id}
								class="border-b border-slate-200 py-1 last:border-b-0 dark:border-slate-800"
							>
								<div class="flex items-center justify-between gap-2">
									<span class="font-semibold text-slate-600 dark:text-slate-400">
										[{event.label}]
									</span>
									<span class="text-slate-400 dark:text-slate-500">
										{formatTimestamp(event.timestamp)}
									</span>
								</div>
								<div>{event.text}</div>
								<details class="mt-0.5">
									<summary class="cursor-pointer text-slate-500 dark:text-slate-400">
										payload
									</summary>
									<pre class="overflow-x-auto text-[10px]">
										{JSON.stringify(event.payload, null, 2)}
									</pre>
								</details>
							</div>
						))
				)}
			</div>
		</div>
	);
}
