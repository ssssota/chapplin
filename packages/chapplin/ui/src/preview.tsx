import { Resizable } from "./resizable";

export function Preview(props: { tool: string }) {
	return (
		<div class="flex">
			<Resizable>
				<iframe src={props.tool} title="Preview" class="w-full" />
			</Resizable>
		</div>
	);
}
