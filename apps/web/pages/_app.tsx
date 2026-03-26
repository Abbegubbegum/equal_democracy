import { SessionProvider } from "next-auth/react";
import { ConfigProvider } from "../lib/contexts/ConfigContext";
import "../styles/globals.css";
import { Analytics } from "@vercel/analytics/next";

export default function App({
	Component,
	pageProps: { session, ...pageProps },
}) {
	return (
		<SessionProvider session={session}>
			<ConfigProvider>
				<Component {...pageProps} />
				<Analytics />
			</ConfigProvider>
		</SessionProvider>
	);
}
