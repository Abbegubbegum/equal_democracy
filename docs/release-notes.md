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
§1 is what to paste if you ever do publish 1.2.2 on its own.

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
