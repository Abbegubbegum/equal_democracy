# Release notes ("Vad är nytt")

Pasted by hand after submitting — EAS Submit has no changelog support.
Google Play Console → **Vad är nytt** (sv-SE) · App Store Connect → **What's New in This Version**.

Google Play caps this field at **500 characters**; App Store Connect at 4000.

---

## ⚠️ Which one to use

1.2.2 never reached the public store — builds 6, 7 and 8 were all TestFlight only. Users on the
App Store and Play are still on **1.2.1**, so an upgrade takes them straight to **1.2.3** and they
will never see 1.2.2's notes.

**Use §3 (the combined notes) for the public 1.2.3 release.** §1 and §2 are kept for reference, and
§1 is what to paste if you ever do publish 1.2.2 on its own. For the current release, use the
1.3.0 section above — 1.2.3 did reach the public stores, so nothing has to be carried forward.

---

## Version 1.3.0 — BankID-inloggning ✅ current

1.2.3 **did** reach the public stores, so users upgrade straight from it and these notes only have
to cover 1.3.0.

The first bullet is the one that matters. Everyone already using the app has an email account and
will be asked to connect BankID the next time they open it — if the notes do not say so, that
prompt looks like something has gone wrong.

### Google Play — "Vad är nytt" (sv-SE) · 461 characters

```
Logga in med BankID

• Du loggar nu in med BankID i stället för kod via e-post. Har du ett konto sedan tidigare kopplar du ihop det första gången – dina förslag, röster och ditt medlemskap följer med.
• Du kan läsa hela appen utan att logga in. Konto behövs bara för att rösta, kommentera och lämna förslag.
• Varje röst signeras med BankID, så ingen kan rösta i ditt namn.
• När en fråga stänger anonymiseras rösterna.
• Appen är snabbare och mindre buggfixar.
```

### App Store Connect — "What's New in This Version" (sv-SE)

Same content, room to breathe. Paste this one where the 500-character cap does not apply.

```
Logga in med BankID

Appen använder nu BankID i stället för engångskoder via e-post. Det gör inloggningen enklare och gör att varje röst går att lita på.

• Du loggar in med BankID. Har du använt appen tidigare kopplar du ihop ditt gamla konto första gången du loggar in – dina förslag, röster och ditt medlemskap följer med.
• Du kan läsa hela appen utan att logga in. Frågor, resultat, debatter, förslag och kallelser är öppna för alla. Konto behövs bara för att rösta, kommentera, betygsätta och lämna förslag.
• Varje röst signeras med BankID, så ingen annan kan rösta i ditt namn. Vi sparar inte ditt personnummer.
• Vi kontrollerar samtidigt att du har fyllt 16 år och är folkbokförd i Vallentuna, så att resultaten speglar kommunens invånare.
• När en fråga stänger anonymiseras rösterna. Ett publicerat resultat går inte längre att koppla till någon enskild person.
• Appen är snabbare, långa förslag går att läsa i sin helhet, och ett antal mindre buggar är rättade.
```

### English, if your App Store listing is en-US

```
Sign in with BankID

The app now uses BankID instead of one-time codes by email. Signing in is simpler, and every vote can be trusted.

• You sign in with BankID. If you have used the app before, you connect your old account the first time you sign in — your proposals, votes and membership come with it.
• You can read the whole app without signing in. Questions, results, debates, proposals and agendas are open to everyone. An account is only needed to vote, comment, rate and submit proposals.
• Every vote is signed with BankID, so nobody can vote in your name. We do not store your personal identity number.
• We check at the same time that you are 16 or older and registered as living in Vallentuna, so results reflect the municipality's residents.
• When a question closes, its votes are anonymised. A published result can no longer be traced to any individual.
• The app is faster, long proposals are fully readable, and a number of smaller bugs are fixed.
```

---

## 1. Version 1.2.2 — if released on its own

```
Bli medlem direkt i appen

• Nu kan du betala medlemsavgiften med Swish. Du signerar med BankID och är medlem på några sekunder – avgiften täcker både 2026 och 2027.
• Trycker du på en notis om en ny fråga öppnas den direkt under Rösta, utan att du behöver leta.
• Mindre förbättringar och buggfixar.
```

## 2. Version 1.2.3 — only if 1.2.2 was already public

```
• Appen säger nu till när det finns en nyare version, så att du inte missar nya funktioner eller viktiga rättningar.
• Mindre förbättringar och buggfixar.
```

## 3. Version 1.2.3 — combined ✅ recommended

Covers everything since 1.2.1, which is what users are actually upgrading from.

```
Bli medlem direkt i appen

• Nu kan du betala medlemsavgiften med Swish. Du signerar med BankID och är medlem på några sekunder – avgiften täcker både 2026 och 2027.
• Trycker du på en notis om en ny fråga öppnas den direkt under Rösta, utan att du behöver leta.
• Appen säger till när det finns en nyare version, så att du inte missar något.
• Mindre förbättringar och buggfixar.
```

---

## 4. English, if your App Store listing is en-US

```
Become a member right in the app

• You can now pay the membership fee with Swish. Sign with BankID and you are a member in seconds — the fee covers both 2026 and 2027.
• Tapping a notification about a new question now opens it directly under Rösta.
• The app now tells you when a newer version is available.
• Smaller improvements and bug fixes.
```

---

## Notes on wording

- **No mention of the amount.** The fee is served by the API (`MEMBERSHIP_FEE_SEK`), so it can change
  without a new build — putting a number in the release notes would date them. It also avoids
  advertising the 1 kr test value if that is still set when you publish.
- **The return-from-Swish crash is not mentioned.** It only ever existed in TestFlight build 7; no
  public user experienced it, so it belongs in the commit history, not the store listing.
- **The forced-update ability is described as a courtesy**, not a restriction — "säger till när det
  finns en nyare version". True, and it does not invite the question of why an app would lock you
  out.
- **The BankID switch leads, and the old account is addressed in the same breath.** Every existing
  user will meet a "connect BankID" prompt on their next launch. A release note that does not
  mention it turns a designed step into an apparent fault.
- **"Vi sparar inte ditt personnummer" is stated, not implied.** It is the first question a Swedish
  user asks about BankID, and answering it in the listing is cheaper than answering it in support.
- **No mention of who cannot vote.** The residency and age checks are described by what they are
  for — results that reflect the kommun — rather than as a list of people being turned away.
