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

## Documentatie

Zie [`docs/MARKTONDERZOEK.md`](docs/MARKTONDERZOEK.md) voor het marktonderzoek en de geprioriteerde feature-roadmap.
