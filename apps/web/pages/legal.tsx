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
              Senast uppdaterad: 21 augusti 2026
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
                    [
                      "Kod som identifierar ditt konto",
                      "Räknas fram ur ditt personnummer när du loggar in med BankID. Den är det som gör att du kommer tillbaka till samma konto — och att en person bara kan ha ett konto",
                    ],
                    [
                      "Namn",
                      "Förnamn och efternamn från BankID, visas i appen",
                    ],
                    [
                      "Utfallet av folkbokföringskontrollen",
                      "Om du är röstberättigad i Vallentuna, och varför inte om du inte är det",
                    ],
                    [
                      "E-postadress",
                      "Frivillig kontaktuppgift. Du loggar aldrig in med den — den kan läggas till och tas bort när du vill",
                    ],
                    ["Röster och förslag", "Demokratiskt deltagande"],
                    ["Intresseområden", "Anpassa notiser och innehåll"],
                    ["Push-notis-token", "Skicka aviseringar till din enhet"],
                    ["Telefonnummer", "SMS-notiser (valfritt)"],
                    [
                      "Medlemskap i partiet",
                      "Om du betalat medlemsavgift och vilka år den täcker. Uppgift om partimedlemskap är en känslig personuppgift — se punkt 3",
                    ],
                    [
                      "Betalningsuppgifter (Swish)",
                      "Belopp, tidpunkt, status och Swish betalningsreferens samt det telefonnummer som betalade — krävs för att genomföra och bokföra medlemsavgiften",
                    ],
                    [
                      "IP-adress",
                      "Säkerhet och felsökning. Vid inloggning sparas dessutom en envägskodad (hashad) IP-adress i högst 7 dagar, för att begränsa antalet BankID-beställningar",
                    ],
                    [
                      "Anonym användningsstatistik",
                      "Förbättra appen (t.ex. antal appöppningar) – kan inte kopplas till dig",
                    ],
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
              <strong>Du kan läsa hela appen utan konto.</strong> Frågor,
              resultat, debatter, förslag, budgetar och kallelser är öppna för
              alla. Vi samlar inte in något om dig förrän du loggar in.
            </p>
            <p className="text-gray-600 text-sm leading-relaxed mt-2">
              <strong>Du loggar in med BankID.</strong> Det är enda sättet att
              skapa och öppna ett konto. Vid inloggningen hämtar vi din
              folkbokföring från SPAR för att kontrollera att du har fyllt 16 år
              och är folkbokförd i Vallentuna kommun — så att du får veta direkt
              vad du kan göra, i stället för först när du försöker rösta.
            </p>
            <p className="text-gray-600 text-sm leading-relaxed mt-2">
              <strong>Varje röst signeras med BankID.</strong> När du röstar
              signerar du texten &quot;Du röstar JA/NEJ på …&quot; med ditt
              BankID, och folkbokföringen kontrolleras igen i samma stund.
            </p>
            <p className="text-gray-600 text-sm leading-relaxed mt-2">
              <strong>Vi sparar inte ditt personnummer.</strong> Vi sparar
              varken adress, kommun eller födelsedatum från SPAR — bara utfallet
              av kontrollen och ditt namn. Däremot sparar vi två kryptografiska
              koder som räknas fram ur ditt personnummer. Ingen av dem går att
              räkna tillbaka till personnumret:
            </p>
            <ul className="list-disc pl-5 text-gray-600 text-sm leading-relaxed mt-2 space-y-1">
              <li>
                <strong>En kod per konto.</strong> Den är densamma varje gång du
                loggar in, för det är så vi vet att det är ditt konto du kommer
                tillbaka till. Den gör också att en person bara kan ha ett
                konto.
              </li>
              <li>
                <strong>En kod per fråga och röst.</strong> Den ser till att
                samma person inte röstar två gånger i samma fråga, ens med flera
                konton. Den är unik för varje fråga, så den kan inte användas
                för att följa hur du röstat över tid.
              </li>
            </ul>
            <p className="text-gray-600 text-sm leading-relaxed mt-2">
              När en fråga stängs tas kopplingen mellan dig och din röst bort
              helt. Ett publicerat resultat är därefter anonyma uppgifter.
            </p>

            <h3 className="font-bold text-gray-800 mt-6 mb-2">
              3. Rättslig grund
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Vi behandlar dina uppgifter med stöd av{" "}
              <strong>berättigat intresse</strong> (demokratiskt deltagande i
              lokalpolitiken samt anonym användningsstatistik för att förbättra
              appen), <strong>samtycke</strong> (push-notiser, SMS),{" "}
              <strong>avtal</strong> (ditt medlemskap och betalningen av
              medlemsavgiften) och <strong>rättslig förpliktelse</strong>{" "}
              (bokföring av inbetalda medlemsavgifter).
            </p>
            <p className="text-gray-600 text-sm leading-relaxed mt-2">
              <strong>Känsliga personuppgifter.</strong> Uppgift om att du är
              medlem i ett politiskt parti — och hur du röstat, så länge en
              fråga är öppen — räknas som en känslig personuppgift enligt
              artikel 9 i GDPR, eftersom den kan avslöja politisk åsikt. Vi
              behandlar den med stöd av <strong>artikel 9.2 d</strong>: en
              ideell förening med politiskt syfte får behandla sådana uppgifter
              om sina egna medlemmar. Vi lämnar aldrig ut dem till någon utanför
              föreningen. Röster anonymiseras när frågan stängs.
            </p>

            <h3 className="font-bold text-gray-800 mt-6 mb-2">
              4. Hur länge sparar vi uppgifterna
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Ditt konto och alla tillhörande uppgifter sparas så länge du är
              aktiv användare. Du kan när som helst begära radering (se punkt
              7).
            </p>
            <p className="text-gray-600 text-sm leading-relaxed mt-2">
              <strong>Röster och BankID.</strong> Uppgifterna om en enskild
              signering — bland annat en kontrollsumma av signaturen — raderas
              automatiskt efter 30 dagar. När en fråga stängs anonymiseras
              rösterna: kopplingen till ditt konto och den kryptografiska koden
              tas bort permanent, så att resultatet inte längre går att härleda
              till någon enskild person. Det innebär också att ett stängt
              resultat inte kan ändras i efterhand om ett konto raderas.
            </p>
            <p className="text-gray-600 text-sm leading-relaxed mt-2">
              <strong>Inloggningar.</strong> Uppgifterna om ett enskilt
              inloggningsförsök — inklusive den hashade IP-adressen — raderas
              automatiskt efter 7 dagar. Engångskoder till e-post raderas efter
              10 minuter.
            </p>
            <p className="text-gray-600 text-sm leading-relaxed mt-2">
              <strong>Undantag för betalningar.</strong> En inbetald
              medlemsavgift är räkenskapsinformation och måste enligt
              bokföringslagen sparas i sju år. Om du raderar ditt konto tas
              därför inte själva betalningsposten bort, men vi rensar det
              telefonnummer som betalade så att det som finns kvar är belopp,
              tidpunkt och betalningsreferens.
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
                <strong>Expo</strong> — push-notiser (Expo Push API) samt anonym
                användningsstatistik för mobilappen (Expo Insights)
              </li>
              <li>
                <strong>Anthropic (Claude)</strong> — AI-moderering av
                kommentarer och förslag
              </li>
              <li>
                <strong>Twilio</strong> — SMS-notiser (om du valt det)
              </li>
              <li>
                <strong>Svensk e-identitet AB</strong> — förmedlar inloggning
                och signering med BankID. De hanterar ditt personnummer och
                hämtar folkbokföringen från SPAR åt oss. Vi sparar inte
                personnumret.
              </li>
              <li>
                <strong>Getswish AB</strong> — hantering av medlemsavgift via
                Swish. Vi tar aldrig emot eller lagrar dina kontouppgifter; de
                hanteras av Swish och din bank.
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

            <h3 className="font-bold text-gray-800 mt-6 mb-2">
              6. Medlemskap och avgift
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Medlemsavgiften är 250 kr och betalas med Swish i appen. Som
              erbjudande till dig som går med tidigt täcker avgiften både 2026
              och 2027 — du betalar en gång och är medlem i två år. Medlemskapet
              är personligt och kan inte överlåtas.
            </p>
            <p className="text-gray-600 text-sm leading-relaxed mt-2">
              Betalningen hanteras av Swish och din bank. Vi tar aldrig emot
              eller lagrar dina kontouppgifter — vi ser bara att betalningen
              genomförts, vilket belopp det gällde och vilket telefonnummer som
              betalade.
            </p>
            <p className="text-gray-600 text-sm leading-relaxed mt-2">
              <strong>Ångra betalning.</strong> Vill du ångra ditt medlemskap,
              kontakta oss inom 14 dagar från betalningen på{" "}
              <a
                href="mailto:kontakt@vallentunaframat.se"
                className="text-[#002d75] underline"
              >
                kontakt@vallentunaframat.se
              </a>{" "}
              så betalar vi tillbaka avgiften. Du kan när som helst lämna
              partiet genom att radera ditt konto, men avgiften för den period
              som redan påbörjats återbetalas inte efter ångerfristen.
            </p>

            <h3 className="font-bold text-gray-800 mt-6 mb-2">7. Ändringar</h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Vi kan uppdatera dessa villkor. Väsentliga ändringar meddelas via
              appen eller e-post.
            </p>

            <h3 className="font-bold text-gray-800 mt-6 mb-2">8. Kontakt</h3>
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

            <h3 className="font-bold text-gray-800 mt-6 mb-2">
              8. Källkod (öppen källkod)
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Den här tjänsten är fri programvara, licensierad under{" "}
              <a
                href="https://www.gnu.org/licenses/agpl-3.0.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#002d75] underline"
              >
                GNU AGPL-3.0
              </a>
              . Du har rätt att ta del av, granska och återanvända källkoden:{" "}
              <a
                href="https://github.com/Abbegubbegum/equal_democracy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#002d75] underline"
              >
                github.com/Abbegubbegum/equal_democracy
              </a>
              .
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
