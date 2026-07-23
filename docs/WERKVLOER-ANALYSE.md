# Analyse — werkvloer & chauffeurs

Wat kan de app versimpelen voor de mensen die het dagelijks draaien: de
**floor-/werkvloerstaf** (sessies & workshops draaien, studio openen/sluiten,
ruimtes klaarzetten) en de **chauffeurs** (mensen/gear/merch verplaatsen).

## Wat er nu al is (basis om op voort te bouwen)
- **Studio-operatie**: `bookings`, `AdminCalendarPage` (agenda), `AdminNukiTab` (deuren op afstand), `FaultReportDialog` + `fault_reports` (storingen), `booking-scheduler` (auto-reminders), punten voor schone-ruimte-foto's.
- **Jongerenwerk / educatie ("werkvloer")**: `org_*` — scholen, trajecten, workshops, **sessies op locaties**, teamleden, taken/milestones, rapporten. Draait op verschillende adressen.
- **Notificaties**: web-push + WhatsApp (Meta Cloud) — infra ligt er al.

## Knelpunten voor de werkvloer
1. **Geen simpel "vandaag"-scherm.** De agenda (`AdminCalendarPage`) is rijk maar zwaar; iemand op de vloer wil één mobiel scherm: *wat staat er vandaag, in welke ruimte, wie komt, is het betaald, deur open.*
2. **Openen/sluiten is impliciet.** Geen open/sluit-checklist (ruimtes klaar, apparatuur uit, licht/deur, schoon achtergelaten). Nu leunt het op geheugen.
3. **Storing melden is member-gericht.** `FaultReportDialog` hangt aan een boeking van een gebruiker; staf heeft geen 1-tap "meld storing in ruimte X" los van een boeking.
4. **Rapporten/taken zijn desktop-achtig.** De `org_*`-schermen zijn prima op desktop maar bewerkelijk op de telefoon tijdens een sessie.
5. **Chauffeurs hebben niets.** Er is geen rittenoverzicht, geen adres-met-navigatie, geen status ("onderweg/klaar").

## Voorstellen — geprioriteerd (versimpelen via de app)

### 1. "Vandaag op de vloer" — mobiel dagoverzicht (grootste winst)
Eén scherm voor staf: alle **boekingen + org-sessies van vandaag**, chronologisch, met ruimte, naam, betaald-status en een **deur-open-knop** (hergebruikt `AdminNukiTab`/Nuki). Alles read-mostly, mobiel-first.
→ Hergebruikt bestaande data (`bookings`, `org_sessions`, Nuki). Geen nieuw datamodel.

### 2. Open- & sluit-checklist per dienst
Vaste checklist (ruimtes klaar, apparatuur, schoon, licht/deur, kluis) die de staf afvinkt bij openen/sluiten. Koppelt aan het bestaande **taken- + punten/schone-ruimte-systeem**; sluitfoto = bewijs.
→ Hergebruikt `admin_tasks` / media-submissions-patroon.

### 3. 1-tap "storing melden" voor staf
Losgekoppelde variant van `FaultReportDialog`: kies ruimte → foto → omschrijving → blokkeert de ruimte automatisch (bestaande `room_blocks`-logica).
→ Klein; hergebruikt bestaande storings-/blokkeer-flow.

### 4. Mobiele sessie-modus voor jongerenwerk
Tijdens een `org`-sessie: aanwezigheid afvinken + kort rapport + foto in één compacte mobiele weergave, i.p.v. de volledige desktop-detailpagina.
→ Hergebruikt `org_sessions` + `org_*_reports`.

### 5. Chauffeurs — "Ritten vandaag"
Simpel rittenscherm: lijst van ophalen/afleveren met **adres + 1-tap navigatie** (Google/Apple Maps deep-link), tijd, contact, en status (`gepland → onderweg → klaar`). Push-melding bij een nieuwe rit.
→ Klein nieuw datamodel (`transport_runs`: datum, van/naar-adres, tijd, contact, status, driver_id) óf hergebruik van `org_sessions.location` als het om vervoer tussen locaties gaat.

## ⚠️ Eén ding om te bevestigen (bepaalt voorstel 5)
Wat verplaatsen de **chauffeurs** precies?
- **(a) Gear/apparatuur** tussen studio en locaties/events, of
- **(b) Deelnemers/jongeren** tussen scholen/locaties (jongerenwerk), of
- **(c) Merch/drukwerk** vanuit de drukkerij naar klanten.

Elk geeft een net iets ander rittenscherm (velden, wie ziet wat, koppeling).
Zodra dit duidelijk is, bouw ik voorstel 5 exact passend.

## Aanbevolen volgorde
**1 → 3 → 2 → 4 → 5.** Voorstel 1 (dagoverzicht) geeft de meeste dagelijkse
waarde en hergebruikt alles wat er al is; 5 (chauffeurs) na de korte bevestiging
hierboven.
