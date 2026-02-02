import { ErrorBoundary, LocationProvider, Route, Router } from "preact-iso";
import { NotFound } from "./not-found";
import { Preview } from "./preview";

const routes = [
	{
		path: "/preview/tools/*",
		component: Preview,
		tool: location.pathname.replace(/^\/preview/, ""),
	},
	{
		default: true,
		path: undefined,
		component: NotFound,
	},
] as const;

export function App() {
	return (
		<LocationProvider>
			<ErrorBoundary>
				<Router>
					{routes.map((route) => (
						<Route key={route.path || "DEFAULT"} {...route} />
					))}
				</Router>
			</ErrorBoundary>
		</LocationProvider>
	);
}
