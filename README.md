# Uprising Studio App

De app van [Uprising Studio](https://uprisingstudio.nl) — muziekstudio & creatieve hub in Amersfoort.

Studio's boeken met automatische Nuki smart-lock toegang, memberships, mix & master, producer-sessies, content-creatie, drukkerij, broedplaats en jongerenwerk — alles in één app.

## Stack

- **Frontend**: React 18 + Vite + TypeScript, shadcn/ui, Tailwind CSS, TanStack Query, react-router (HashRouter)
- **Backend**: Supabase (Postgres + RLS, Auth, Storage, Edge Functions in Deno)
- **Betalingen**: Stripe (checkout, subscriptions, customer portal, iDEAL)
- **Toegang**: Nuki Web API (smart locks, boeking-gescopede toegang)
- **Mobiel**: Capacitor (iOS/Android) met push notifications, biometrie, haptics
- **i18n**: 8 talen (NL, EN, DE, FR, ES, TR, AR, HY)

## Ontwikkelen

```sh
npm install
npm run dev        # dev server op :8080
npm run build      # productie-build
npm test           # vitest
npm run lint       # eslint
```

## Structuur

```
src/
  pages/            # route-pagina's (booking, diensten, admin, org, account)
  components/       # gedeelde componenten; admin/ en org/ subsets
  contexts/         # Auth + AppConfig providers
  hooks/            # camera, geolocatie, push, haptics, e.d.
  integrations/     # Supabase client + gegenereerde DB-types
  lib/              # i18n, storage, utils, prefetch
supabase/
  functions/        # Deno edge functions (booking, Stripe, Nuki, e-mail, AI)
  migrations/       # SQL-migraties
docs/
  MARKTONDERZOEK.md # marktonderzoek + feature-roadmap
```

## Conventies

- **Write-safety**: `supabase-js` *resolvet* (throwt niet) bij een DB-fout, dus een omringende `try/catch` vangt RLS/constraint-fouten niet. Destructureer altijd `{ error }` en check die vóór je succes meldt — nooit `toast.success` na een ongecontroleerde write. Optimistische UI-updates worden teruggedraaid bij een fout.
- **Bevestigingen**: gebruik `useConfirm()` (uit `components/ConfirmDialog`) i.p.v. `window.confirm` — een gestylede, promise-based dialoog die ook in de native (Capacitor) wrapper rendert. `const ok = await confirm({ title, message, destructive });`
- **Destructieve/geld-acties** krijgen een in-flight guard tegen dubbeltikken.
- **Design-tokens** (`src/index.css`): `.card-premium`, `.glass`, `.hairline-top`, `.ambient-glow`, en de `--primary` / `--success` / `--warning` HSL-tokens. Gebruik die i.p.v. hardcoded hex/hsl.
- **Bundling** (`vite.config.ts`): React blijft in één `vendor`-chunk (voorkomt runtime-ordering-fouten). Zware libs zonder React-internal koppeling die alleen op lazy-pagina's gebruikt worden (recharts, react-markdown, embla, react-day-picker) zijn wél afgesplitst zodat ze niet bij de eerste paint laden.

## Documentatie

Zie [`docs/MARKTONDERZOEK.md`](docs/MARKTONDERZOEK.md) voor het marktonderzoek en de geprioriteerde feature-roadmap.
