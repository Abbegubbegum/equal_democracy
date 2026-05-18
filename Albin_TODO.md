# Albin TO-DO — Från utvecklingsapp till färdig app i App Store & Google Play

Hej Albin! Det här är stegen som återstår för att göra Vallentuna Framåt-appen färdig för lansering.
Appen är byggd med **Expo 54 + Expo Router**, backend på **Next.js / Vercel**, databas på **MongoDB Atlas**.

---

## 1. Sätt produktions-URL

I `apps/mobile/.env`, byt ut LAN-IP mot Vercel-domänen:

```
EXPO_PUBLIC_API_URL=https://din-vercel-domän.vercel.app
```

---

## 2. ✅ Generera app-ikon från SVG

**Klart.** `icon.png`, `adaptive-icon.png`, `splash-icon.png` och `favicon.png` finns redan i `apps/mobile/assets/`.
`app.json` pekar redan rätt och Android-färgen är satt till `#002d75`.

---

## 3. Installera expo-notifications

**Paketet är installerat** (`expo-notifications ^55.0.23` finns i `package.json`).

**Återstår:** Lägg till pluginen i `apps/mobile/app.json` (under `"plugins"`):

```json
[
  "expo-notifications",
  {
    "color": "#002d75"
  }
]
```

> **OBS — ingen `notification-icon.png` behövs:**
> Den röda cirkeln med vit siffra (badge) på appikonen är 100 % inbyggt i iOS och Android — det kräver ingen bild. `notification-icon.png` är enbart den lilla vita ikonen i **Androids statusfält** när en push-notis visas, och Expo faller tillbaka på appikonen om den saknas. Du kan lägga till den senare som en polish-detalj; den blockerar inte lansering.

---

## 4. ✅ Återaktivera notis-koden i appen

**Klart.** Koden är redan på plats i båda filerna:

- `apps/mobile/app/(app)/_layout.tsx` — import, `setNotificationHandler`, push-token-registrering och notis-lyssnare
- `apps/mobile/app/(app)/vote.tsx` — `setBadgeCountAsync(0)` vid tab-fokus

När du har ett riktigt EAS **project-id** (steg 5) behöver du inte ändra något — koden misslyckas tyst i Expo Go men fungerar automatiskt i ett EAS-bygge med `projectId` satt i `app.json`.

---

## 5. Sätt upp EAS (Expo Application Services)

```bash
npm install -g eas-cli
eas login          # logga in med Expo-konto (skapa på expo.dev)
cd apps/mobile
eas init           # kopplar projektet, genererar project-id
```

Kopiera **project-id** från `app.json` och klistra in i notis-koden ovan.

Skapa `apps/mobile/eas.json`:

```json
{
  "cli": { "version": ">= 5.0.0" },
  "build": {
    "preview": {
      "android": { "buildType": "apk" }
    },
    "production": {
      "android": { "buildType": "app-bundle" },
      "ios": {}
    }
  },
  "submit": {
    "production": {}
  }
}
```

---

## 6. Push-notifikationer — servercertifikat

### Android (FCM)

1. Gå till [Firebase Console](https://console.firebase.google.com)
2. Skapa projekt → Android-app → ladda ner `google-services.json`
3. Lägg `google-services.json` i `apps/mobile/`
4. Kör: `eas credentials` och följ guiden för Android

### iOS (APNs)

1. Kräver **Apple Developer-konto** (1 500 kr/år på [developer.apple.com](https://developer.apple.com))
2. Skapa ett APNs-nyckel (p8-fil) i Apple Developer Portal
3. Kör: `eas credentials` och följ guiden för iOS

---

## 7. Testbygge (Android APK — inget butikskonto krävs)

```bash
cd apps/mobile
eas build --profile preview --platform android
```

EAS bygger i molnet (~10 min). Du får en nedladdningslänk till en `.apk` som kan installeras direkt på Android-telefon.

---

## 8. Produktionsbygge

```bash
# Android (.aab för Play Store)
eas build --profile production --platform android

# iOS (.ipa för App Store)
eas build --profile production --platform ios
```

---

## 9. Publicering

### Google Play Store

1. Skapa konto på [play.google.com/console](https://play.google.com/console) (~250 kr engångsavgift)
2. Skapa ny app → fyll i beskrivning, skärmdumpar, sekretesspolicy
3. Ladda upp `.aab`-filen från steg 8
4. Skicka in för granskning (tar 1–3 dagar)

### Apple App Store

1. Kräver Apple Developer-konto (se steg 6)
2. Skapa app på [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
3. Fyll i metadata, skärmdumpar (kräver iPhone-storlekar)
4. Kör: `eas submit --platform ios`
5. Skicka in för granskning (tar 1–7 dagar)

---

## 10. App Store-metadata att förbereda

- **Appnamn:** Vallentuna Framåt
- **Undertitel:** Delta i din kommuns demokrati
- **Beskrivning:** Rösta på lokala frågor, lämna medborgarförslag och följ sessionerna i Vallentuna kommun.
- **Skärmdumpar:** Minst 3 st per enhetsstorlek (iPhone 6.5", iPhone 5.5", iPad om relevant)
- **SekretessPolicy-URL:** Behövs — kan vara en enkel sida på WordPress-sajten
- **Kategori:** Productivity / Reference

---

## Sammanfattning — checklista

- [ ] Produktions-URL i `.env`
- [x] Generera `icon.png` från `icon.svg` (1024×1024)
- [x] Installera `expo-notifications`
- [x] Lägg till `expo-notifications`-plugin i `app.json`
- [x] Återaktivera notis-koden i `_layout.tsx` och `vote.tsx`
- [x] Skapa EAS-konto och kör `eas init` (project ID: 5420a366-1997-4cac-a9a3-44f96ed67292)
- [ ] FCM-nyckel (Android-notiser)
- [ ] Apple Developer-konto + APNs-nyckel (iOS-notiser)
- [ ] Testbygge APK och verifiera på riktig Android-telefon
- [ ] Google Play-konto + publicering
- [ ] Apple App Store-konto + publicering
- [ ] Sekretesspolicy-sida (krävs av båda butikerna)
