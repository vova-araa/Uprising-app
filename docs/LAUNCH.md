# Go-live checklist — Uprising Studio

Praktische stappen om de app online te zetten. Afvinken van boven naar beneden.
De **code is productie-klaar** (build, typecheck, 33 tests en lint zijn groen);
het meeste hieronder is backend-configuratie en externe diensten.

---

## 0. Code-side (al groen ✓)
- [x] `npm run build` — productie-build slaagt
- [x] `npx tsc --noEmit` — 0 type-fouten
- [x] `npm test` — 33 tests groen
- [x] `npm run lint` — 0 errors
- [x] 404-route, `robots.txt`, `sitemap.xml`, OG/Twitter/JSON-LD, PWA-manifest, service worker
- [x] Geen secrets in de repo — `.env` bevat alleen **publieke** Supabase-keys (URL + publishable key), die horen client-side

> Herbouwen na wijzigingen: `npm run build`. De service worker (`public/sw-push.js`)
> gebruikt cache `uprising-v1`; **bump die versie** (`uprising-v2`, …) bij een release
> als je zeker wilt zijn dat oude caches wegvallen.

## 1. Supabase project
- [ ] Migraties uitvoeren: alle bestanden in `supabase/migrations/` toepassen (Supabase CLI `db push`, of via het Lovable-cloud-project). Inclusief de nieuwste: `..._atomic_booking_modify` (in-place reschedule zonder Nuki-toegang te verliezen) en `..._payment_integrity` (unieke `stripe_session_id`- en `gift_cards.code`-indexen)
- [ ] Edge functions deployen: alle mappen in `supabase/functions/` (43 functies)
- [ ] **`pg_cron` + `pg_net`** extensies aanzetten — nodig voor `booking-scheduler` (reminders, wallet-sweep, factuur-herinneringen, weekplannen)
- [ ] Storage-buckets aanmaken met policies: **`uploads`** (sessievideo's, schone-ruimte-foto's, projectbestanden) en **`org-reports`** (workshop-/traject-rapporten)
- [ ] Eerste **admin** aanmaken: rij in `user_roles` (`role = 'admin'`) voor jullie account
- [ ] Auth: e-mailbevestiging / redirect-URL's instellen op het live domein; Google + Apple login-providers configureren (de app toont die knoppen)

## 2. Edge Function secrets
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` worden **automatisch** door Supabase gezet. De rest handmatig instellen:

**Vereist voor de kern**
- [ ] `STRIPE_SECRET_KEY` — Stripe live secret key (checkout, subscriptions, iDEAL). *Betaling wordt bevestigd via de `verify-payment`-functie na de redirect — er is géén Stripe-webhook-secret nodig.*
- [ ] `APP_URL` — `https://uprisingstudio.nl` (voor redirect-URL's in checkout/e-mails)
- [ ] `LOVABLE_API_KEY` — e-mailverzending + AI (coach, assistent) lopen via de Lovable API. Optioneel `LOVABLE_SEND_URL` om een andere mail-endpoint te kiezen.

**Toegang (Nuki)**
- [ ] `NUKI_API_KEY` — Nuki Web API token
- [ ] `NUKI_WEBHOOK_SECRET` — voor `nuki-webhook`
- [ ] Lock-ID's aan studio's koppelen in `app_config` (zie §4)

**Web push (browser-notificaties)**
- [ ] `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` — genereer een VAPID-paar (`npx web-push generate-vapid-keys`); subject is `mailto:info@uprisingstudio.nl`

