# AGENTS.md

> 本文件面向 AI Agent 和开发者，提供项目架构、关键模式和操作指引。
> 完整项目全景请参考 `docs/project-overview.md`。

---

## Overview

**Cutia** — Privacy-first, open-source browser-based video editor. Multi-track timeline (video, audio, text, stickers), real-time preview, AI-assisted generation, FFmpeg.wasm export. All media processing stays in the browser.

Forked from [opencut](https://github.com/msgbyte/opencut), deeply evolved.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (turbopack) + React 19 |
| Language | TypeScript 5.8 strict |
| Package Manager | Bun 1.2.18 |
| Monorepo | Turborepo 2.7 |
| State | Zustand 5 |
| Styling | Tailwind CSS 4 + CVA + tailwind-merge |
| i18n | `@i18next-toolkit/nextjs-approuter` (12 locales, URL-segment) |
| Linting | Biome (no ESLint/Prettier) |
| Testing | Bun test |
| Video Engine | FFmpeg.wasm 0.12 |
| Audio | wavesurfer.js 7.12 |
| Transcription | HuggingFace Transformers 3.8 (in-browser) |
| Auth | Better Auth (optional, needs PostgreSQL) |
| DB | Drizzle ORM + PostgreSQL (auth only) |

---

## Project Structure

```
apps/web/src/
├── app/
│   ├── [locale]/              # All pages (i18n URL-segment)
│   │   ├── page.tsx            # Landing page
│   │   ├── editor/[project_id]/page.tsx  # Editor entry
│   │   ├── projects/           # Project management
│   │   └── ...                 # privacy, terms, roadmap, etc.
│   └── api/                    # API routes (no locale prefix)
│
├── core/                       # EditorCore singleton + 9 Managers
├── components/
│   ├── ui/                     # ~56 generic UI components
│   ├── editor/                 # Desktop editor components
│   │   ├── panels/             #   timeline, preview, properties, assets, agent
│   │   └── mobile/             #   Mobile editor (independent implementation)
│   ├── landing/                # Landing page components
│   └── providers/              # React Context providers
│
├── stores/                     # Zustand stores (UI state only)
├── services/                   # Browser-side "backend" services
│   ├── storage/                #   IndexedDB + migration framework
│   ├── renderer/               #   FFmpeg.wasm pipeline
│   ├── transcription/          #   In-browser speech-to-text
│   └── timeline-thumbnail/     #   Thumbnail generation
│
├── hooks/                      # Custom React hooks
├── types/                      # TypeScript types
├── constants/                  # Constants
├── lib/                        # Domain-specific utilities
├── utils/                      # Generic utilities
└── middleware.ts               # i18n middleware
```

---

## Lib vs Utils

- **`lib/`** — domain logic specific to this app (actions, commands, navigation, i18n wrapper, AI agents)
- **`utils/`** — generic helpers that could be copy-pasted into any other app (date formatting, number formatting, etc.)

---

## Architecture Patterns

### EditorCore (Singleton)

`core/index.ts` — single `EditorCore` instance orchestrates all editor logic via 9 domain managers:

```
EditorCore
├── CommandManager     # undo/redo command pattern
├── PlaybackManager    # play/pause/seek
├── TimelineManager    # track/element CRUD
├── ScenesManager      # scene switching
├── ProjectManager     # project load/create
├── MediaManager       # media import/decode
├── RendererManager    # FFmpeg.wasm export
├── SaveManager        # IndexedDB auto-save
├── AudioManager       # audio mixing
└── SelectionManager   # multi-select
```

Access pattern:
- **In React components**: `useEditor()` from `@/hooks/use-editor`
- **Outside React**: `EditorCore.getInstance()` from `@/core`

### State Layers

```
IndexedDB (persistence, SaveManager)
    ↕
EditorCore (singleton, business logic)
    ↕
Zustand Stores (UI state, panel layout, keybindings)
    ↕
React Components (rendering)
```

### Actions System

Actions are the trigger layer for user-initiated operations. Single source of truth: `@/lib/actions/definitions.ts`.

1. Define in `ACTIONS` (description, category, defaultShortcuts)
2. Add handler in `@/hooks/use-editor-actions.ts`
3. Components call `invokeAction("action-id")` from `@/lib/actions`

Never bypass the actions system with direct `editor.xxx()` calls for user-triggered operations — actions provide toast feedback, validation, and keyboard shortcut binding.

### Commands System

Commands handle undo/redo. Each extends `Command` from `@/lib/commands/base-command`:

- `execute()` — saves current state, then mutates
- `undo()` — restores saved state

Commands live in `@/lib/commands/` organized by domain (timeline, media, scene).

### Mobile / Desktop Dual View

Editor branches at `app/[locale]/editor/[project_id]/page.tsx` via `useIsMobile()`. Desktop and mobile are **independent view layers** sharing the same `core/`, `stores/`, `services/`, `types/`.

| Desktop | Mobile |
|---|---|
| `panels/timeline/` | `mobile/mobile-timeline/` |
| `panels/preview/` | `mobile/mobile-preview.tsx` |
| `panels/properties/` | `mobile/mobile-drawer/mobile-properties-drawer.tsx` |
| `panels/assets/` | `mobile/mobile-drawer/mobile-assets-drawer.tsx` |
| `editor-header.tsx` | `mobile/mobile-header.tsx` |

**Any editor feature change must update BOTH.**

---

## When Adding a New Feature

### New Page
1. Create `app/[locale]/<name>/page.tsx`
2. Server Component by default; add `"use client"` only for interactivity
3. Use `Link`/`useRouter` from `@/lib/navigation`
4. Translation keys must be **string literals**
5. Run `bun run translation:extract`

### New API Route
1. Create under `app/api/` (no locale prefix)
2. Follow existing route patterns

### Modified Editor Feature
1. Update the Manager in `core/managers/` (business logic)
2. Update the relevant Zustand store (UI state, if needed)
3. Update desktop component (`components/editor/panels/...`)
4. Update mobile component (`components/editor/mobile/...`)
5. If persisted types change, create a storage migration (see 4.5 in `docs/project-overview.md`)

---

## Code Conventions

### TypeScript
- **Never use `any`** — use union types, `as const`, or `unknown`
- **Never use TypeScript enums or namespaces** — use union types with `as const`
- Use `interface` for Props, `type` for computed/union types
- Destructured props: `function Foo({ bar }: { bar: string })` not `function Foo(bar: string)`

### Styling
- Tailwind CSS utility classes only — **never use inline styles**
- Classes from `class-variance-authority` (CVA) for variant components
- `clsx` + `tailwind-merge` (`cn()` helper in `@/lib/utils`) for conditional classes

### Accessibility
- Buttons must have `type` attribute
- `onClick` needs keyboard handler pair (`onKeyDown`)
- SVGs need `<title>` for screen readers

### Comments
- Explain WHY, not WHAT — well-named code documents itself
- **Never add AI-style obvious commentary** (e.g. `// This function does X` when function name already says it)

### Separation of Concerns
- One file, one responsibility
- Extract at ~500 lines
- Complex conditions → named variables/helpers

---

## NEVER Rules

### Code Quality
- Never use `any` type in components, stores, or core logic
- Never leave `console.*` in production code
- Never add TypeScript enums or namespaces
- Never use inline styles (use Tailwind classes via `className`)
- Never add obvious AI-style comments ("This function does X" when name is clear)
- Never use `var` — use `const` / `let`
- Never add a TODO without tracking it in the issue tracker
- Never hardcode sensitive info (API keys, secrets) in source files

### Architecture
- Never use `next/link` or `next/navigation` for `Link`/`useRouter` — must use `@/lib/navigation`
- Never call `editor.xxx()` directly for user-triggered operations — use `invokeAction()`
- Never modify EditorCore or a Manager without checking both desktop AND mobile consumers
- Never skip storage migration when changing persisted types (`TProject`, `TScene`, `TimelineTrack`, `TimelineElement`)
- Never add a feature to only one view layer — desktop and mobile must stay in sync

### Build & Tooling
- Never manually edit `bun.lock` — auto-generated, re-run `bun install`
- Never manually edit `next-env.d.ts` — auto-generated by Next.js
- Never modify auto-generated locale JSON files in `public/locales/` directly — edit source code and re-extract
- Never skip Biome linting or formatting — run `bun run lint:web` before committing
- Never modify `dist/` or `.next/` build output

### Git & Workflow
- Never commit automatically — git is manual only, user reviews and commits
- Never run `git push --force` to main or master
- Never modify `.gitignore` without understanding what files it's protecting
- Never commit `.env` files or credentials

---

## Commands Reference

```bash
bun install                          # Install dependencies
bun run dev:web                      # Start dev (localhost:4100, turbopack)
bun run build:web                    # Production build
bun run lint:web                     # Biome check
bun run lint:web:fix                 # Biome auto-fix
cd apps/web && bun run format        # Format code
bun test                             # All tests
bun test path/to/file.test.ts        # Single test file
cd apps/web && bun run translation:extract  # Extract i18n keys
```

---

## Related Documentation

- `docs/project-overview.md` — Full project overview (tech stack, directory structure, architecture, risks, roadmap)
- `docs/superpowers/specs/2026-03-30-mobile-editor-design.md` — Mobile editor design spec
