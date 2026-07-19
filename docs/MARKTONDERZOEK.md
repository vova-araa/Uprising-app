# Marktonderzoek Uprising Studio App — juli 2026

Diepgaand onderzoek (2 rondes, ~85 agents, adversarieel geverifieerd) naar de muziekstudio-/creative-hub-branche: concurrenten, gebruikersklachten, retentie-mechanieken, Nuki API-mogelijkheden, NL-subsidies en AI-trends. Doel: prioriteitenlijst van features en verbeterpunten voor de Uprising-app.

---

## TL;DR — de strategische conclusie

1. **Nederland heeft geen dominante studio-booking marketplace.** Er is alleen niche-SaaS (Jamspot) en studio's met ge-e-mailde pincodes of generieke booking-widgets. Uprising's geïntegreerde app (Stripe + Nuki + memberships) is lokaal nu al voorop — de kans is om **de meest gepolijste app-first studio van Nederland** te zijn.
2. **Het Pirate Studios-model is het bewezen sjabloon**: 24/7 onbemand, boeking-gescopede tijdcodes, peak/off-peak pricing, last-minute boekbaar tot minuten voor start. Hun Trustpilot-klachten zijn tegelijk de kwetsbaarheden waar Uprising op kan winnen.
3. **De Nuki Web API kan alles wat nodig is** voor volledig geautomatiseerde, boeking-gescopede toegang (geverifieerd tegen de API-docs, zie §5).
4. **Er ligt serieus NL-subsidiegeld klaar** voor precies Uprising's broedplaats-/jongerenwerkprofiel — maar vrijwel alles vereist een stichting (zie §6).
5. **AI-mastering is een commodity ($0–10/track)** — niet mee concurreren, maar als goedkope funnel inzetten richting de premium menselijke mix & master-dienst (Abbey Road-model).

---

## 1. Concurrentielandschap

De markt splitst in twee modellen:

| Speler | Model | Killer feature | Prijs |
|---|---|---|---|
| **Peerspace** | Marketplace, 20% host fee + guest fee | Discovery + Instant Book (24h lead time, boost in ranking) | 20% commissie |
| **Studiotime** | Listing-abonnement, géén betalingen meer sinds 2020 | Wereldwijde muzikant-specifieke exposure | ~$20/mnd |
| **Jammed** | Flat-fee SaaS, geen commissie | RemoteLock smart-lock codes per boeking + policy-gedreven auto-refunds met automatische slot-herverkoop | ~$20/room/mnd |
| **Anolla** | Freemium SaaS | AI-scheduling claims, dynamic pricing, loyalty | gratis–€11,99/user |
| **AllBooked (Skedda)** | Mid-market SaaS | Rules-based / demand-based dynamic pricing | $99–199/mnd |
| **Pirate Studios** | Eigen keten, 24/7 onbemand | Tijdgebonden deurcodes + peak/off-peak pricing (UK off-peak vanaf £5,30/u) | n.v.t. |
| **NL: Jamspot, The Music Space, Metropool** | Niche/self-built | The Music Space: online-only boeken, code 1u vooraf gemaild | n.v.t. |

**Implicaties voor Uprising:**
- Uprising bezit al de hoogste-marge positie (directe app, nul commissie). Cherry-pick de killer feature van elke rivaal.
- Studiotime/Peerspace zijn bruikbaar als pure **lead-gen kanalen** terwijl booking + betaling in de eigen app blijven.
- De parity-checklist t.o.v. Jammed (dichtstbijzijnde benchmark): tijdgebonden codes gescoped op de geboekte ruimte, in-app codeweergave naast e-mail, expliciet "onbemand & buiten kantooruren"-productverhaal, equipment-verhuur bij checkout, opname-opslag/levering (Jammed geeft 100GB).

## 2. Pijnpunten van gebruikers & eigenaren (geverifieerd via Trustpilot/Reddit/Gearspace/G2/Capterra)

De terugkerende faalpatronen van self-service studio's en booking-software:

