import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { ArrowLeft } from "lucide-react";
import { useConfig } from "../lib/contexts/ConfigContext";

/**
 * "Hantera innehåll" — branching hub for admins.
 * Two equal branches: Frågor (appens Hem-flik → /manage-questions) and
 * Förslag (appens Förslag-flik → /manage-proposals). The two-phase live
 * sessions live under the Admin dashboard now, not here.
 */
export default function ManageContentPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { theme } = useConfig();

  const [questionCount, setQuestionCount] = useState<number | null>(null);
  const [proposalCount, setProposalCount] = useState<number | null>(null);

  useEffect(() => {
    if (status === "loading") return;
    if (!session) router.replace("/login");
    else if (!session.user?.isAdmin && !session.user?.isSuperAdmin)
      router.replace("/");
  }, [status, session, router]);

  // Best-effort live counts for the branch chips — hidden if unavailable.
  useEffect(() => {
    if (!session?.user?.isAdmin && !session?.user?.isSuperAdmin) return;

    (async () => {
      try {
        const res = await fetch("/api/admin/questions");
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : data.questions || [];
          setQuestionCount(
            list.filter((q) => q.status === "active" || q.isActive).length,
          );
        }
      } catch {
        /* leave null */
      }

      try {
        const res = await fetch("/api/admin/citizen-proposals");
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : data.proposals || [];
          setProposalCount(list.length);
        }
      } catch {
        /* leave null */
      }
    })();
  }, [session]);

  if (status === "loading") return <div className="p-8">Laddar…</div>;
  if (!session?.user?.isAdmin && !session?.user?.isSuperAdmin) return null;

  const primaryColor = theme?.colors?.primary?.[600] || "#002d75";
  const primaryDark = theme?.colors?.primary?.[800] || "#001c55";

  return (
    <div className="min-h-screen bg-[#f7f8fb]">
      {/* Header */}
      <header
        className="text-white px-4 sm:px-6 pt-5 pb-8 shadow-lg"
        style={{
          background: `linear-gradient(to right, ${primaryColor}, ${primaryDark})`,
        }}
      >
        <div className="max-w-4xl mx-auto">
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
          <h1 className="mt-6 text-2xl sm:text-3xl font-black tracking-tight">
            Hantera innehåll
          </h1>
          <p className="mt-1 text-primary-100 text-sm sm:text-base">
            Skapa och redigera det medborgarna möter – i appen och på webben.
          </p>
        </div>
      </header>

      {/* Branches */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="text-xs font-bold uppercase tracking-[0.14em] text-primary-600 mb-4">
          Välj vad du vill hantera
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          <BranchCard
            icon="📱"
            iconBg="#e7edfb"
            title="Frågor"
            route="Appens Hem-flik · /manage-questions"
            description={
              <>
                Ja/Nej-frågor som du skapar och medborgarna röstar på i appens{" "}
                <b>Hem</b>-flik. Ny fråga med deadline, bild och kategorier –
                redigera eller stäng pågående.
              </>
            }
            liveCount={questionCount}
            liveLabel="aktiva"
            staticChip="Push vid ny fråga"
            primaryLabel="Öppna"
            onPrimary={() => router.push("/manage-questions")}
            secondaryLabel="+ Ny fråga"
            onSecondary={() => router.push("/manage-questions")}
          />

          <BranchCard
            icon="💡"
            iconBg="#fff4e2"
            title="Förslag"
            route="Appens Förslag-flik · /manage-proposals"
            description={
              <>
                Förslagen som invånarna själva lämnar i appens <b>Förslag</b>
                -flik. Granska, redigera text och kategorier, sätt status och
                lyft fram de bästa.
              </>
            }
            liveCount={proposalCount}
            liveLabel="inkomna"
            staticChip="Invånarnas egna idéer"
            primaryLabel="Öppna"
            onPrimary={() => router.push("/manage-proposals")}
          />

          <BranchCard
            icon="🏛️"
            iconBg="#e7f6ec"
            title="Kallelser"
            route="Kommunmöten · /admin/my-questions/municipal"
            description={
              <>
                Kommunmöten och deras agendapunkter. En publicerad punkt blir en{" "}
                <b>fråga på Hem</b> och arkiveras efter fullmäktiges beslut.
              </>
            }
            staticChip="Blir frågor på Hem"
            primaryLabel="Öppna"
            onPrimary={() => router.push("/admin/my-questions/municipal")}
          />

          <BranchCard
            icon="📊"
            iconBg="#f3e8ff"
            title="Budget"
            route="Budgetsessioner · /admin/my-questions/budget"
            description={
              <>
                Budgetsessioner och kategorier – låt invånarna fördela kommunens
                medel och betygsätta kategorierna.
              </>
            }
            staticChip="Fördela medel"
            primaryLabel="Öppna"
            onPrimary={() => router.push("/admin/my-questions/budget")}
          />
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          🖥️ <b className="text-gray-700 font-semibold">Livesessioner</b>{" "}
          (tvåfas-möten i realtid) finns nu under{" "}
          <b className="text-gray-700 font-semibold">Admin</b>-fliken.
        </p>
      </main>
    </div>
  );
}

function BranchCard({
  icon,
  iconBg,
  title,
  route,
  description,
  liveCount = null,
  liveLabel = null,
  staticChip,
  primaryLabel,
  onPrimary,
  secondaryLabel = null,
  onSecondary = null,
}) {
  return (
    <div className="group flex flex-col bg-white rounded-card border border-black/5 shadow-[0_10px_30px_-22px_rgba(0,20,64,0.5)] p-6 transition-all duration-100 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-22px_rgba(0,20,64,0.5)]">
      <div className="flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-[14px] grid place-items-center text-2xl shrink-0"
          style={{ backgroundColor: iconBg }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold text-gray-800">{title}</h2>
          <div className="text-xs text-gray-400 font-mono truncate">
            {route}
          </div>
        </div>
      </div>

      <p className="mt-4 flex-1 text-sm text-gray-500 leading-relaxed">
        {description}
      </p>

      <div className="flex flex-wrap gap-2 mt-4">
        {liveCount != null && liveCount > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-50 text-green-700">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            {liveCount} {liveLabel}
          </span>
        )}
        {staticChip && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#f1f4fa] text-gray-600">
            {staticChip}
          </span>
        )}
      </div>

      <div className="flex gap-2.5 mt-5">
        <button
          onClick={onPrimary}
          className="font-bold text-sm px-5 py-2.5 rounded-btn bg-accent-400 text-primary-800 hover:bg-accent-500 transition-colors"
        >
          {primaryLabel}
        </button>
        {secondaryLabel && (
          <button
            onClick={onSecondary}
            className="font-bold text-sm px-4 py-2.5 rounded-btn text-primary-600 border border-primary-600/20 hover:bg-primary-600/5 transition-colors"
          >
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  );
}
