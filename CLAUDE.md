# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.
Full project overview available in `docs/project-overview.md`.

---

## Project Overview

Cutia is a privacy-first, open-source browser-based video editor. Turborepo monorepo with Bun as package manager. Main application at `apps/web/` (Next.js 16 + React 19 + TypeScript 5.8).

All media processing stays in the browser via FFmpeg.wasm and HuggingFace Transformers — no file upload needed.

---

## Commands

### Development
```bash
bun install                        # Install dependencies (from repo root)
bun run dev:web                    # Start web app dev server (port 4100, turbopack)
```

### Linting & Formatting (Biome)
```bash
bun run lint:web                   # Lint check
bun run lint:web:fix               # Lint + auto-fix
cd apps/web && bun run format      # Format code
```
Biome config: tabs, 80-char line width, double quotes. `src/components/ui/` excluded from linting.

### Testing
```bash
bun test                           # Run all tests (Bun test runner)
bun test path/to/file.test.ts      # Run a single test file
```

### i18n
```bash
cd apps/web
bun run translation:extract        # Extract t() keys into locale JSON files
bun run translation:scan           # Scan for missing translations
bun run translation:translate      # Auto-translate to other locales
```

### Database (optional, for auth)
```bash
cd apps/web
bun run db:generate                # Generate Drizzle migrations
bun run db:migrate                 # Apply migrations
bun run db:push:local              # Push schema to local DB
```

### Docker
```bash
docker compose up redis serverless-redis-http -d   # Backing services only
docker compose up --build                          # Full stack (includes web app)
```

---

## Architecture Quick Reference

### Monorepo Structure
- `apps/web/` — Main Next.js application
- `packages/ui/` — Shared icons package (`@cutia/ui`)
- `packages/env/` — Environment variable validation (`@cutia/env`)

### EditorCore (Singleton)

`apps/web/src/core/index.ts` — EditorCore singleton with 9 domain managers. Access via `useEditor()` hook in components, `EditorCore.getInstance()` outside React.

| Manager | Responsibility |
|---|---|
| `CommandManager` | undo/redo command pattern |
| `PlaybackManager` | playback control |
| `TimelineManager` | track/element manipulation |
| `ScenesManager` | scene management |
| `ProjectManager` | project lifecycle |
| `MediaManager` | media asset handling |
| `RendererManager` | FFmpeg.wasm rendering/export |
| `SaveManager` | IndexedDB persistence |
| `AudioManager` | audio handling |
| `SelectionManager` | multi-element selection |

### Routing & i18n

`@i18next-toolkit/nextjs-approuter` with URL-segment strategy. 12 locales (`en`, `zh`, `ja`, `ko`, `es`, `pt`, `fr`, `de`, `id`, `vi`, `ru`, `it`).

- **Link/useRouter**: MUST use `@/lib/navigation` — **never** from `next/link` or `next/navigation`
- `useParams`, `useSearchParams`, `notFound` from `next/navigation` are fine
- Translation keys must be **string literals** (not variables) for extraction tools to work
- After adding new `t()` calls, run `translation:extract`
- Auto-generated locale JSON files must not be edited manually

### Storage Migrations

Projects persist in IndexedDB. When changing persisted types (`TProject`, `TScene`, `TProjectMetadata`, `TProjectSettings`, `TimelineTrack`, `TimelineElement`):

1. Bump `CURRENT_PROJECT_VERSION` in `services/storage/migrations/index.ts`
2. Create transformer in `transformers/vN-to-vM.ts` (pure function)
3. Create migration class extending `StorageMigration`
4. Register in `migrations` array
5. Add tests with fixture data

### Mobile / Desktop Dual View

Editor branches at `app/[locale]/editor/[project_id]/page.tsx` via `useIsMobile()`. **Any editor feature change must update both views.**

| Desktop | Mobile |
|---|---|
| `editor-header.tsx` | `mobile/mobile-header.tsx` |
| `panels/timeline/` | `mobile/mobile-timeline/` |
| `panels/preview/` | `mobile/mobile-preview.tsx` |
| `panels/properties/` | `mobile/mobile-drawer/mobile-properties-drawer.tsx` |
| `panels/assets/` | `mobile/mobile-drawer/mobile-assets-drawer.tsx` |

Shared (must not break either): `core/`, `stores/`, `services/`, `hooks/actions/`, `types/`, `constants/`, `lib/`

---

## Code Conventions

- **Biome** enforces linting/formatting — no ESLint/Prettier
- **No `console.*`** in production code
- **No TypeScript enums, `any`, or namespaces** — use union types, `as const`
- **Destructured props**: `function Foo({ bar }: { bar: string })` not `function Foo(bar: string)`
- **Accessibility**: buttons need `type` attribute; `onClick` needs keyboard handler pair; SVGs need `<title>`
- **Separation of concerns**: one file, one responsibility; extract at ~500 lines
- **Comments**: explain WHY, not WHAT; no AI-style obvious commentary
- **Scannable code**: extract complex conditions into named variables/helpers
- **User-triggered operations**: use `invokeAction()` from `@/lib/actions`, not direct `editor.xxx()` calls

---

## NEVER Rules

### Code
- Never use `any` type — use union types, `as const`, or `unknown`
- Never use TypeScript enums or namespaces
- Never use inline styles — Tailwind CSS classes only
- Never leave `console.*` in production code
- Never use `next/link` or `next/navigation` for `Link`/`useRouter` — use `@/lib/navigation`
- Never call `editor.xxx()` directly for user-triggered operations — use `invokeAction()`
- Never skip storage migration when modifying persisted types

### Architecture
- Never modify only one view layer — desktop and mobile must stay in sync
- Never edit EditorCore or a Manager without checking downstream consumers in both views
- Never bypass the actions system for user-initiated operations

### Build & Files
- Never manually edit `bun.lock` — re-run `bun install`
- Never manually edit `next-env.d.ts` — auto-generated by Next.js
- Never edit auto-generated locale JSON files — edit source `t()` calls and re-extract
- Never modify `dist/`, `.next/`, or build output
- Never skip Biome checks
- Never commit `.env` files or credentials

### Git Policy
- **Never commit automatically.** Do not run `git add`, `git commit`, or `git push` unless explicitly asked. Leave changes unstaged for user review.
- Never force-push to main or master

---

## What to Do When Starting New Work

1. Read the existing patterns in similar files
2. Check `docs/project-overview.md` for full context
3. For editor features: identify both desktop and mobile targets upfront
4. For persisted data changes: plan the storage migration
5. For UX changes: check `@/lib/actions/definitions.ts` — is an action needed?
6. Run `bun run lint:web` after implementation, fix Biome issues
