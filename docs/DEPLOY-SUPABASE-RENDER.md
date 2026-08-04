# Supabase + Render koppelen — stap voor stap

Doel: een **verse Supabase** (backend/database) opzetten en de **frontend op Render**
zetten, en beide aan elkaar koppelen. Volg van boven naar beneden.

> Frontend heeft precies 3 publieke variabelen nodig:
> `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`.
> Alle **geheime** keys (Stripe, Nuki, WhatsApp, Lovable, VAPID) horen **alleen in
> Supabase** — nooit in de frontend of in git.

---

## Deel A — Supabase opzetten

### A1. Project aanmaken
1. Ga naar https://supabase.com → **New project**.
2. Kies een naam (bv. `uprising-studio`), een **sterk database-wachtwoord** (bewaar dit!),
   en regio **EU (Frankfurt of Ierland)**.
3. Wacht tot het project "Active/Healthy" is.
4. Noteer uit **Project Settings → General**: de **Project ref** (bv. `abcdefgh...`).
5. Uit **Project Settings → API**: de **Project URL** (`https://<ref>.supabase.co`)
   en de **publishable/anon key**. Die drie heb je straks bij Render nodig.

### A2. CLI installeren en linken
```bash
npm install -g supabase          # of: brew install supabase/tap/supabase
supabase login                   # opent de browser om in te loggen
supabase link --project-ref <JOUW_REF>
```
> Zet ook `project_id = "<JOUW_REF>"` in `supabase/config.toml` zodat de CLI het onthoudt.

### A3. Database-schema toepassen (migraties)
Alle tabellen, RLS-policies, functies en de betaal-integriteit-indexen staan in
`supabase/migrations/`. In één keer toepassen:
```bash
supabase db push
```

### A4. Edge functions deployen
```bash
supabase functions deploy        # alle functies in supabase/functions/
```
(Los deployen kan ook: `supabase functions deploy create-booking`, enz.)

### A5. Secrets zetten (de geheime keys)
```bash
supabase secrets set \
  STRIPE_SECRET_KEY=sk_live_... \
  APP_URL=https://uprisingstudio.nl \
  LOVABLE_API_KEY=... \
  NUKI_API_KEY=... \
  NUKI_WEBHOOK_SECRET=... \
  VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:info@uprisingstudio.nl
# Optioneel: WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, WHATSAPP_TEMPLATE_REMINDER,
#            ZAPIER_BOOKING_WEBHOOK_URL, EXPORT_API_KEY
```
`SUPABASE_URL`, `SUPABASE_ANON_KEY` en `SUPABASE_SERVICE_ROLE_KEY` zet Supabase zélf —
die hoef je niet te doen. Volledige lijst + uitleg staat in `docs/LAUNCH.md`.

> ⚠️ **Stripe test/live moet matchen.** De 9 membership-prijs-ID's staan hard in de
> code. Je `STRIPE_SECRET_KEY` moet naar prijzen in **dezelfde modus** wijzen, anders
> faalt elke membership-checkout. Zie `docs/LAUNCH.md §3`.

### A6. Extensies aanzetten
Dashboard → **Database → Extensions**: zet **`pg_cron`** en **`pg_net`** aan
(nodig voor reminders, wallet-sweep, factuurherinneringen, weekplannen).

### A7. Storage-buckets
Dashboard → **Storage** → maak buckets **`uploads`** en **`org-reports`** aan
(met de policies uit de migraties — die zijn er al voor `uploads/config/*`).

### A8. Eerste admin + app-config
- **Admin**: voeg in tabel `user_roles` een rij toe met jouw user-id en `role = 'admin'`.
- **App-config**: vul de `app_config`-rijen (studio's, prijzen, tiers, hero, enz.).
  De app draait ook zonder, maar toont dan minder — zie `docs/LAUNCH.md §4`.

### A9. Auth-instellingen
Dashboard → **Authentication → URL Configuration**: zet **Site URL** en **Redirect URLs**
op je live domein (bv. `https://uprisingstudio.nl` en je Render-URL). Configureer
Google/Apple providers als je die knoppen wilt gebruiken.

---

## Deel B — Frontend op Render koppelen

De frontend is een statische Vite-build (`dist/`). HashRouter → geen server nodig.

### B1. Repo koppelen via Blueprint (aanbevolen — gebruikt `render.yaml`)
1. Ga naar https://render.com → **New + → Blueprint**.
2. Kies deze GitHub-repo (`vova-araa/uprising-app`) en de branch die je live wilt.
3. Render leest `render.yaml` en maakt automatisch een **Static Site** aan met:
   - Build command: `npm ci && npm run build`
   - Publish directory: `dist`
   - SPA-rewrite + caching headers.

*(Handmatig alternatief: New + → **Static Site** → repo kiezen → build `npm ci && npm run build`,
publish `dist`.)*

### B2. Env-variabelen in Render zetten
In de service → **Environment** → voeg toe (de waarden uit stap A1):
| Key | Waarde |
|-----|--------|
| `VITE_SUPABASE_URL` | `https://<JOUW_REF>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | de publishable/anon key |
| `VITE_SUPABASE_PROJECT_ID` | `<JOUW_REF>` |

Klik **Manual Deploy → Deploy latest commit** (of push naar de branch → auto-deploy).

### B3. Custom domein
Service → **Settings → Custom Domains** → `uprisingstudio.nl` toevoegen →
zet de door Render getoonde **CNAME** (of A/ALIAS voor het root-domein) bij je DNS.
Render regelt SSL automatisch.

### B4. De koppeling sluitend maken
- Zet in Supabase de secret **`APP_URL`** op je definitieve domein.
- Zet de **Auth Redirect URLs** (A9) op datzelfde domein.
- Doe één test-checkout in Stripe live-modus → `verify-payment` moet de boeking bevestigen.

---

## Snelle checklist
- [ ] Supabase-project + wachtwoord + URL/keys genoteerd
- [ ] `supabase link` → `db push` → `functions deploy`
- [ ] Secrets gezet (Stripe live matcht prijs-ID's!)
- [ ] `pg_cron` + `pg_net` aan, buckets aangemaakt, eerste admin, app_config
- [ ] Render Blueprint gekoppeld + 3 VITE_-vars gezet → deploy
- [ ] Domein + SSL, `APP_URL` en auth-redirects op het live domein
- [ ] Test-checkout gelukt
