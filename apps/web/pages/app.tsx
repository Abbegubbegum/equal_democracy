import type { GetServerSidePropsContext } from "next";
import Head from "next/head";
import Link from "next/link";

// ── Store links — update these as tracks go live, no app rebuild needed ──
// The QR code baked into the mobile app points at this page, so changing
// where users land only ever requires editing/redeploying this file.
const PLAY_URL =
  "https://play.google.com/store/apps/details?id=se.vallentunaframat.app";
// App Store URL — no region prefix so Apple routes each visitor to their own
// storefront. App ID 6781031191.
const APP_STORE_URL = "https://apps.apple.com/app/id6781031191";

const BLUE = "#002d75";
const YELLOW = "#f5a623";

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const ua = (ctx.req.headers["user-agent"] || "").toLowerCase();
  const isAndroid = ua.includes("android");
  const isIOS = /iphone|ipad|ipod/.test(ua);

  if (isAndroid) {
    return { redirect: { destination: PLAY_URL, permanent: false } };
  }
  if (isIOS && APP_STORE_URL) {
    return { redirect: { destination: APP_STORE_URL, permanent: false } };
  }

  // Desktop, or iOS before the App Store listing is live: render the landing.
  return { props: { iosPending: isIOS } };
}

export default function AppDownloadPage({
  iosPending,
}: {
  iosPending: boolean;
}) {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-12"
      style={{
        background: "linear-gradient(to bottom right, #002d75, #001c55)",
      }}
    >
      <Head>
        <title>Ladda ner appen · Vallentuna Framåt</title>
        <meta
          name="description"
          content="Ladda ner appen Vallentuna Framåt och var med och påverka din kommun."
        />
      </Head>

      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-bold text-white">Vallentuna Framåt</h1>
        <p className="mt-3 text-lg" style={{ color: "rgba(255,255,255,0.75)" }}>
          Ladda ner appen och var med och påverka din kommun.
        </p>

        <div className="mt-8 space-y-3">
          <a
            href={PLAY_URL}
            className="block w-full px-6 py-4 rounded-xl font-semibold"
            style={{ backgroundColor: YELLOW, color: BLUE }}
          >
            Ladda ner för Android
          </a>

          {APP_STORE_URL ? (
            <a
              href={APP_STORE_URL}
              className="block w-full px-6 py-4 rounded-xl font-semibold bg-white"
              style={{ color: BLUE }}
            >
              Ladda ner för iPhone
            </a>
          ) : (
            <div
              className="w-full px-6 py-4 rounded-xl font-medium"
              style={{
                backgroundColor: "rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.7)",
              }}
            >
              iPhone-versionen kommer snart
            </div>
          )}
        </div>

        {iosPending && (
          <p
            className="mt-4 text-sm"
            style={{ color: "rgba(255,255,255,0.6)" }}
          >
            iOS-appen är inte släppt än. Lägg till sidan som bokmärke så hör du
            av oss.
          </p>
        )}

        <div className="mt-10">
          <Link
            href="/"
            className="text-sm underline"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            Till webbplatsen →
          </Link>
        </div>
      </div>
    </div>
  );
}
