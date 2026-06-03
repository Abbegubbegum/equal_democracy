import Head from "next/head";
import Link from "next/link";

export default function LegalPage() {
  return (
    <>
      <Head>
        <title>Integritetspolicy & Användarvillkor – Vallentuna Framåt</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="min-h-screen bg-white">
        <div className="max-w-2xl mx-auto px-5 py-10">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-black text-[#002d75]">
              Vallentuna Framåt
            </h1>
            <p className="text-gray-500 text-sm mt-1">Juridisk information</p>
          </div>

          {/* Nav */}
          <div className="flex gap-3 mb-10 flex-wrap">
            <a
              href="#integritet"
              className="text-sm bg-[#002d75] text-white px-4 py-2 rounded-full"
            >
              Integritetspolicy
            </a>
            <a
              href="#villkor"
              className="text-sm border border-[#002d75] text-[#002d75] px-4 py-2 rounded-full"
            >
              Användarvillkor
            </a>
          </div>

          {/* INTEGRITETSPOLICY */}
          <section id="integritet" className="mb-16">
            <h2 className="text-xl font-bold text-[#002d75] border-b-2 border-[#002d75] pb-2 mb-1">
              Integritetspolicy
            </h2>
            <p className="text-xs text-gray-400 mb-6">
              Senast uppdaterad: 2 juni 2026
            </p>

            <h3 className="font-bold text-gray-800 mt-6 mb-2">
              1. Personuppgiftsansvarig
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Vallentuna Framåt
              <br />
              Organisationsnummer: 802555-8852
              <br />
              c/o Norbäck, Björkhagsvägen 75 D, 186 35 Vallentuna
              <br />
              <a
                href="mailto:kontakt@vallentunaframat.se"
                className="text-[#002d75] underline"
              >
                kontakt@vallentunaframat.se
              </a>
            </p>

            <h3 className="font-bold text-gray-800 mt-6 mb-2">
              2. Vilka uppgifter vi samlar in
            </h3>
            <div className="overflow-x-auto rounded-lg border border-gray-200 mb-3">
              <table className="w-full text-sm">
                <thead className="bg-blue-50">
                  <tr>
                    <th className="text-left px-4 py-2 text-[#002d75] font-semibold">
                      Uppgift
                    </th>
                    <th className="text-left px-4 py-2 text-[#002d75] font-semibold">
                      Syfte
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[
                    ["E-postadress", "Inloggning via engångskod"],
                    ["Namn", "Visning i appen"],
                    ["Röster och förslag", "Demokratiskt deltagande"],
                    ["Intresseområden", "Anpassa notiser och innehåll"],
                    ["Push-notis-token", "Skicka aviseringar till din enhet"],
                    ["Telefonnummer", "SMS-notiser (valfritt)"],
                    ["IP-adress", "Säkerhet och felsökning"],
                  ].map(([k, v]) => (
                    <tr key={k}>
                      <td className="px-4 py-2 font-medium text-gray-700">
                        {k}
                      </td>
                      <td className="px-4 py-2 text-gray-500">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-gray-600 text-sm leading-relaxed">
              Vi samlar <strong>inte</strong> in personnummer i nuläget. Efter
              valet, om Vallentuna Framåt får mandat, kommer e-legitimation
              (BankID) att krävas för att verifiera att du är folkbokförd i
              Vallentuna.
            </p>

            <h3 className="font-bold text-gray-800 mt-6 mb-2">
              3. Rättslig grund
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Vi behandlar dina uppgifter med stöd av{" "}
              <strong>berättigat intresse</strong> (demokratiskt deltagande i
              lokalpolitiken) och <strong>samtycke</strong> (push-notiser, SMS).
            </p>

            <h3 className="font-bold text-gray-800 mt-6 mb-2">
              4. Hur länge sparar vi uppgifterna
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Ditt konto och alla tillhörande uppgifter sparas så länge du är
              aktiv användare. Du kan när som helst begära radering (se punkt
              7).
            </p>

            <h3 className="font-bold text-gray-800 mt-6 mb-2">
              5. Tredjeparter vi delar data med
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed mb-2">
              Vi använder följande underleverantörer, alla med GDPR-anpassade
              avtal:
            </p>
            <ul className="text-sm text-gray-600 space-y-1 pl-4 list-disc">
              <li>
                <strong>MongoDB Atlas</strong> — databaslagring
              </li>
              <li>
                <strong>Vercel</strong> — webbhotell och API
              </li>
              <li>
                <strong>Resend</strong> — utskick av inloggningskoder via e-post
              </li>
              <li>
                <strong>Expo / Expo Push API</strong> — push-notiser till
                mobilappen
              </li>
              <li>
                <strong>Anthropic (Claude)</strong> — AI-moderering av
                kommentarer och förslag
              </li>
              <li>
                <strong>Twilio</strong> — SMS-notiser (om du valt det)
              </li>
            </ul>

            <h3 className="font-bold text-gray-800 mt-6 mb-2">
              6. Överföring utanför EU/EES
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Flera av ovanstående leverantörer är amerikanska företag.
              Överföringen sker med stöd av EU:s standardavtalsklausuler (SCC).
            </p>

            <h3 className="font-bold text-gray-800 mt-6 mb-2">
              7. Dina rättigheter
            </h3>
            <ul className="text-sm text-gray-600 space-y-1 pl-4 list-disc mb-3">
              <li>Begära ut en kopia av dina uppgifter</li>
              <li>Begära rättelse av felaktiga uppgifter</li>
              <li>Begära radering av ditt konto och alla uppgifter</li>
              <li>Invända mot behandling</li>
              <li>
                Lämna klagomål till <strong>IMY</strong> på{" "}
                <a
                  href="https://www.imy.se"
                  className="text-[#002d75] underline"
                >
                  imy.se
                </a>
              </li>
            </ul>
            <p className="text-gray-600 text-sm">
              Kontakta oss på{" "}
              <a
                href="mailto:kontakt@vallentunaframat.se"
                className="text-[#002d75] underline"
              >
                kontakt@vallentunaframat.se
              </a>
              .
            </p>
          </section>

          {/* ANVÄNDARVILLKOR */}
          <section id="villkor">
            <h2 className="text-xl font-bold text-[#002d75] border-b-2 border-[#002d75] pb-2 mb-1">
              Användarvillkor
            </h2>
            <p className="text-xs text-gray-400 mb-6">
              Senast uppdaterad: 2 juni 2026
            </p>

            <h3 className="font-bold text-gray-800 mt-6 mb-2">1. Om appen</h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Vallentuna Framåt är en demokratiplattform där partiets medlemmar
              och sympatisörer fattar politiska beslut gemensamt. Appen låter
              dig rösta i frågor, lämna förslag och delta i politisk debatt.
            </p>

            <h3 className="font-bold text-gray-800 mt-6 mb-2">
              2. Vem får använda appen
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed mb-2">
              <strong>Fram till valet</strong> är appen öppen för alla svenska
              medborgare som vill utforska och pröva plattformen.
            </p>
            <p className="text-gray-600 text-sm leading-relaxed mb-2">
              <strong>Efter valet</strong>, om Vallentuna Framåt erhåller
              mandat, gäller följande för rösträtt:
            </p>
            <ul className="text-sm text-gray-600 space-y-1 pl-4 list-disc">
              <li>Du måste vara folkbokförd i Vallentuna kommun</li>
              <li>Du måste vara minst 16 år</li>
              <li>Verifiering med e-legitimation (BankID) är obligatorisk</li>
            </ul>

            <h3 className="font-bold text-gray-800 mt-6 mb-2">
              3. Demokratiska beslut och ansvar
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed mb-2">
              Vallentuna Framåt fattar sina politiska beslut genom röstning i
              appen. Röstresultaten är bindande för partiets agerande — det är
              principen bakom delegerat beslutsfattande. De som röstar via appen{" "}
              <em>är</em> Vallentuna Framåt.
            </p>
            <p className="text-gray-600 text-sm leading-relaxed">
              Vi ansvarar inte för tekniska avbrott eller dataförlust som
              påverkar möjligheten att rösta. Vid tekniska problem kan
              omröstning hållas på nytt.
            </p>

            <h3 className="font-bold text-gray-800 mt-6 mb-2">
              4. Regler för innehåll
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed mb-2">
              Du ansvarar för allt innehåll du publicerar. Det är{" "}
              <strong>inte tillåtet</strong> att:
            </p>
            <ul className="text-sm text-gray-600 space-y-1 pl-4 list-disc mb-3">
              <li>Hota, trakassera eller kränka andra användare</li>
              <li>Sprida falsk information</li>
              <li>Publicera olagligt material</li>
              <li>Använda appen i kommersiellt syfte</li>
            </ul>
            <p className="text-gray-600 text-sm leading-relaxed">
              Vi förbehåller oss rätten att ta bort innehåll som bryter mot
              dessa regler, med eller utan förvarning.
            </p>

            <h3 className="font-bold text-gray-800 mt-6 mb-2">
              5. AI-moderering
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Kommentarer och förslag kan granskas automatiskt med hjälp av AI
              (Anthropic Claude) för att identifiera olämpligt innehåll.
              AI-granskning ersätter inte mänsklig bedömning.
            </p>

            <h3 className="font-bold text-gray-800 mt-6 mb-2">6. Ändringar</h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Vi kan uppdatera dessa villkor. Väsentliga ändringar meddelas via
              appen eller e-post.
            </p>

            <h3 className="font-bold text-gray-800 mt-6 mb-2">7. Kontakt</h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              <a
                href="mailto:kontakt@vallentunaframat.se"
                className="text-[#002d75] underline"
              >
                kontakt@vallentunaframat.se
              </a>
              <br />
              Vallentuna Framåt, org.nr 802555-8852
              <br />
              c/o Norbäck, Björkhagsvägen 75 D, 186 35 Vallentuna
            </p>
          </section>

          <div className="mt-12 pt-6 border-t border-gray-100 text-center">
            <Link href="/" className="text-sm text-[#002d75] underline">
              ← Tillbaka till appen
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
