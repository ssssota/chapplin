import { defineTool } from "chapplin-next";
import z from "zod";

export const tool = defineTool({
	name: "get_weather",
	config: {
		description: "指定した都市の天気を取得します",
		inputSchema: {
			city: z.string().describe("都市名"),
			unit: z
				.enum(["celsius", "fahrenheit"])
				.default("celsius")
				.describe("温度単位"),
		},
		outputSchema: {
			temperature: z.number(),
			condition: z.string(),
			humidity: z.number(),
		},
	},
	async handler(args) {
		const weatherData: Record<
			string,
			{ temp: number; condition: string; humidity: number }
		> = {
			tokyo: { temp: 22, condition: "晴れ", humidity: 45 },
			osaka: { temp: 24, condition: "曇り", humidity: 55 },
			nagoya: { temp: 23, condition: "晴れ", humidity: 50 },
		};

		const data = weatherData[args.city.toLowerCase()] ?? {
			temp: 20,
			condition: "不明",
			humidity: 50,
		};
		const temperature =
			args.unit === "fahrenheit" ? data.temp * 1.8 + 32 : data.temp;

		return {
			content: [
				{
					type: "text" as const,
					text: `${args.city}の天気: ${data.condition}, ${temperature}°${args.unit === "celsius" ? "C" : "F"}`,
				},
			],
			structuredContent: {
				temperature,
				condition: data.condition,
				humidity: data.humidity,
			},
		};
	},
});
