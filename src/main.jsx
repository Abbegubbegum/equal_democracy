import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import EqualDemocracyApp from "./EqualDemocracyApp";

createRoot(document.getElementById("root")).render(
	<StrictMode>
		<EqualDemocracyApp />
	</StrictMode>
);
