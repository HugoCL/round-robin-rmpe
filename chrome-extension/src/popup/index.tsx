import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../components/App";
import { Providers } from "../providers/Providers";
import "../styles.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element not found");

createRoot(rootEl).render(
	<StrictMode>
		<Providers>
			<App />
		</Providers>
	</StrictMode>,
);