1. **Kapotte/ontbrekende apparatuur zonder personeel on-site** — klacht #1 over Pirate; kamers blijven boekbaar terwijl bekend is dat gear defect is. *Trust-killer.*
2. **Deurcode-/toegangsfouten** die betaalde sessietijd opvreten, met trage remote support.
3. **Refund-frictie**: credit-only refunds, stilletjes verlopende credits (Pirate: 3 mnd voor annuleringscredit, 90 dagen inactiviteit = weg), rigide annuleringsvensters.
4. **Slechte geluidsisolatie** die "opname"-kamers onbruikbaar maakt.
5. **Vervuilde/onveilige kamers** na late-night sessies — Pirate moest deels terug naar beveiligers en curfews.
6. **Mindbody's reputatie-vernietiger**: doorlopende incasso ná schriftelijke opzegging, 12–24 mnd contract-lock-in, $250–1000/mnd. → **Self-service opzeggen in de app met directe bevestiging is heilig.**
7. **Skedda UX-lessen**: geen multi-day blokken kunnen boeken, per-ongeluk-hele-week recurring bookings, krappe check-in-timeouts die boekingen auto-annuleren, zwakke mobile experience.
8. **Race-condition dubbelboekingen** (Mindbody) → atomaire slot-locking in de backend is verplicht.

**Kansen voor Uprising (direct uit de klachten):**
- Pre-sessie equipment-checklist / one-tap **storingsmelding met foto**, die de kamer automatisch blokkeert voor nieuwe boekingen én automatisch compenseert.
- **"Ik kom er niet in"-panic button** met remote-unlock fallback en automatische sessieverlenging/credit.
- Transparante **cash refunds via Stripe** (geen gedwongen credit), lange/geen credit-expiry, in-app zichtbaar saldo + vervaldatums.
- Nuki **deur-unlock event = check-in** (geen aparte tap met timeout).
- Per kamer eerlijk zijn over isolatieniveau en bedoeld gebruik (rehearsal vs. recording vs. content).

## 3. Retentie- & bezettingsmechanieken (uit gyms/coworking, cijfermatig onderbouwd)

- **Retentie is de hefboom**: +5% retentie = 25–95% meer winst; acquisitie kost 5–25x meer dan behoud; ~50% van nieuwe members haakt af binnen 6 maanden.
- **No-shows**: ~20% van geboekte slots; reminders (24h + 2h, met one-tap cancel/reschedule) reduceren no-shows 38–50%. Reminder kan meteen de Nuki-toegangsinfo dragen.
- **Annuleringsbeleid-sjabloon (Pirate, direct kopieerbaar)**: annuleren tot 4u vooraf → wallet-credit; cash refund alleen 48u+ vooraf; 1 uur gratie na boeken. Eigenaren op Gearspace: non-refundable deposit (50% of flat) voor high-touch diensten.
- **Credit-wallet blueprint (ClassPass)**: maandelijkse credits, rollover gecapt op één cyclus-tegoed, demand-based credit-korting met bodemprijs om daluren te vullen. ⚠️ ClassPass's 30-dagen-expiry leverde een class action op — check NL/EU consumentenrecht vóór korte expiry.
- **Off-peak**: standaard ~30–40% goedkoper (daluren-tier voor studenten/freelance producers vult weekdag-daguren).
- **Waitlist met auto-fill**: vrijgekomen slots via push aanbieden met kort claimvenster → late annuleringen worden omzet.
- **Referrals**: two-sided credit (bijv. €10 beide kanten, 3 mnd geldig); referred members: ~37% hogere retentie.
- **Win-back**: 60–90 dagen geen boeking → automatische trigger; e-mail alleen 8–15% recovery, multi-channel 25–40%.
- **Membership-patroon (OfficeRnD/Optix)**: maandelijks resettende uren-tegoeden + automatische overage-billing via Stripe.

## 4. Boeking & pricing features

- **Peak/off-peak dynamic pricing** — dé bewezen omzethefboom (Pirate, AllBooked, ClassPass).
- **Last-minute boekbaar tot minuten voor start** — smart locks maken dit gratis om te serveren.
- **Instant Book** met tijdvenster-regels (Peerspace: 24h lead time).
- **Automatische slot-herverkoop** bij annulering (Jammed).
- **Equipment/add-on verhuur bij checkout** met voorraadbeheer (Jammed).
- **Multi-uur/multi-dag blokken in één actie**, expliciete bevestiging van recurring bookings (anti-Skedda).

## 5. Nuki API — technisch geverifieerd

De volledige boeking-gescopede toegangsflow kan met de Nuki Web API:

