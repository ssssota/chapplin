import { render } from "preact";
import { App } from "./app.tsx";
import "virtual:uno.css";
import "@unocss/reset/tailwind-v4.css";

const parent = document.getElementById("app");
if (parent) render(<App />, parent);
