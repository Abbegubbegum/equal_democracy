import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { ArrowLeft, ChevronRight, Archive } from "lucide-react";
import Link from "next/link";
import { useConfig } from "../../lib/contexts/ConfigContext";

const VALID_MUNICIPALITIES = ["vallentuna"];

export async function getServerSideProps({ params }) {
  if (!VALID_MUNICIPALITIES.includes(params.municipality)) {
    return { notFound: true };
  }
  return { props: {} };
}

const BOARD_INFO = {
  kommunfullmaktige: {
    name: "Kommunfullmäktige",
    description: "Kommunens högsta beslutande organ",
    icon: "🏛️",
  },
  kommunstyrelsen: {
    name: "Kommunstyrelsen",
    description: "Kommunens ledande förvaltningsorgan",
    icon: "💼",
  },
  "barn-och-ungdomsnamnden": {
    name: "Barn- och ungdomsnämnden",
    description: "Förskola, grundskola och fritidsverksamhet",
    icon: "👶",
  },
  socialnamnden: {
    name: "Socialnämnden",
    description: "Omsorg och stöd till medborgare",
    icon: "🤝",
  },
  "bygg-och-miljotillsynsnamnden": {
    name: "Bygg- och miljötillsynsnämnden",
    description: "Bygglov, miljötillsyn och samhällsplanering",
    icon: "🏗️",
  },
};

export default function MunicipalityPage() {
  const router = useRouter();
  const { municipality } = router.query;
  const { data: session, status } = useSession();
  const { theme } = useConfig();
  const [availableBoards, setAvailableBoards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.replace("/login");
      return;
    }
    if (municipality) {
      fetchAvailableBoards();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session, municipality, router]);

  const fetchAvailableBoards = async () => {
    try {
      const res = await fetch(
        `/api/municipal/sessions?municipality=${municipality}&status=active`,
      );
      const data = await res.json();
      const sessions = data.sessions || [];
      const boards = new Set<string>();
      sessions.forEach((municipalSession) => {
        const boardSlug = municipalSession.meetingType
          .toLowerCase()
          .replace(/å/g, "a")
          .replace(/ä/g, "a")
          .replace(/ö/g, "o")
          .replace(/ /g, "-");
        boards.add(boardSlug);
      });
      const boardList = Array.from(boards).map((boardSlug) => ({
        slug: boardSlug,
        ...BOARD_INFO[boardSlug],
      }));
      setAvailableBoards(boardList);
    } catch (error) {
      console.error("Error fetching boards:", error);
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || loading || !municipality) {
    return (
      <div className="min-h-screen bg-[#f7f8fb] flex items-center justify-center">
        <div className="text-xl text-gray-500">Laddar…</div>
      </div>
    );
  }

  const primaryColor = theme?.colors?.primary?.[600] || "#002d75";
  const primaryDark = theme?.colors?.primary?.[800] || "#001c55";

  return (
    <div className="min-h-screen bg-[#f7f8fb]">
      <header
        className="text-white px-4 sm:px-6 pt-5 pb-8 shadow-lg"
        style={{
          background: `linear-gradient(to right, ${primaryColor}, ${primaryDark})`,
        }}
      >
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <img
                src="/app-icon-tight.svg"
                alt=""
                className="h-9 w-auto shrink-0"
              />
              <div className="leading-none">
                <div className="text-base font-black tracking-widest text-white">
                  VALLENTUNA
                </div>
                <div className="text-xs font-extrabold text-white mt-0.5">
                  Framåt
                </div>
              </div>
            </div>
            <button
              onClick={() => router.push("/")}
              className="inline-flex items-center gap-1.5 text-white/85 hover:text-accent-400 text-sm font-semibold whitespace-nowrap transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Till startsidan
            </button>
          </div>
          <h1 className="mt-6 text-2xl sm:text-3xl font-black tracking-tight capitalize">
            {municipality} kommun
          </h1>
          <p className="mt-1 text-primary-100 text-sm sm:text-base">
            Nämnder och beslutsorgan med aktiva frågor.
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {availableBoards.length === 0 ? (
          <div className="bg-white rounded-card border border-black/5 p-10 text-center">
            <div className="text-5xl mb-3">🏛️</div>
            <h2 className="text-lg font-extrabold text-gray-800 mb-1">
              Inga aktiva nämnder
            </h2>
            <p className="text-gray-500 text-sm">
              Det finns inga aktiva nämnder just nu.
            </p>
          </div>
        ) : (
          <>
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-primary-600 mb-3">
              Välj nämnd
            </div>
            <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
              {availableBoards.map((board) => (
                <Link
                  key={board.slug}
                  href={`/${municipality}/${board.slug}`}
                  className="group bg-white rounded-card border border-black/5 shadow-[0_8px_22px_-18px_rgba(0,20,64,0.45)] p-5 flex items-start gap-4 transition-all duration-100 hover:-translate-y-0.5 hover:shadow-[0_16px_30px_-18px_rgba(0,20,64,0.5)]"
                >
                  <div className="text-3xl shrink-0">{board.icon || "📋"}</div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-extrabold text-gray-800">
                      {board.name ||
                        board.slug
                          .replace(/-/g, " ")
                          .replace(/\b\w/g, (l) => l.toUpperCase())}
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {board.description || "Kommunalt beslutsorgan"}
                    </p>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary-600 mt-2">
                      Visa aktiva frågor
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        <Link
          href="/archive"
          className="mt-6 flex items-center gap-3 bg-white rounded-card border border-black/5 p-4 hover:bg-[#fafbfe] transition-colors"
        >
          <span className="w-10 h-10 rounded-[11px] bg-[#f1f4fa] grid place-items-center shrink-0">
            <Archive className="w-5 h-5 text-primary-600" />
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-800 text-sm">
              Arkiverade beslut
            </h3>
            <p className="text-xs text-gray-500">
              Alla avslutade frågor och beslut
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
        </Link>
      </main>
    </div>
  );
}