**WhatsApp (optioneel — functies no-op'en netjes zonder deze)**
- [ ] `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN` — Meta Cloud API (eigen zakelijk nummer)
- [ ] `WHATSAPP_TEMPLATE_REMINDER` — naam van het **goedgekeurde** template

**Optionele integraties**
- [ ] `ZAPIER_BOOKING_WEBHOOK_URL` — alleen als jullie Zapier-boekingsflow willen
- [ ] `EXPORT_API_KEY` — beveiligt eventuele export-endpoints

## 3. Stripe
- [ ] Live-modus keys gebruiken (`STRIPE_SECRET_KEY` hierboven + `VITE`-loze publishable key indien nodig)
- [ ] **⚠️ Prijs-ID's moeten in dezelfde modus (test/live) bestaan als je `STRIPE_SECRET_KEY`.** De membership-prijzen zijn **hardcoded** als `price_…`-ID's in `create-checkout`, `check-subscription` en `update-subscription` (9 stuks: basic/pro/unlimited × maand/jaar + 3 broedplaats-tiers). Zet je een **live** key maar verwijzen die ID's naar **test**-prijzen (of andersom), dan faalt élke membership-checkout/upgrade. Vóór launch: bevestig dat alle 9 ID's in de gekozen modus bestaan, of vervang ze door de live-ID's. *(Let op: de drie broedplaats-tiers mappen maand én jaar naar hetzelfde prijs-ID — bedoeld.)*
- [ ] Producten/prijzen aanmaken via de `manage-stripe-products`-functie (of het admin-dashboard)
- [ ] iDEAL geactiveerd in het Stripe-dashboard
- [ ] Test: één echte checkout in live-modus (klein bedrag) → `verify-payment` schrijft de betaling weg

> **Betaal-beveiliging (in de code afgedekt).** Betaling wordt bevestigd doordat
> `verify-payment` de Stripe-sessie terug-checkt. De sessie is strikt gebonden aan
> één record (`metadata.booking_id` / `producer_booking_id`), het betaalde bedrag
> wordt server-side gevalideerd tegen wat de boeking verschuldigd was, en bevestigen
> gebeurt via een conditionele `pending_payment → confirmed` update. Partial-unique
> indexes op `stripe_session_id` (bookings + producer_bookings) garanderen op
> DB-niveau dat één sessie hooguit één record kan afrekenen. Een betaalde sessie kan
> dus niet "hergebruikt" worden om een andere, onbetaalde boeking te bevestigen.

## 4. App-config seeden (`app_config`-tabel)
De UI is config-gedreven. Deze rijen moeten gevuld zijn, anders zijn secties leeg
(de app degradeert netjes, maar toont dan minder):
- [ ] `studios` — studio's met prijzen/afbeeldingen (drijft Boeken + Ruimtes + Uitgelichte diensten)
- [ ] `studio_display_names`, `hero_content`, `homepage_sections`, `quick_actions`
- [ ] `booking_rules`, `offpeak_pricing`, `lastminute_pricing`
- [ ] `mix_master_pricing`, `producer_pricing`, `membership_tiers`, `broedplaats_plans`
- [ ] `points_config` + `points_rewards` (puntenwaarden + beloningswinkel)
- [ ] `feature_flags` (zet `maintenance_mode` uit), `announcement_banner`, `support_info` (e-mail/adres/openingstijden)
- [ ] Nuki lock-mapping per studio

## 5. Domein & hosting
- [ ] Publiceren via Lovable (of de statische `dist/` op een host zetten — `base: "./"` + HashRouter werken zonder server-rewrites)
- [ ] DNS: `uprisingstudio.nl` naar de host; SSL/HTTPS aan
- [ ] Auth redirect-URL's, `APP_URL` en de OG/sitemap-URL's staan al op `uprisingstudio.nl`

## 6. Post-deploy smoke-test (klik door)
- [ ] Home laadt; taal wisselen werkt
- [ ] Boekingsflow → Stripe checkout → terug → boeking zichtbaar in account
- [ ] Nuki "open deur"-knop bij een actieve boeking
- [ ] Account: tegoed, punten, boeking wijzigen/annuleren, **beoordelen (+10 punten)**, "zet in agenda" (.ics)
- [ ] Admin-dashboard bereikbaar; boeking/labels/facturen beheren
- [ ] Push-notificatie opt-in in de browser
- [ ] (Indien WhatsApp aan) test-reminder ontvangen

## 7. Bekende aandachtspunten (geen blokkers)
- **Admin-betaallink** (`create-admin-payment-link`): voor een link die aan een bestaande boeking hangt bevestigt de klant nu **automatisch** bij terugkomst (session_id + `type=studio-booking` in de success-URL, `metadata.user_id` gezet, en er wordt `prijs − tegoed` afgerekend zodat de bedragcontrole in `verify-payment` klopt). Voorwaarde: de klant heeft een account en betaalt zelf de link. Betaalt de admin de link zélf, of is de klant geen appgebruiker, dan bevestigt het team de boeking handmatig in de admin-agenda. Pre-booking-links (zonder boeking) hebben niets om te bevestigen.
- **SEO deep-links**: de app gebruikt HashRouter (`/#/…`), dus zoekmachines indexeren alleen de homepage als losse pagina. De `sitemap.xml` lijst hash-URL's — voor volledige deep-link-SEO zou je naar BrowserRouter + SPA-fallback op de host moeten (grotere wijziging, ná launch te overwegen).
- **Armeens (hy)**: ~30% van de strings valt terug op Engels (de rest is vertaald). Prima leesbaar; laat professioneel afmaken als Armeens belangrijk is, of haal de taal uit de kiezer.
- **Service worker**: bump de cache-versie bij elke release (zie §0).
