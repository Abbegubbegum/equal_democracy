import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Archive } from "lucide-react";
import { useTranslation } from "../lib/hooks/useTranslation";
import { useConfig } from "../lib/contexts/ConfigContext";
export default function AboutPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { t } = useTranslation();
  useConfig();

  return (
    <div
      className="min-h-screen"
      style={{
        background: "linear-gradient(to bottom right, #002d75, #001c55)",
      }}
    >
      {/* Header */}
      <header className="p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">
                {t("about.title")}
              </h1>
              <p className="mt-2" style={{ color: "rgba(255,255,255,0.7)" }}>
                {t("about.subtitle")}
              </p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <Link
                href="/archive"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium text-white border border-white/25 bg-white/10 hover:bg-white/20 transition-colors"
              >
                <Archive className="w-4 h-4" /> Arkiv
              </Link>
              <Link
                href="/"
                className="px-4 py-2 rounded-lg font-medium"
                style={{ backgroundColor: "#f5a623", color: "#002d75" }}
              >
                {t("common.backToStart")}
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 pb-12">
        <div className="bg-white rounded-2xl shadow-md p-8 space-y-6">
          {/* Introduction */}
          <section>
            <h2
              className="text-2xl font-bold mb-4"
              style={{ color: "#002d75" }}
            >
              {t("about.whatIs")}
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {t("about.introduction")}
            </p>
          </section>

          {/* How it works */}
          <section>
            <h2
              className="text-2xl font-bold mb-4"
              style={{ color: "#002d75" }}
            >
              {t("about.howItWorks")}
            </h2>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div
                  className="w-10 h-10 text-white rounded-full flex items-center justify-center shrink-0 font-bold"
                  style={{ backgroundColor: "#002d75" }}
                >
                  1
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 mb-1">
                    {t("about.phase1Title")}
                  </h3>
                  <p className="text-gray-700">
                    {t("about.phase1Description")}
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div
                  className="w-10 h-10 text-white rounded-full flex items-center justify-center shrink-0 font-bold"
                  style={{ backgroundColor: "#002d75" }}
                >
                  2
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 mb-1">
                    {t("about.phase2Title")}
                  </h3>
                  <p className="text-gray-700">
                    {t("about.phase2Description")}
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div
                  className="w-10 h-10 text-white rounded-full flex items-center justify-center shrink-0 font-bold"
                  style={{ backgroundColor: "#002d75" }}
                >
                  3
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 mb-1">
                    {t("about.phase3Title")}
                  </h3>
                  <p className="text-gray-700">
                    {t("about.phase3Description")}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Key features */}
          <section>
            <h2
              className="text-2xl font-bold mb-4"
              style={{ color: "#002d75" }}
            >
              {t("about.keyFeatures")}
            </h2>
            <ul className="space-y-3">
              <li className="flex gap-3">
                <span className="text-xl" style={{ color: "#f5a623" }}>
                  ✓
                </span>
                <span className="text-gray-700">{t("about.feature1")}</span>
              </li>
              <li className="flex gap-3">
                <span className="text-xl" style={{ color: "#f5a623" }}>
                  ✓
                </span>
                <span className="text-gray-700">{t("about.feature2")}</span>
              </li>
              <li className="flex gap-3">
                <span className="text-xl" style={{ color: "#f5a623" }}>
                  ✓
                </span>
                <span className="text-gray-700">{t("about.feature3")}</span>
              </li>
              <li className="flex gap-3">
                <span className="text-xl" style={{ color: "#f5a623" }}>
                  ✓
                </span>
                <span className="text-gray-700">{t("about.feature4")}</span>
              </li>
              <li className="flex gap-3">
                <span className="text-xl" style={{ color: "#f5a623" }}>
                  ✓
                </span>
                <span className="text-gray-700">{t("about.feature5")}</span>
              </li>
            </ul>
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
              <Link
                href="/legal"
                className="text-sm underline block"
                style={{ color: "#002d75" }}
              >
                Integritetspolicy &amp; Användarvillkor →
              </Link>
              <p className="text-xs text-gray-500">
                Om bilder: en del bilder i appen är riktiga fotografier, andra
                är AI-genererade.
              </p>
            </div>
          </section>

          {/* Call to action */}
          <section
            className="rounded-xl p-6 mt-8"
            style={{ backgroundColor: "#f0f4ff" }}
          >
            <h2
              className="text-2xl font-bold mb-4"
              style={{ color: "#002d75" }}
            >
              {t("about.getInvolved")}
            </h2>
            <p className="text-gray-700 mb-4">
              {t("about.getInvolvedDescription")}
            </p>
            {!session && (
              <button
                onClick={() => router.push("/login")}
                className="text-white px-6 py-3 rounded-xl font-medium transition-colors"
                style={{ backgroundColor: "#002d75" }}
              >
                {t("about.joinNow")}
              </button>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
