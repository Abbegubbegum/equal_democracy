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

## 2. Generera app-ikon från SVG

Den färdiga logotypen finns i `apps/mobile/assets/icon.svg` (mörk blå rundad ruta med två gula pilar).
Expo behöver PNG-filer i rätt storlekar.

```bash
# Installera sharp-cli eller använd ett onlineverktyg (t.ex. svgtopng.com)
# Generera:
#   icon.png          — 1024×1024 (App Store + Play Store)
#   adaptive-icon.png — 1024×1024 (Android adaptive icon, förgrundslager)
#   splash-icon.png   — valfri storlek

# Ersätt filerna i apps/mobile/assets/
```

Kontrollera att `apps/mobile/app.json` pekar rätt:
```json
{
  "expo": {
    "icon": "./assets/icon.png",
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#002d75"
      }
    }
  }
}
```

---

## 3. Installera expo-notifications

OneDrive blockerade installationen under utveckling. Pausa OneDrive-synkronisering och kör:

```bash
pnpm add expo-notifications --filter=mobile
```

Lägg sedan till pluginen i `apps/mobile/app.json`:
```json
{
  "expo": {
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#002d75"
        }
      ]
    ]
  }
}
```

---

## 4. Återaktivera notis-koden i appen

Två filer behöver uppdateras (koden är förberedd men kommenterades bort p.g.a. installationsproblem):

### `apps/mobile/app/(app)/_layout.tsx`

Lägg tillbaka längst upp i filen:
```ts
import * as Notifications from "expo-notifications";
import { apiClient } from "../../lib/api";
import { Platform } from "react-native";
```

Lägg tillbaka `setNotificationHandler` utanför komponenten:
```ts
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});
```

Lägg tillbaka `useEffect` i `AppLayout`:
```ts
useEffect(() => {
  if (!user) return;
  (async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") return;
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "Default",
          importance: Notifications.AndroidImportance.MAX,
          sound: "default",
        });
      }
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: "<ditt-eas-project-id>",  // ← fyll i efter steg 5
      });
      await apiClient("/api/mobile/push-token", {
        method: "POST",
        body: JSON.stringify({ token: tokenData.data }),
      }).catch(() => {});
    } catch {}
  })();

  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const screen = response.notification.request.content.data?.screen;
    if (screen === "vote") {
      router.navigate("/(app)/vote");
      Notifications.setBadgeCountAsync(0);
    }
  });
  return () => sub.remove();
}, [user]);
```

### `apps/mobile/app/(app)/vote.tsx`

Lägg tillbaka i `useEffect`:
```ts
import * as Notifications from "expo-notifications";
// ...
useEffect(() => {
  load();
  Notifications.setBadgeCountAsync(0);
}, []);
```

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
- [ ] Generera `icon.png` från `icon.svg` (1024×1024)
- [ ] Installera `expo-notifications` (pausa OneDrive först)
- [ ] Återaktivera notis-koden i `_layout.tsx` och `vote.tsx`
- [ ] Skapa EAS-konto och kör `eas init`
- [ ] FCM-nyckel (Android-notiser)
- [ ] Apple Developer-konto + APNs-nyckel (iOS-notiser)
- [ ] Testbygge APK och verifiera på riktig Android-telefon
- [ ] Google Play-konto + publicering
- [ ] Apple App Store-konto + publicering
- [ ] Sekretesspolicy-sida (krävs av båda butikerna)
