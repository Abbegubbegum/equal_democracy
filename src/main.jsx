import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import EqualDemocracyApp from "./EqualDemocracyApp";

createRoot(document.getElementById("root")).render(
	<StrictMode>
		<p>Hello</p>
		<EqualDemocracyApp />
	</StrictMode>
);
