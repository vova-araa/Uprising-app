# Native app (iOS + Android) via Capacitor

De app is een web-app die met **Capacitor** in een echte iOS/Android-app wordt
gewrapt (App Store / Play Store). Capacitor v8 is al ingericht: `capacitor.config.ts`
staat klaar, en de plugins (camera, geolocation, haptics, push, biometric, status
bar, splash, keyboard, app) zitten in `package.json`. HashRouter maakt het schikbaar
zonder server.

> **App-id:** `nl.uprisingstudio.app` (in `capacitor.config.ts`). Dit wordt de
> bundle identifier in de stores en kan ná de eerste inzending niet meer wijzigen.
> Had je al iets geregistreerd onder de oude `app.lovable.*`-id? Zet die dan terug.

## Éénmalig: native projecten aanmaken
Op een **Mac** (iOS vereist Xcode; Android vereist Android Studio):
```bash
npm install                 # trekt alle Capacitor-plugins binnen
npm run native:add:ios      # maakt de ios/ map (Xcode-project)
npm run native:add:android  # maakt de android/ map (Android Studio-project)
```
> De mappen `ios/` en `android/` worden lokaal gegenereerd. Je kunt ze committen
> (aanrader voor native tweaks) of in `.gitignore` laten.

## Elke keer dat je een nieuwe build wilt
```bash
npm run native:ios       # build web → sync → opent Xcode
npm run native:android   # build web → sync → opent Android Studio
# of alleen syncen zonder openen:
npm run native:sync
```
In Xcode/Android Studio druk je op **Run** (simulator/toestel) of **Archive**
(voor TestFlight / Play Console).

## Wat er al goed staat
- **Splash + status bar + keyboard** geconfigureerd in `capacitor.config.ts`
  (donkere achtergrond `#08070d`, past bij de studio-look).
- `src/lib/native.ts` zet op native de status bar-stijl en verbergt de splash zodra
  de app gerenderd is. Op web is het een no-op.
- De **service worker** wordt op native automatisch overgeslagen (native push i.p.v.
  web push) — zie `src/main.tsx`.
- **Safe areas** (notch/home-indicator) zijn overal in de CSS afgevangen.

## Nog te regelen vóór inzending
- **Iconen & splash-afbeeldingen**: genereer met `@capacitor/assets`
  (`npx @capacitor/assets generate`) vanuit een 1024×1024 icoon + splash.
- **iOS**: Apple Developer-account, bundle id `nl.uprisingstudio.app`, signing in
  Xcode, capabilities voor **Push Notifications** en (indien gebruikt) Camera/
  Face ID-permissieteksten in `Info.plist`.
- **Android**: `google-services` niet nodig tenzij FCM; permissies voor camera/
  locatie/notificaties staan via de plugins; stel het app-icoon + versienummer in.
- **Push**: de app gebruikt `@capacitor/push-notifications` op native. Koppel APNs
  (iOS) en FCM (Android) en registreer het token richting je backend.
- **Deep links / betaal-retour**: Stripe checkout opent in de browser en keert
  terug naar `APP_URL`. Voor een naadloze native terugkeer kun je later Universal
  Links (iOS) / App Links (Android) op `uprisingstudio.nl` instellen.

## Belangrijk
- **Bouw altijd eerst de web-app** (`npm run build`) vóór `cap sync` — de
  `native:*`-scripts doen dit al.
- Zet **geen secret keys** in de native app; die horen alleen in Supabase.
