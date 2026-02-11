import { render } from "preact";
import { App } from "./App.js";
import "virtual:uno.css";
import "@unocss/reset/tailwind-v4.css";

const root = document.getElementById("root");
if (root) {
	render(<App />, root);
}