- `PUT /smartlock/auth` met `allowedFromDate`/`allowedUntilDate` (+ `allowedWeekDays` bitmask, `allowedFromTime/UntilTime` voor wekelijkse vensters). Update via `POST /smartlock/{id}/auth/{authId}`, delete via `DELETE /smartlock/auth`.
- **Keypad-codes**: type 13 auth met `code`-veld — 6 cijfers, alleen 1–9, niet beginnend met "12", uniek per device. Smart Lock 3.0+ Keypad: 200 codes. → Klant hoeft géén Nuki-app te installeren.
- **Webhooks** (decentral, geen approval nodig): `DEVICE_LOGS` (incl. keypad-entries), `DEVICE_STATUS`, `DEVICE_AUTHS` → "klant kwam binnen om 14:03" in admin, unlock-event als check-in, deur-open-na-sessie detectie. Central webhooks vereisen Advanced API-goedkeuring.
- **Gelaagd patroon (Pirate-stijl)**: Nuki Opener op de intercom (action 3 = deuropener) + Smart Locks op kamerdeuren; Keypad kan aan beide. "Eén code, beide lagen" is officieel ondersteund.
- **Betrouwbaarheids-caveats** (forumrapporten): tijdrestricties syncen soms niet → codes ruim vooraf aanmaken, verifiëren via GET, `POST /smartlock/{id}/sync` forceren, remote-unlock fallback. Auth per bóeking modelleren (niet per klant — anny.co's 1-periode-per-klant-limiet vermijden) + cleanup-job voor verlopen auths.
- MVP = statisch API-token + 4 endpoints + 1 webhook-receiver. Geen partnerprogramma nodig.

## 6. NL-subsidies (Uprising = Amersfoort)

**Rode draad: vrijwel alles vereist een non-profit rechtspersoon.** Een stichting naast de BV (met 3+ onafhankelijke bestuursleden voor VSBfonds) ontgrendelt bijna de hele lijst.

| Fonds | Bedrag | Voor | Deadline/ronde | Rechtsvorm |
|---|---|---|---|---|
| **Cultuurfonds "The Culture"** | tot €50k/jr (3×/jr) of €10k (15×/jr) | hiphop, rap, dj, streetwear, graphic design — exact Uprising's profiel | loopt t/m 2028, rondes per jaar | stichting/vereniging/BV zonder winstuitkering |
| **Gemeente Amersfoort broedplaatsen 2026** | ~€40k (<2jr) / ~€60k (ouder) | broedplaats met 5+ makers | openstellingsbesluit eind 2026 (vorige ronde: 11 nov–15 dec) | non-profit |
| **Amersfoort projectsubsidie kunst & cultuur** | €1.500–25.000 (max 60% budget) | artistiek project | **17 aug – 10 sep 2026** ← eerstvolgende | prof. kunstenaar of non-profit |
| **FCP Samen Cultuurmaken "Proberen"/"Ontwikkelen"** | €10k–25k / €25k–125k | cultuur × sociaal domein, partnership vereist | rondes 2026, bedragen provisioneel | stichting/vereniging/zzp |
| **FCP Open Oproep Mentale gezondheid jongeren** | vorige editie €1,075M budget | jongeren + mentale gezondheid | **opent 1 sep 2026** | idem |
| **Fonds 21** | min €10k | jongeren 12–30: ondernemerschap, medialiteracy; kunst & educatie | doorlopend, 4 mnd vooraf | **ook BV/NV zonder winstoogmerk** |
| **VSBfonds** | geen min/max | kunst & cultuur, ontmoeting | doorlopend, 4 mnd vooraf | stichting met 3+ onafh. bestuur |
| **Oranje Fonds** | €500–100k | jongerenwerk als welzijn (niet als kunst framen!) | doorlopend | stichting/vereniging |
| **Stimuleringsfonds Creatieve Industrie** | wisselend | digitale cultuur — app/content-kant | **medio aug 2026** (loterij) | **KvK volstaat, ook commercieel** |
| **Indebuurt033** (Amersfoort welzijn) | micro | buurt/jongereninitiatieven + dé sociaal-domein-partner voor FCP-aanvragen | per kwartaal (1 apr/jul/okt/jan) | laagdrempelig |

⚠️ Bedragen/deadlines grotendeels via search-snippets geverifieerd (bronsites blokkeerden directe fetch); vóór indienen herverifiëren op de bronpagina's. Impuls Jongerencultuur Amersfoort (tot €30k) verliep eind 2024 zonder bevestigde opvolger — navragen via cultuur@amersfoort.nl.

## 7. AI-strategie voor mix & master en de app

- **Prijsband AI-mastering**: gratis (BandLab) tot ~$10/track (LANDR) of $6–25/mnd (Waves, eMastered). Niet mee concurreren op prijs.
- **Bewijs voor premium human positioning**: Benn Jordans 472-persoons double-blind test — menselijke engineers wonnen (6,4 & 6,1/10); LANDR, BandLab, Waves e.a. gediskwalificeerd; Ozone 11 Master Assistant 3,8/10. → In de app citeren.
- **Abbey Road-productisering** (vanaf £100/track): keuze uit engineers met naam, gedefinieerde revisierondes, turnaround-tiers (standaard vs. 48h fast-track), multi-format levering — alle vier direct als in-app opties te bouwen voor de mix & master-flow.
- **Hybride funnel**: AI "demo master" embedden via RoEx Tonn API (~€2/track marge-kosten, 1.000 gratis credits bij signup; UnitedMasters doet dit al) → gratis/goedkoop bij membership → upsell naar menselijke dienst.
- **Stem separation** = commodity (Moises $3,99/mnd); alleen als workflow-gemak koppelen aan producer-sessies ("stuur je demo, wij splitsen stems vóór je sessie").
- **AI booking-assistent**: geen enkele studioketen doet dit nog — Uprising's bestaande ai-assistant edge function uitbouwen tot boeken-via-chat + kamer-aanbeveling zou vóór de markt uit lopen.
- **Creator-economy omzet**: bookable podcast/video-content-room (~$2k/mnd extra bij Amerikaanse studio's; content-rates $65/u–$850/dag) en **sessie-content add-ons bij checkout**: recap reel, BTS-clippack (10 shorts), sessie-fotoshoot — bewezen patroon (Airwave, GR Creator, Union Recording), past exact op Uprising's content-tak.

---

## 8. Geprioriteerde roadmap voor de app

### Tier 1 — trust & core booking (fundament, laag risico, hoge impact)
1. **Nuki boeking-gescopede toegang v2**: code per boeking (type-13 keypad), gelaagd (Opener + kamerdeur), in-app codeweergave, unlock-event = check-in, "ik kom er niet in"-panic button met fallback, cleanup-job.
2. **Atomaire slot-locking** in de booking-backend (anti-dubbelboeking).
3. **Automatisch annuleringsbeleid** (Pirate-sjabloon: 4u → wallet-credit, 48u+ → cash refund, 1u gratie) + automatische slot-herverkoop.
4. **Storingsmelding met foto** → kamer auto-blokkeren + auto-compensatie.
5. **Reminders 24h + 2h** met toegangsinfo en one-tap cancel/reschedule.
6. **Self-service membership opzeggen** met directe bevestiging en einddatum.

### Tier 2 — omzet (bewezen hefbomen)
7. **Peak/off-peak pricing** + off-peak membership-tier (~30% korting daluren).
8. **Credit-wallet** (Stripe): maandelijkse membership-uren, rollover max 1 cyclus, overage-billing.
9. **Equipment & content add-ons bij checkout**: gear-verhuur, recap reel, BTS-pack, fotoshoot.
10. **Waitlist met push auto-offer** bij vrijgekomen slots.
11. **Mix & master premium-productisering**: engineer-keuze, revisierondes, turnaround-tiers + AI demo-master funnel (RoEx ~€2/track).

### Tier 3 — retentie & voorsprong
12. **Referral** (two-sided €10 credit) en **win-back** (60–90 dagen inactief → automatische trigger).
13. **AI booking-assistent** (bestaande ai-assistant edge function uitbouwen: boeken via chat, kamer-advies) — vóór de markt.
14. **Podcast/video-content-room** als boekbare categorie.
15. **Sessie-streaks/milestones** (licht, geen zware gamification).

### Parallel spoor (niet-app): subsidies
- Stichting oprichten (3+ onafhankelijke bestuursleden) → ontgrendelt The Culture, Amersfoort broedplaats, FCP, VSBfonds, Oranje Fonds.
- Agenda 2026: **17 aug–10 sep** Amersfoort projectsubsidie; **medio aug** Stimuleringsfonds Digitale cultuur; **1 sep** FCP Mentale gezondheid jongeren; **eind 2026** Amersfoort broedplaatsenronde; partnership met Indebuurt033 opzetten.

---

*Methode: 2 onderzoeksrondes. Ronde 1: deep-research harness (60 agents, 5 zoekhoeken, 23 bronnen, 10 claims 3-0 geverifieerd). Ronde 2: 6 parallelle deep-dives + onafhankelijke cross-checks (alle uitgevoerde checks: confirmed). Vendor-sites gelden als primaire bron voor eigen features/prijzen, niet voor vergelijkende claims. Subsidiebedragen en -deadlines vóór indienen herverifiëren op bronpagina's.*
