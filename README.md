# FTJM Chat

Cross-platform chat-app gebouwd met Electron, React en Supabase. Beschikbaar voor macOS, Windows en Linux.

## Features

- Direct messaging (DM's) met end-to-end encryptie
- General Chat: openbare posts met reacties en mentions
- Social feed met media-posts (foto's en video's)
- Foto's/video's worden automatisch gecomprimeerd vóór upload (ImgBB)
- Custom notificatie-geluiden
- Profielen met badges (verified, admin, mod, developer)
- Auto-updates via GitHub releases

## Tech Stack

| Onderdeel | Keuze |
|---|---|
| App-framework | [Electron](https://www.electronjs.org/) 42 |
| Frontend | React 18 + Vite 5 + Tailwind CSS + Zustand |
| Backend/Database | Supabase (PostgreSQL + RLS + Realtime) |
| Image hosting | ImgBB API |
| Packaging | electron-builder |
| Package manager | pnpm 9 (npm workspaces) |

## Structuur

Dit is een monorepo met drie packages:

```
packages/
├── web/       React + Vite frontend (alle UI en logica)
├── main/      Electron main process (vensters, IPC, auto-updates)
└── shared/    Gedeelde TypeScript types en utilities
```

## Aan de slag (development)

```bash
# Dependencies installeren
npm install

# .env.local instellen (zie onderstaande variabelen)

# Dev-server starten (Vite + Electron)
npm run dev
```

### Vereiste env-variabelen (`.env.local`)

| Variabele | Doel |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project-URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `VITE_ENCRYPTION_KEY` | Sessie/bestand-encryptiesleutel |
| `VITE_LEGACY_ENCRYPTION_KEY` | Oude sleutel voor migratie |
| `VITE_IMGBB_API_KEY` | ImgBB key voor foto/video-uploads |

## Builden en releasen

```bash
# Typecheck
npm run type-check

# Volledige build (shared → web → main)
npm run build

# Lokaal packages maken
npm run package
```

### Release via GitHub Actions

Het releasen verloopt volledig via GitHub Actions:

1. Bump de versie in de `package.json` bestanden
2. Push een tag: `git tag v1.7.5 && git push origin v1.7.5`
3. De workflow `Release` bouwt automatisch macOS, Windows en Linux en uploadt de artifacts naar de release

Een specifiek platform opnieuw bouwen (bijvoorbeeld een kapotte build repareren):

```bash
gh workflow run release.yml --ref main -f tag=v1.7.5 -f os=win
# opties voor os: all, mac, win, linux
```

## License

MIT