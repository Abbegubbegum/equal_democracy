import { SessionProvider } from "next-auth/react";
import { ConfigProvider } from "../lib/contexts/ConfigContext";
import LinkGate from "../components/LinkGate";
import "../styles/globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

export default function App({
  Component,
  pageProps: { session, ...pageProps },
}) {
  return (
    <SessionProvider session={session}>
      <ConfigProvider>
        <Component {...pageProps} />
        {/* Mounted app-wide rather than per page: a legacy email account has to
            meet it wherever it lands, including on a link straight into a
            session or the archive. It renders nothing unless that account
            actually needs BankID. */}
        <LinkGate />
        <Analytics />
        <SpeedInsights />
      </ConfigProvider>
    </SessionProvider>
  );
}
